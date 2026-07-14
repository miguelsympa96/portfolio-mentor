export const CATEGORIES = [
  { key: "primera_impresion", label: "Primera impresión (10s)", shortLabel: "1ª impresión", weight: 25 },
  { key: "estructura_narrativa", label: "Estructura narrativa", shortLabel: "Narrativa", weight: 20 },
  { key: "impacto_metricas", label: "Impacto y métricas", shortLabel: "Impacto", weight: 20 },
  { key: "autoria", label: "Autoría y contribución", shortLabel: "Autoría", weight: 15 },
  { key: "craft", label: "Craft y pulido", shortLabel: "Craft", weight: 10 },
  { key: "curacion", label: "Curación y diversidad", shortLabel: "Curación", weight: 10 },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export type Seniority = "junior" | "mid" | "senior" | "staff";

export type Semaphore = "green" | "yellow" | "red";

export type JobFitLevel = "alto" | "medio" | "bajo";

export interface JobFit {
  level: JobFitLevel;
  summary: string;
  strengths: string[];
  gaps: string[];
}

export interface TextSuggestion {
  // Only present when the action replaces a specific existing phrase the
  // candidate already wrote (quoted verbatim). Omitted for suggestions that
  // are new text with nothing specific to quote as the "before" (e.g. a
  // whole overview rewrite).
  before?: string;
  after: string;
}

export interface ActionItem {
  text: string;
  suggestion?: TextSuggestion;
}

export interface CategoryFix {
  actions: ActionItem[];
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
  fixes: ActionItem[];
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
  // Only set when the candidate picked a level manually. Omitted when it was
  // inferred from a job description instead, since that inference happens
  // inside Claude's evaluation and isn't returned as a structured field —
  // category weighting (see scoring.ts) falls back to the mid baseline in
  // that case rather than guessing.
  seniority?: Seniority;
  _mock?: boolean;
}

export type ScoreTier = "low" | "mid" | "high";

export function scoreTier(score: number): ScoreTier {
  if (score >= 8) return "high";
  if (score >= 5) return "mid";
  return "low";
}
