"use client";

import { useEffect, useMemo, useState } from "react";
import type { EvaluationResult, TextSuggestion } from "@/lib/types";
import {
  buildSteps,
  priorityCategory,
  stepEstimate,
  stepName,
  actionKey,
  isStepFullyResolved,
  stepResolvedFraction,
} from "@/lib/steps";
import { compositeScore } from "@/lib/scoring";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, ChevronIcon } from "./icons";

const DONE_REDIRECT_MS = 6000;

// Collapsed by default: cards were reading as a wall of text with the
// problem, why-it-matters, and fixes all expanded at once. The "why" is
// useful context but not what the user needs to act, so it's tucked behind
// a toggle instead of always taking up vertical space.
function WhyItMatters({ text, t }: { text: string; t: Dictionary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-42"
      >
        {t.improve.whyLabel}
        <ChevronIcon className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <p className="mt-1 text-[13px] italic leading-relaxed text-ink-42">{text}</p>}
    </div>
  );
}

const JOB_FIT_BADGE = {
  alto: "bg-[#eef3ee] text-accent-green",
  medio: "bg-[#f7f0e6] text-[#b8834a]",
  bajo: "bg-[#f7ece9] text-[#b5533c]",
} as const;

function RewriteBlock({ before, after, t }: { before: string; after: string; t: Dictionary }) {
  return (
    <div className="mt-3 flex flex-col gap-2 text-[13px]">
      <p className="rounded-lg bg-[#f7ece9] px-3 py-2 leading-relaxed text-ink">
        <span className="font-semibold text-[#b5533c]">{t.improve.rewriteBefore}: </span>
        {before}
      </p>
      <p className="rounded-lg bg-[#eef3ee] px-3 py-2 leading-relaxed text-ink">
        <span className="font-semibold text-accent-green">{t.improve.rewriteAfter}: </span>
        {after}
      </p>
    </div>
  );
}

