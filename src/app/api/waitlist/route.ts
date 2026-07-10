import { NextRequest, NextResponse } from "next/server";
import { appendWaitlistRow } from "@/lib/googleSheets";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface WaitlistPayload {
  email: string;
  feature: string;
  seniority?: string;
  locale?: string;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`waitlist:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil((limit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Demasiados envíos seguidos. Prueba de nuevo en un rato." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const body = (await req.json()) as Partial<WaitlistPayload>;

    if (typeof body.email !== "string" || !EMAIL_RE.test(body.email)) {
      return NextResponse.json({ error: "Introduce un email válido." }, { status: 400 });
    }
    if (typeof body.feature !== "string" || !body.feature) {
      return NextResponse.json({ error: "Falta identificar la feature." }, { status: 400 });
    }

    await appendWaitlistRow([
      new Date().toISOString(),
      body.email,
      body.feature,
      body.seniority ?? "",
      body.locale ?? "",
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("waitlist submission failed", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
