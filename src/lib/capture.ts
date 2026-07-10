import type { Browser, Page } from "playwright-core";
import sharp from "sharp";

const MAX_PAGES = 5; // home + up to 4 subpages
const VIEWPORT = { width: 1280, height: 900 };
const MOBILE_VIEWPORT = { width: 390, height: 844 }; // iPhone-class width, the most common mobile breakpoint
const MAX_IMAGE_HEIGHT = 6000; // cap full-page screenshot height before sending to Claude
// Kept tight on purpose: this route runs under a 60s serverless budget
// shared with the Claude vision call, and up to 5 navigations happen here.
const NAV_TIMEOUT_MS = 10000;

export type CapturedMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "image/webp"
  | "application/pdf";

export type ViewportKind = "desktop" | "mobile";

export interface CapturedImage {
  mediaType: CapturedMediaType;
  base64: string;
  sourceUrl: string;
  viewport: ViewportKind;
}

function toAbsoluteUrl(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

const SKIP_PATH_HINTS = [
  "privacy",
  "terms",
  "cookie",
  "contact",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "instagram.com",
  "github.com",
  "mailto:",
  "tel:",
  "medium.com",
  "dribbble.com",
  "behance.net",
];

async function discoverInternalLinks(
  page: Page,
  base: URL
): Promise<string[]> {
  const hrefs = await page.$$eval("a[href]", (els) =>
    els.map((el) => el.getAttribute("href") || "")
  );

  const seen = new Set<string>([base.toString()]);
  const result: string[] = [];

  for (const href of hrefs) {
    const abs = toAbsoluteUrl(href, base);
    if (!abs) continue;
    const u = new URL(abs);
    if (u.origin !== base.origin) continue;
    if (u.pathname === base.pathname) continue;
    const lower = abs.toLowerCase();
    if (SKIP_PATH_HINTS.some((hint) => lower.includes(hint))) continue;
    if (seen.has(abs)) continue;
    seen.add(abs);
    result.push(abs);
    if (result.length >= MAX_PAGES - 1) break;
  }

  return result;
}

async function resizeScreenshot(buffer: Buffer): Promise<Buffer> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  if (!metadata.height || metadata.height <= MAX_IMAGE_HEIGHT) {
    return buffer;
  }
  return image
    .extract({
      left: 0,
      top: 0,
      width: metadata.width!,
      height: MAX_IMAGE_HEIGHT,
    })
    .png()
    .toBuffer();
}

// Real portfolio sites almost always keep some connection open (analytics
// beacons, chat widgets, font CDNs), so "networkidle" rarely fires early
// and instead just burns the full timeout on every navigation. "load" plus
// a short fixed settle delay is far faster and still gives lazy content
// time to paint before the screenshot.
const SETTLE_MS = 500;

async function gotoAndSettle(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "load", timeout: NAV_TIMEOUT_MS });
  await page.waitForTimeout(SETTLE_MS);
}

function normalizeUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

// Vercel's serverless functions run on Amazon Linux and can't use the
// Chromium binary that the full `playwright` package bundles for local
// dev (mac/linux desktop builds). @sparticuz/chromium ships a build
// compiled for that Lambda-like environment instead. `playwright` (with
// bundled browsers) stays a dependency purely so local dev keeps working
// without needing this separate binary.
async function launchBrowser(): Promise<Browser> {
  if (process.env.VERCEL) {
    const { default: sparticuzChromium } = await import("@sparticuz/chromium");
    const { chromium: playwrightCore } = await import("playwright-core");
    return playwrightCore.launch({
      args: sparticuzChromium.args,
      executablePath: await sparticuzChromium.executablePath(),
      headless: true,
    });
  }

  const { chromium: localChromium } = await import("playwright");
  return localChromium.launch({ headless: true });
}

export async function captureUrlScreenshots(
  rawUrl: string
): Promise<CapturedImage[]> {
  const base = new URL(normalizeUrl(rawUrl));
  const browser = await launchBrowser();
  const images: CapturedImage[] = [];

  try {
    const context = await browser.newContext({ viewport: VIEWPORT });
    const page = await context.newPage();

    await gotoAndSettle(page, base.toString());

    const homeShot = await resizeScreenshot(
      await page.screenshot({ fullPage: true, type: "png" })
    );
    images.push({
      mediaType: "image/png",
      base64: homeShot.toString("base64"),
      sourceUrl: base.toString(),
      viewport: "desktop",
    });

    // Mobile capture of the same already-loaded home page: resizing the
    // viewport lets responsive CSS reflow instantly (Chromium re-evaluates
    // media queries on resize), so this is a real rendered mobile view
    // without paying for a second full navigation.
    try {
      await page.setViewportSize(MOBILE_VIEWPORT);
      await page.waitForTimeout(400);
      const mobileShot = await resizeScreenshot(
        await page.screenshot({ fullPage: true, type: "png" })
      );
      images.push({
        mediaType: "image/png",
        base64: mobileShot.toString("base64"),
        sourceUrl: base.toString(),
        viewport: "mobile",
      });
      await page.setViewportSize(VIEWPORT);
    } catch {
      // No mobile capture available — the prompt is instructed to stay
      // silent on responsiveness rather than guess when this is missing.
    }

    const subLinks = await discoverInternalLinks(page, base);

    for (const link of subLinks) {
      try {
        await gotoAndSettle(page, link);
        const shot = await resizeScreenshot(
          await page.screenshot({ fullPage: true, type: "png" })
        );
        images.push({
          mediaType: "image/png",
          base64: shot.toString("base64"),
          sourceUrl: link,
          viewport: "desktop",
        });
      } catch {
        // Subpage failed to load or timed out — skip it, keep the rest.
        continue;
      }
    }

    return images;
  } finally {
    await browser.close();
  }
}
