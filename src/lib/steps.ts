import { CATEGORIES, type EvaluationResult } from "./types";
import { categoryImpact, categoryTimeEstimate, caseStudyImpact, caseStudyTimeEstimate } from "./scoring";

export type StepDef =
  | { kind: "jobfit" }
  | { kind: "priority" }
  | { kind: "casestudy"; index: number }
  | { kind: "done" };

export function buildSteps(result: EvaluationResult): StepDef[] {
  const steps: StepDef[] = [];
  if (result.jobFit) steps.push({ kind: "jobfit" });
  steps.push({ kind: "priority" });
  result.caseStudies.forEach((_, index) => steps.push({ kind: "casestudy", index }));
  steps.push({ kind: "done" });
  return steps;
}

export function priorityCategory(result: EvaluationResult) {
  return [...result.categories].sort((a, b) => a.score - b.score)[0];
}

/** Estimated Hiring Score impact + time for a given step, or null for non-actionable steps (jobfit/done). */
export function stepEstimate(
  result: EvaluationResult,
  step: StepDef
): { impact: number; time: string } | null {
  if (step.kind === "priority") {
    const cat = priorityCategory(result);
    if (!cat) return null;
    return {
      impact: categoryImpact(cat.key, cat.score),
      time: categoryTimeEstimate(cat.key, !!cat.fix.rewrite),
    };
  }
  if (step.kind === "casestudy") {
    const cs = result.caseStudies[step.index];
    if (!cs) return null;
    return { impact: caseStudyImpact(cs.recommendation), time: caseStudyTimeEstimate(cs.recommendation) };
  }
  return null;
}

/** Display name for a resolvable step, used in the completion celebration. */
export function stepName(result: EvaluationResult, step: StepDef): string | null {
  if (step.kind === "priority") {
    const cat = priorityCategory(result);
    return cat ? CATEGORIES.find((c) => c.key === cat.key)?.label ?? null : null;
  }
  if (step.kind === "casestudy") {
    return result.caseStudies[step.index]?.name ?? null;
  }
  return null;
}

/** How many independently-checkable actions a step has (0 for non-actionable steps). */
export function stepActionCount(result: EvaluationResult, step: StepDef): number {
  if (step.kind === "priority") {
    const cat = priorityCategory(result);
    if (!cat) return 0;
    return cat.fix.actions.length + (cat.fix.rewrite ? 1 : 0);
  }
  if (step.kind === "casestudy") {
    return result.caseStudies[step.index]?.fixes.length ?? 0;
  }
  return 0;
}

export function actionKey(stepIndex: number, actionIndex: number): string {
  return `${stepIndex}:${actionIndex}`;
}

export function stepActionKeys(stepIndex: number, count: number): string[] {
  return Array.from({ length: count }, (_, i) => actionKey(stepIndex, i));
}

export function isStepFullyResolved(
  result: EvaluationResult,
  step: StepDef,
  stepIndex: number,
  resolvedActions: Set<string>
): boolean {
  const count = stepActionCount(result, step);
  if (count === 0) return false;
  return stepActionKeys(stepIndex, count).every((k) => resolvedActions.has(k));
}

/** Fraction (0-1) of a step's own actions that are checked off, for partial
 * score credit — a step with 2 actions where only 1 is done counts as 0.5,
 * it doesn't withhold the whole step's points until every action is done. */
export function stepResolvedFraction(
  result: EvaluationResult,
  step: StepDef,
  stepIndex: number,
  resolvedActions: Set<string>
): number {
  const count = stepActionCount(result, step);
  if (count === 0) return 0;
  const resolvedCount = stepActionKeys(stepIndex, count).filter((k) => resolvedActions.has(k)).length;
  return resolvedCount / count;
}
