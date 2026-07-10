export const CATEGORIES = [
  { key: "primera_impresion", label: "Primera impresión (10s)", shortLabel: "1ª impresión", weight: 25 },
  { key: "estructura_narrativa", label: "Estructura narrativa", shortLabel: "Narrativa", weight: 20 },
  { key: "impacto_metricas", label: "Impacto y métricas", shortLabel: "Impacto", weight: 20 },
  { key: "autoria", label: "Autoría y contribución", shortLabel: "Autoría", weight: 15 },
  { key: "craft", label: "Craft y pulido", shortLabel: "Craft", weight: 10 },
  { key: "curacion", label: "Curación y diversidad", shortLabel: "Curación", weight: 10 },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export type Semaphore = "green" | "yellow" | "red";

export type JobFitLevel = "alto" | "medio" | "bajo";

export interface JobFit {
  level: JobFitLevel;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface CategoryFix {
  actions: string[];
  rewrite?: { before: string; after: string };
}

export interface CategoryEntry {
  key: CategoryKey;
  score: number;
  problem: string;
  whyItMatters: string;
  fix: CategoryFix;
}

export type CaseStudyRecommendation = "mantener" | "reordenar" | "ampliar" | "cortar";

export const CASE_STUDY_RECOMMENDATION_LABEL: Record<CaseStudyRecommendation, string> = {
  mantener: "Mantener",
  reordenar: "Reordenar",
  ampliar: "Ampliar",
  cortar: "Cortar",
};

export interface CaseStudy {
  name: string;
  recommendation: CaseStudyRecommendation;
  problem: string;
  whyItMatters: string;
  fixes: string[];
}

export interface VerdictHeadline {
  line1: string;
  line2: string;
}

export interface Benchmark {
  percentile: number;
  sampleSize: number;
}

export interface EvaluationResult {
  semaphore: Semaphore;
  headline: string;
  verdictHeadline: VerdictHeadline;
  strengths: string[];
  keyRisks: string[];
  categories: CategoryEntry[];
  caseStudies: CaseStudy[];
  jobFit?: JobFit;
  benchmark?: Benchmark;
  _mock?: boolean;
}

export type ScoreTier = "low" | "mid" | "high";

export function scoreTier(score: number): ScoreTier {
  if (score >= 8) return "high";
  if (score >= 5) return "mid";
  return "low";
}
