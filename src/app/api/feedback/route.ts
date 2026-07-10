import { NextRequest, NextResponse } from "next/server";
import { appendFeedbackRow } from "@/lib/googleSheets";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";

const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

interface FeedbackPayload {
  nps: number;
  accuracy: number;
  surprise?: string;
  mostUseful?: string[];
  missingFeature?: string;
  friction?: string;
  wouldShare?: "si" | "ya_lo_hice" | "no";
  wouldPay?: "si" | "quizas" | "no";
  email?: string;
  seniority: string;
  semaphore: string;
  resolvedCount: number;
  totalActionable: number;
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`feedback:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil((limit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: "Demasiados envíos seguidos. Prueba de nuevo en un rato." },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const body = (await req.json()) as Partial<FeedbackPayload>;

    if (typeof body.nps !== "number" || typeof body.accuracy !== "number") {
      return NextResponse.json(
        { error: "Faltan las respuestas obligatorias (NPS y precisión)." },
        { status: 400 }
      );
    }

    await appendFeedbackRow([
      new Date().toISOString(),
      body.seniority ?? "",
      body.semaphore ?? "",
      body.nps,
      body.accuracy,
      body.resolvedCount ?? 0,
      body.totalActionable ?? 0,
      (body.mostUseful ?? []).join(", "),
      body.surprise ?? "",
      body.missingFeature ?? "",
      body.friction ?? "",
      body.wouldShare ?? "",
      body.wouldPay ?? "",
      body.email ?? "",
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("feedback submission failed", err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
