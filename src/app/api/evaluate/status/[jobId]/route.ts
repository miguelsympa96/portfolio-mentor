import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/lib/jobStore";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const job = await getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: "No se encontró esa evaluación, puede que haya expirado. Prueba de nuevo." },
        { status: 404 }
      );
    }
    return NextResponse.json(job);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
