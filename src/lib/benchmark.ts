// Below this sample size we don't show a percentile at all — a benchmark
// computed from a handful of rows would look authoritative while being
// statistically meaningless, which is exactly the kind of overclaim this
// app's rubric refuses to let candidates get away with in their own work.
const MIN_SAMPLE_SIZE = 20;

export interface BenchmarkResult {
  percentile: number;
  sampleSize: number;
}

export function computePercentile(
  score: number,
  seniority: string,
  history: { seniority: string; score: number }[]
): BenchmarkResult | null {
  const pool = history.filter((h) => h.seniority === seniority);
  if (pool.length < MIN_SAMPLE_SIZE) return null;

  const below = pool.filter((h) => h.score < score).length;
  const percentile = Math.round((below / pool.length) * 100);
  return { percentile, sampleSize: pool.length };
}
