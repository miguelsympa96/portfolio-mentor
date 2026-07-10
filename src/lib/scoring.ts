import { CATEGORIES, type CaseStudyRecommendation, type EvaluationResult } from "./types";

// Everything here is computed from Claude's own real per-category scores —
// nothing is invented or claimed to be calibrated against real company
// hiring data. It's an honest weighted aggregate, not a prediction.

const TARGET_SCORE = 9; // what a "fixed" category realistically lands at

export function compositeScore(result: EvaluationResult): number {
  const total = result.categories.reduce(
    (sum, cat) => {
      const weight = CATEGORIES.find((c) => c.key === cat.key)?.weight ?? 0;
      return sum + (cat.score * weight) / 10;
    },
    0
  );
  return Math.round(total);
}

export function categoryImpact(categoryKey: string, currentScore: number): number {
  const weight = CATEGORIES.find((c) => c.key === categoryKey)?.weight ?? 0;
  const delta = Math.max(0, TARGET_SCORE - currentScore);
  return Math.round((delta * weight) / 10);
}

const CASE_STUDY_IMPACT: Record<CaseStudyRecommendation, number> = {
  cortar: 8,
  ampliar: 6,
  reordenar: 3,
  mantener: 0,
};

export function caseStudyImpact(recommendation: CaseStudyRecommendation): number {
  return CASE_STUDY_IMPACT[recommendation];
}

const CASE_STUDY_TIME: Record<CaseStudyRecommendation, string> = {
  cortar: "2 min",
  reordenar: "2 min",
  ampliar: "20 min",
  mantener: "0 min",
};

export function caseStudyTimeEstimate(recommendation: CaseStudyRecommendation): string {
  return CASE_STUDY_TIME[recommendation];
}

export function categoryTimeEstimate(categoryKey: string, hasRewrite: boolean): string {
  if (categoryKey === "impacto_metricas") return "15 min";
  if (hasRewrite) return "5 min";
  return "10 min";
}

export function potentialScore(result: EvaluationResult, resolvedStepIndexes: Set<number>, allImpacts: Map<number, number>): number {
  const current = compositeScore(result);
  let potential = current;
  for (const [stepIndex, impact] of allImpacts) {
    if (!resolvedStepIndexes.has(stepIndex)) potential += impact;
  }
  return Math.min(100, potential);
}
