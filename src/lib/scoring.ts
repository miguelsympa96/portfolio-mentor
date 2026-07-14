import { CATEGORIES, type CaseStudyRecommendation, type CategoryKey, type EvaluationResult, type Seniority } from "./types";

// Everything here is computed from Claude's own real per-category scores —
// nothing is invented or claimed to be calibrated against real company
// hiring data. It's an honest weighted aggregate, not a prediction.

const TARGET_SCORE = 9; // what a "fixed" category realistically lands at

// CATEGORIES' weights are the mid baseline. Junior and senior/staff shift
// narrative structure vs. measurable impact by the same 5 points in
// opposite directions, per the rubric (SKILL.md): narrative structure is the
// strongest signal of judgment a junior candidate can show without a track
// record, while missing impact evidence is disqualifying at senior/staff but
// merely a gap at junior. Senior and staff share a table since the rubric
// never distinguishes between them for scoring purposes. mid is also the
// fallback when seniority was inferred from a job description rather than
// picked manually — see EvaluationResult.seniority.
const WEIGHT_OVERRIDES: Partial<Record<Seniority, Partial<Record<CategoryKey, number>>>> = {
  junior: { estructura_narrativa: 25, impacto_metricas: 15 },
  senior: { estructura_narrativa: 15, impacto_metricas: 25 },
  staff: { estructura_narrativa: 15, impacto_metricas: 25 },
};

export function categoryWeight(categoryKey: string, seniority?: Seniority): number {
  const base = CATEGORIES.find((c) => c.key === categoryKey)?.weight ?? 0;
  const override = seniority ? WEIGHT_OVERRIDES[seniority]?.[categoryKey as CategoryKey] : undefined;
  return override ?? base;
}

export function compositeScore(result: EvaluationResult): number {
  const total = result.categories.reduce((sum, cat) => {
    return sum + (cat.score * categoryWeight(cat.key, result.seniority)) / 10;
  }, 0);
  return Math.round(total);
}

export function categoryImpact(categoryKey: string, currentScore: number, seniority?: Seniority): number {
  const weight = categoryWeight(categoryKey, seniority);
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