// Collapsed by default, same reasoning as WhyItMatters: the suggestion is
// the single most useful thing on the card (a ready-to-use text instead of
// an instruction to write one yourself), but showing it inline for every
// action at once would turn the card back into a wall of text. The
// indentation (ml-[26px]) lines up under the checkbox label above it
// (size-4 checkbox + gap-2.5 = 26px).
function SuggestionToggle({ suggestion, t }: { suggestion: TextSuggestion; t: Dictionary }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="ml-[26px] mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[12px] font-medium text-accent-green"
      >
        {t.improve.suggestionLabel}
        <ChevronIcon className={`size-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open &&
        (suggestion.before ? (
          <RewriteBlock before={suggestion.before} after={suggestion.after} t={t} />
        ) : (
          <p className="mt-2 rounded-lg bg-[#eef3ee] px-3 py-2 text-[13px] leading-relaxed text-ink">
            {suggestion.after}
          </p>
        ))}
    </div>
  );
}

interface ChecklistEntry {
  key: string;
  label: string;
  extra?: React.ReactNode;
}

function ActionChecklist({
  entries,
  resolvedActions,
  onToggle,
  t,
}: {
  entries: ChecklistEntry[];
  resolvedActions: Set<string>;
  onToggle: (key: string) => void;
  t: Dictionary;
}) {
  return (
    <div className="mt-4 rounded-xl bg-background p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-green">{t.improve.howToFixLabel}</p>
      <div className="mt-2 flex flex-col gap-1">
        {entries.map((entry) => {
          const checked = resolvedActions.has(entry.key);
          return (
            <div key={entry.key}>
              <button
                type="button"
                onClick={() => onToggle(entry.key)}
                className="flex w-full items-start gap-2.5 rounded-lg px-1 py-1.5 text-left transition-colors hover:bg-white"
              >
                <span
                  className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors ${
                    checked ? "border-accent-green bg-accent-green" : "border-ink-border bg-white"
                  }`}
                >
                  {checked && <CheckIcon key="on" className="size-2.5 text-white check-pop" />}
                </span>
                <span className={`text-[13px] leading-relaxed ${checked ? "text-ink-42 line-through" : "text-ink"}`}>
                  {entry.label}
                </span>
              </button>
              {entry.extra}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompletionBanner({ name, impact, t }: { name: string; impact: number; t: Dictionary }) {
  return (
    <div className="celebration-pop mt-4 rounded-xl bg-[#eef3ee] p-4 text-center">
      <p className="font-serif-heading text-[16px] text-accent-green">
        {t.improve.completionBanner(name)}
      </p>
      {impact > 0 && (
        <p className="mt-1 text-[13px] text-ink">
          {t.improve.completionImpact(impact)}
        </p>
      )}
    </div>
  );
}

function NextButton({
  onClick,
  label,
  onBack,
  backLabel,
}: {
  onClick: () => void;
  label: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className={`mt-6 flex items-center ${onBack ? "justify-between" : "justify-end"}`}>
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-[13px] font-medium text-ink-42 hover:text-ink"
        >
          <ArrowLeftIcon className="size-3" />
          {backLabel}
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-medium text-background transition-opacity hover:opacity-90"
      >
        {label}
        <ArrowRightIcon className="size-3.5" />
      </button>
    </div>
  );
}

export function ImproveFlow({
  result,
  initialStepIndex = 0,
  resolvedActions,
  onResolvedActionsChange,
  onBackToResult,
}: {
  result: EvaluationResult;
  initialStepIndex?: number;
  resolvedActions: Set<string>;
  onResolvedActionsChange: (resolved: Set<string>) => void;
  onBackToResult: () => void;
}) {
  const { t } = useLocale();
  // The stable, complete step list — action keys and resolution lookups are
  // always keyed against a position in THIS array, never against the
  // filtered list below, so a resolved checkbox never appears to "unresolve"
  // itself when the visible list reshuffles.
  const fullSteps = useMemo(() => buildSteps(result), [result]);

  // Steps the candidate still has to act on. Frozen at mount (not
  // recalculated as resolvedActions changes) so a step doesn't vanish out
  // from under the user the instant they finish its last checkbox — it
  // waits for them to click through, and only future visits to the flow
  // hide already-finished work. jobfit/done are informational, not
  // resolvable, so they always stay visible.
  const [visibleSteps] = useState(() =>
    fullSteps
      .map((step, fullIndex) => ({ step, fullIndex }))
      .filter(
        ({ step, fullIndex }) =>
          step.kind === "jobfit" ||
          step.kind === "done" ||
          !isStepFullyResolved(result, step, fullIndex, resolvedActions)
      )
  );

  const [stepIndex, setStepIndex] = useState(() => {
    const found = visibleSteps.findIndex((v) => v.fullIndex === initialStepIndex);
    return found >= 0 ? found : 0;
  });

  const topFix = priorityCategory(result);
  const topFixCategory = topFix ? t.categories[topFix.key] : undefined;

  const resolvableCount = fullSteps.filter((s) => s.kind === "priority" || s.kind === "casestudy").length;
  const doneStepCount = fullSteps.filter((s, i) => isStepFullyResolved(result, s, i, resolvedActions)).length;

  const baseScore = useMemo(() => compositeScore(result), [result]);
  // Partial credit: checking 1 of 2 actions in a fix counts for half its
  // points instead of withholding all of them until every action is done.
  const runningScore = Math.min(
    100,
    Math.round(
      fullSteps.reduce((sum, s, i) => {
        const est = stepEstimate(result, s);
        if (!est) return sum;
        return sum + est.impact * stepResolvedFraction(result, s, i, resolvedActions);
      }, baseScore)
    )
  );

  function toggleAction(key: string) {
    const next = new Set(resolvedActions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onResolvedActionsChange(next);
  }

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
  }

  const current = visibleSteps[stepIndex];
  const step = current?.step;
  const fullIndex = current?.fullIndex ?? 0;
  const progress = ((stepIndex + 1) / visibleSteps.length) * 100;
  const currentEstimate = step ? stepEstimate(result, step) : null;
  // stepName() falls back to the (Spanish-only) CATEGORIES.label for
  // priority steps; use the already-translated category label instead so
  // the completion banner name matches the active locale.
  const currentName = step
    ? step.kind === "priority"
      ? topFixCategory?.label ?? null
      : stepName(result, step)
    : null;
  const currentFullyResolved = step ? isStepFullyResolved(result, step, fullIndex, resolvedActions) : false;

  useEffect(() => {
    if (!step || step.kind !== "done") return;
    const timer = setTimeout(onBackToResult, DONE_REDIRECT_MS);
    return () => clearTimeout(timer);
  }, [step, onBackToResult]);

  if (!step) return null;

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 py-16 sm:py-24">
      <main className="flex w-full max-w-[560px] flex-col gap-6">
        <div>
          <p className="label-mono mb-3">{t.improve.heading}</p>
          <div className="flex items-center justify-between text-[12px] text-ink-42">
            <span>{t.improve.stepOf(stepIndex + 1, visibleSteps.length)}</span>
            <span key={runningScore} className="score-flash font-mono font-medium text-ink">
              {runningScore}/100
            </span>
          </div>
          <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-ink-border">
            <div
              className="h-full rounded-full bg-accent-green transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div key={stepIndex} className="step-in rounded-2xl border border-ink-border bg-white p-6">
          {step.kind === "jobfit" && result.jobFit && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className="label-mono">{t.improve.jobFitLabel}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${JOB_FIT_BADGE[result.jobFit.level]}`}>
                  {t.result.jobFit[result.jobFit.level]}
                </span>
              </div>
              <p className="mt-3 text-[14px] leading-relaxed text-ink">{result.jobFit.summary}</p>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-accent-green">{t.improve.jobFitFits}</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {result.jobFit.strengths.map((s, i) => (
                      <li key={i} className="text-sm text-ink-42">· {s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#b5533c]">{t.improve.jobFitGaps}</p>
                  <ul className="mt-1.5 flex flex-col gap-1">
                    {result.jobFit.gaps.map((g, i) => (
                      <li key={i} className="text-sm text-ink-42">· {g}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <NextButton
                onClick={goNext}
                label={t.improve.next}
                onBack={stepIndex > 0 ? goBack : undefined}
                backLabel={t.improve.back}
              />
            </>
          )}

          {step.kind === "priority" && topFix && topFixCategory && (() => {
            const entries: ChecklistEntry[] = topFix.fix.actions.map((action, i) => ({
              key: actionKey(fullIndex, i),
              label: action.text,
              extra: action.suggestion ? <SuggestionToggle suggestion={action.suggestion} t={t} /> : undefined,
            }));
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="label-mono text-[#b5533c]">{t.improve.priorityLabel}</p>
                  <span className="font-mono text-[12px] font-semibold text-accent-green">
                    {t.improve.ptsEstimate(currentEstimate?.impact ?? 0)}
                  </span>
                </div>
                <p className="mt-1.5 font-serif-heading text-[20px]">{topFixCategory.label}</p>

                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-42">{t.improve.problemLabel}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{topFix.problem}</p>

                <WhyItMatters text={topFix.whyItMatters} t={t} />

                <ActionChecklist entries={entries} resolvedActions={resolvedActions} onToggle={toggleAction} t={t} />

                {currentFullyResolved && currentName && (
                  <CompletionBanner name={currentName} impact={currentEstimate?.impact ?? 0} t={t} />
                )}

                <NextButton
                  onClick={goNext}
                  label={t.improve.next}
                  onBack={stepIndex > 0 ? goBack : undefined}
                  backLabel={t.improve.back}
                />
              </>
            );
          })()}

          {step.kind === "casestudy" && (() => {
            const cs = result.caseStudies[step.index];
            const isGood = cs.recommendation === "mantener";
            const entries: ChecklistEntry[] = cs.fixes.map((fix, i) => ({
              key: actionKey(fullIndex, i),
              label: fix.text,
              extra: fix.suggestion ? <SuggestionToggle suggestion={fix.suggestion} t={t} /> : undefined,
            }));
            return (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="label-mono">{t.improve.caseStudyLabel(step.index + 1)}</p>
                  <div className="flex items-center gap-2">
                    {!isGood && (
                      <span className="font-mono text-[12px] font-semibold text-accent-green">
                        {t.improve.ptsEstimate(currentEstimate?.impact ?? 0)}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        isGood ? "bg-[#eef3ee] text-accent-green" : "bg-[#f7f0e6] text-[#b8834a]"
                      }`}
                    >
                      {t.improve.caseStudyRecommendation[cs.recommendation]}
                    </span>
                  </div>
                </div>
                <p className="mt-1.5 font-serif-heading text-[20px]">{cs.name}</p>

                <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-ink-42">{t.improve.problemLabel}</p>
                <p className="mt-1 text-[13px] leading-relaxed text-ink">{cs.problem}</p>

                <WhyItMatters text={cs.whyItMatters} t={t} />

                {isGood ? (
                  <div className="mt-4 rounded-xl bg-[#eef3ee] p-4">
                    <p className="text-[13px] leading-relaxed text-ink">
                      {t.improve.caseStudyGoodMsg}
                    </p>
                  </div>
                ) : (
                  <ActionChecklist entries={entries} resolvedActions={resolvedActions} onToggle={toggleAction} t={t} />
                )}

                {!isGood && currentFullyResolved && currentName && (
                  <CompletionBanner name={currentName} impact={currentEstimate?.impact ?? 0} t={t} />
                )}

                <NextButton
                  onClick={goNext}
                  label={t.improve.next}
                  onBack={stepIndex > 0 ? goBack : undefined}
                  backLabel={t.improve.back}
                />
              </>
            );
          })()}

          {step.kind === "done" && (
            <>
              <div className="celebration-pop flex flex-col items-center py-4 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#eef3ee]">
                  <CheckIcon className="size-5 text-accent-green" />
                </span>
                <p className="mt-4 font-serif-heading text-[22px]">
                  {doneStepCount === resolvableCount ? t.improve.doneAllTitle : t.improve.doneReviewedTitle}
                </p>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-42">
                  {t.improve.scoreChangedFrom} <span className="font-semibold text-ink">{baseScore}</span>{" "}
                  {t.improve.scoreChangedTo}{" "}
                  <span className="font-semibold text-accent-green">{runningScore}</span> {t.improve.estimated}
                </p>
                <p className="mt-4 text-[13px] text-ink-42">
                  {t.improve.redirecting}{" "}
                  <button
                    type="button"
                    onClick={onBackToResult}
                    className="font-medium text-accent-green hover:underline"
                  >
                    {t.improve.goNow}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </main>

      <style>{`
        @keyframes step-in {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .step-in { animation: step-in 260ms ease-out; }
        @keyframes check-pop {
          0% { transform: scale(0.4); opacity: 0; }
          60% { transform: scale(1.25); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .check-pop { animation: check-pop 260ms ease-out; }
        @keyframes celebration-pop {
          0% { opacity: 0; transform: scale(0.92) translateY(4px); }
          60% { opacity: 1; transform: scale(1.02) translateY(0); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        .celebration-pop { animation: celebration-pop 380ms cubic-bezier(0.22, 0.9, 0.35, 1); }
        @keyframes score-flash {
          0% { color: var(--accent-green); transform: scale(1.15); }
          100% { color: var(--ink); transform: scale(1); }
        }
        .score-flash { animation: score-flash 700ms ease-out; display: inline-block; }
        @media (prefers-reduced-motion: reduce) {
          .step-in, .check-pop, .celebration-pop, .score-flash { animation: none; }
        }
      `}</style>
    </div>
  );
}
