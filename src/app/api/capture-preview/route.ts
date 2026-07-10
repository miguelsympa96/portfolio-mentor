import { NextRequest, NextResponse } from "next/server";
import { captureHomePreview } from "@/lib/capture";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const maxDuration = 30;

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Purely cosmetic: gives the loading screen a real screenshot of the site
// being analyzed to show while the full /api/evaluate call is still
// running. Never blocks or informs the evaluation itself, so any failure
// here should just mean no preview image, never an error for the user.
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`capture-preview:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
      return NextResponse.json({ error: "rate limited" }, { status: 429 });
    }

    const body = await req.json();
    const url = (body as { url?: string }).url;
    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "Falta la URL." }, { status: 400 });
    }

    const preview = await captureHomePreview(url);
    return NextResponse.json({
      dataUrl: `data:${preview.mediaType};base64,${preview.base64}`,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error desconocido" },
      { status: 500 }
    );
  }
}
