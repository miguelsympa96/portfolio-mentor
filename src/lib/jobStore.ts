import { Redis } from "@upstash/redis";
import type { EvaluationResult } from "./types";

export type EvaluationJob =
  | { status: "running" }
  | { status: "done"; result: EvaluationResult }
  | { status: "error"; error: string };

// Long enough to survive a slow evaluation plus a stalled/backgrounded
// browser tab still polling, short enough not to accumulate stale entries.
const JOB_TTL_SECONDS = 15 * 60;

let redis: Redis | null = null;

function getRedis(): Redis {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      "Falta configurar Upstash Redis (variables de entorno UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)."
    );
  }
  redis = new Redis({ url, token });
  return redis;
}

function jobKey(jobId: string): string {
  return `evaluation-job:${jobId}`;
}

export async function createRunningJob(jobId: string): Promise<void> {
  const job: EvaluationJob = { status: "running" };
  await getRedis().set(jobKey(jobId), job, { ex: JOB_TTL_SECONDS });
}

export async function completeJob(jobId: string, result: EvaluationResult): Promise<void> {
  const job: EvaluationJob = { status: "done", result };
  await getRedis().set(jobKey(jobId), job, { ex: JOB_TTL_SECONDS });
}

export async function failJob(jobId: string, error: string): Promise<void> {
  const job: EvaluationJob = { status: "error", error };
  await getRedis().set(jobKey(jobId), job, { ex: JOB_TTL_SECONDS });
}

export async function getJob(jobId: string): Promise<EvaluationJob | null> {
  const job = await getRedis().get<EvaluationJob>(jobKey(jobId));
  return job ?? null;
}
