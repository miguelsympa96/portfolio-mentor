"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, type EvaluationResult } from "@/lib/types";
import { buildSteps, priorityCategory, stepEstimate, stepResolvedFraction } from "@/lib/steps";
import { compositeScore } from "@/lib/scoring";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { AlertIcon, ArrowRightIcon, CheckIcon, FeedbackIcon, LinkedInIcon, WhatsAppIcon, XIcon } from "./icons";
import { FeedbackModal } from "./FeedbackModal";
import { InfoTooltip } from "./InfoTooltip";
import { BoldText } from "./BoldText";
import { InterviewPrepWaitlist } from "./InterviewPrepWaitlist";

const FEEDBACK_SHOWN_KEY = "portfolio-mentor-feedback-shown";
const FEEDBACK_AUTO_DELAY_MS = 1200;

const SEMAPHORE_TINT = {
  green: "bg-[#eef3ee] text-accent-green",
  yellow: "bg-[#f7f0e6] text-[#b8834a]",
  red: "bg-[#f7ece9] text-[#b5533c]",
} as const;
const JOB_FIT_BADGE = {
  alto: "bg-[#eef3ee] text-accent-green",
  medio: "bg-[#f7f0e6] text-[#b8834a]",
  bajo: "bg-[#f7ece9] text-[#b5533c]",
} as const;

const CONFETTI = [
  { tx: -50, ty: -55, txMid: -18, tyMid: -48, rot: -50, color: "var(--accent-green)", delay: 0, shape: "rounded-full" },
  { tx: 45, ty: -60, txMid: 8, tyMid: -55, rot: 45, color: "var(--accent-sage)", delay: 60, shape: "rounded-sm" },
  { tx: -60, ty: -10, txMid: -50, tyMid: -40, rot: -95, color: "#b8834a", delay: 120, shape: "rounded-full" },
  { tx: 60, ty: -15, txMid: 48, tyMid: -45, rot: 85, color: "var(--accent-green)", delay: 40, shape: "rounded-sm" },
];

function VerdictDot({ semaphore }: { semaphore: EvaluationResult["semaphore"] }) {
  const celebratory = semaphore === "green";

  return (
    <div className="relative mx-auto flex w-40 items-center justify-center">
      {celebratory &&
        CONFETTI.map((c, i) => (
          <span
            key={i}
            className={`confetti-piece absolute size-1 ${c.shape}`}
            style={
              {
                background: c.color,
                "--tx": `${c.tx}px`,
                "--ty": `${c.ty}px`,
                "--tx-mid": `${c.txMid}px`,
                "--ty-mid": `${c.tyMid}px`,
                "--rot": `${c.rot}deg`,
                animationDelay: `${c.delay}ms`,
              } as React.CSSProperties
            }
          />
        ))}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/raisemyportfolio.svg" alt="raisemyportfolio.com" className="relative h-auto w-36" />
    </div>
  );
}

const APP_URL = "https://raisemyportfolio.com";

// Deliberately generic: shares the tool, not the user's own verdict. A
// portfolio review is often a designer's weakest moment to broadcast, it
// can surface confidential client work and reads to recruiters as "I
// needed an AI to tell me what was wrong with my portfolio." So this
// recommends the resource without exposing anyone's specific score.
function ShareRow({ t }: { t: Dictionary }) {
  const shareText = `${t.result.shareQuestion} ${APP_URL}`;
  const whatsappHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(APP_URL)}`;
  const twitterHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(t.result.shareQuestion)}&url=${encodeURIComponent(APP_URL)}`;

  return (
    <div className="fixed inset-x-0 bottom-6 z-30 flex justify-center px-6">
      <div className="flex items-center gap-3 rounded-full border border-ink-border bg-white px-4 py-2.5 shadow-sm">
        <p className="hidden text-[13px] font-medium text-ink-42 sm:block">{t.result.shareQuestion}</p>
        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.result.whatsapp}
          className="inline-flex items-center text-ink-42 transition-opacity hover:opacity-80"
        >
          <WhatsAppIcon className="size-[18px]" />
        </a>
        <a
          href={linkedinHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.result.linkedin}
          className="inline-flex items-center text-ink-42 transition-opacity hover:opacity-80"
        >
          <LinkedInIcon className="size-[18px]" />
        </a>
        <a
          href={twitterHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t.result.twitter}
          className="inline-flex items-center text-ink-42 transition-opacity hover:opacity-80"
        >
          <XIcon className="size-[15px]" />
        </a>
      </div>
    </div>
  );
}

interface RoiItem {
  stepIndex: number;
  label: string;
  sublabel: string;
  impact: number;
  time: string;
}

function RoiRow({ index, item, checked, onClick }: { index: number; item: RoiItem; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-background"
    >
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-medium ${
          checked ? "bg-accent-green text-white" : "bg-background text-ink-42"
        }`}
      >
        {checked ? <CheckIcon className="size-3" /> : index + 1}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[14px] font-medium ${checked ? "text-ink-42 line-through" : "text-ink"}`}>
          {item.label}
        </span>
        <span className="block text-[12px] text-ink-42">
          {item.sublabel} · {item.time}
        </span>
      </span>
      <span className={`shrink-0 font-mono text-[12px] font-semibold ${checked ? "text-ink-42" : "text-accent-green"}`}>
        +{item.impact}
      </span>
    </button>
  );
}

export function ResultScreen({
  result,
  previousResult,
  seniority,
  resolvedActions,
  onImprove,
  onReset,
  onRescan,
}: {
  result: EvaluationResult;
  previousResult?: EvaluationResult | null;
  seniority: string;
  resolvedActions: Set<string>;
  onImprove: (stepIndex?: number) => void;
  onReset: () => void;
  onRescan: () => void;
}) {
  const { t } = useLocale();
  const score = compositeScore(result);

  const [notesTab, setNotesTab] = useState<"favor" | "dudas">(
    result.strengths.length > 0 ? "favor" : "dudas"
  );
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  const steps = buildSteps(result);
  const topFix = priorityCategory(result);
  const topFixMeta = topFix ? t.categories[topFix.key] : undefined;

  const roiItems: RoiItem[] = [];
  if (topFix && topFixMeta) {
    const stepIndex = steps.findIndex((s) => s.kind === "priority");
    const step = steps[stepIndex];
    const est = step ? stepEstimate(result, step) : null;
    if (est) {
      roiItems.push({ stepIndex, label: topFixMeta.label, sublabel: t.result.priorityLabel, impact: est.impact, time: est.time });
    }
  }
  result.caseStudies.forEach((cs, i) => {
    if (cs.recommendation === "mantener") return;
    const stepIndex = steps.findIndex((s) => s.kind === "casestudy" && s.index === i);
    const step = steps[stepIndex];
    const est = step ? stepEstimate(result, step) : null;
    if (est) {
      roiItems.push({
        stepIndex,
        label: cs.name,
        sublabel: t.improve.caseStudyRecommendation[cs.recommendation],
        impact: est.impact,
        time: est.time,
      });
    }
  });
  roiItems.sort((a, b) => b.impact - a.impact);

  const itemFraction = (item: RoiItem) =>
    stepResolvedFraction(result, steps[item.stepIndex], item.stepIndex, resolvedActions);
  const isItemDone = (item: RoiItem) => itemFraction(item) === 1;

  const doneCount = roiItems.filter(isItemDone).length;
  // Credits partial progress: checking 1 of 2 actions in a fix counts for
  // half its points instead of withholding all of them until every action
  // in that fix is done. Also credits already-resolved fixes into the
  // headline number (same estimate ImproveFlow's own "done" screen shows),
  // so finishing checklist items is reflected here instead of staying
  // frozen at the original analysis.
  const totalImpact = roiItems.reduce((sum, item) => sum + item.impact, 0);
  const doneImpact = roiItems.reduce((sum, item) => sum + item.impact * itemFraction(item), 0);
  const runningScore = Math.min(100, Math.round(score + doneImpact));
  const potential = Math.min(100, Math.round(score + totalImpact));
  const remainingCount = roiItems.length - doneCount;
  // Once every suggested fix is checked off, the original verdict/semaphore
  // (frozen from the first analysis) would otherwise sit next to a much
  // improved estimated score, reading as "still risky" when it's not
  // necessarily true anymore. Swap to a neutral state that points at the
  // real re-scan instead of guessing a new semaphore from the score alone.
  const allResolved = roiItems.length > 0 && remainingCount === 0;

  // Only prompt once the candidate has actually resolved every suggested
  // fix, asking for feedback the moment they land on their first result
  // is invasive and premature; asking right after they've done the work
  // is the moment they have the most to say.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(FEEDBACK_SHOWN_KEY)) return;
    if (roiItems.length === 0 || doneCount < roiItems.length) return;
    const timer = setTimeout(() => {
      window.localStorage.setItem(FEEDBACK_SHOWN_KEY, "1");
      setFeedbackOpen(true);
    }, FEEDBACK_AUTO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [doneCount, roiItems.length]);

  const heroLength =
    result.verdictHeadline.line1.replace(/\*\*/g, "").length +
    result.verdictHeadline.line2.replace(/\*\*/g, "").length;
  const heroTextSize =
    heroLength > 140
      ? "text-[21px] sm:text-[25px]"
      : heroLength > 95
      ? "text-[24px] sm:text-[29px]"
      : "text-[28px] sm:text-[34px]";

  return (
    <div className="relative flex min-h-screen flex-col items-center px-6 pb-28 pt-16 sm:pb-32 sm:pt-24">
      <main className="flex w-full max-w-[560px] flex-col items-center gap-6">
        {result._mock && (
          <div className="w-full rounded-xl bg-[#f7f0e6] px-4 py-2.5 text-center text-xs font-medium text-[#6b4d26]">
            {t.result.mockBanner}
          </div>
        )}

        {/* Hero verdict */}
        <div className="w-full text-center">
          <VerdictDot semaphore={allResolved ? "green" : result.semaphore} />
          {allResolved ? (
            <>
              <h1 className={`mt-3 text-balance font-serif-heading leading-[1.15] ${heroTextSize}`}>
                {t.result.allFixedHeadline}
              </h1>
              <h1 className={`text-balance font-serif-heading leading-[1.15] text-ink-42 ${heroTextSize}`}>
                {t.result.allFixedSubtitle}
              </h1>
            </>
          ) : (
            <>
              <h1 className={`mt-3 text-balance font-serif-heading leading-[1.15] ${heroTextSize}`}>
                <BoldText text={result.verdictHeadline.line1} />
              </h1>
              <h1 className={`text-balance font-serif-heading leading-[1.15] text-ink-42 ${heroTextSize}`}>
                <BoldText text={result.verdictHeadline.line2} />
              </h1>
            </>
          )}
          {result.jobFit && (
            <span
              className={`mt-4 inline-block rounded-full px-3 py-1 text-xs font-semibold ${JOB_FIT_BADGE[result.jobFit.level]}`}
            >
              {t.result.jobFit[result.jobFit.level]}
            </span>
          )}
          {remainingCount > 0 && (
            <p className="label-mono mt-4">{t.result.problemsCount(remainingCount)}</p>
          )}
          {previousResult && (
            <div className="mt-4 w-full rounded-xl bg-[#eef3ee] px-4 py-3 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-accent-green">
                {t.result.rescanComparisonTitle}
              </p>
              <p className="mt-1 text-[15px] font-medium text-ink">
                {t.result.rescanScoreChanged(compositeScore(previousResult), compositeScore(result))}
              </p>
            </div>
          )}
        </div>

        {/* Score */}
        <div className="w-full rounded-2xl border border-ink-border bg-white p-6">
          <div className="flex items-start justify-between">
            <div>
              <span className="font-serif-heading text-[44px] leading-none">{score}</span>
              <span className="text-[18px] text-ink-42">/100</span>
              {runningScore > score && (
                <span className="ml-1.5 text-[13px] text-ink-42">
                  {t.improve.ptsEstimate(runningScore - score)}
                </span>
              )}
            </div>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                allResolved ? "bg-[#eef3ee] text-accent-green" : SEMAPHORE_TINT[result.semaphore]
              }`}
            >
              {allResolved ? t.result.allFixedBadge : t.result.semaphore[result.semaphore]}
            </span>
          </div>
          {result.benchmark && (
            <p className="mt-1.5 text-[13px] font-medium text-accent-green">
              {t.result.benchmarkLabel(result.benchmark.percentile)}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <p className="label-mono">{t.result.scoreLabel}</p>
            <InfoTooltip label={t.result.categoriesInfoLabel}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-62">
                {t.result.categoriesInfoTitle}
              </p>
              <ul className="mt-2 flex flex-col gap-1.5">
                {CATEGORIES.map((c) => (
                  <li key={c.key} className="flex items-center justify-between gap-3 text-[13px] text-ink">
                    <span>{t.categories[c.key].label}</span>
                    <span className="font-mono text-[11px] text-ink-42">{c.weight}%</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-ink-border pt-3 text-[12px] leading-relaxed text-ink-42">
                {t.result.methodologyNote}
              </p>
            </InfoTooltip>
          </div>

          {potential > score && (
            <>
              <div className="relative mt-4 h-1.5 w-full overflow-hidden rounded-full bg-ink-border">
                <div className="absolute inset-y-0 left-0 rounded-full bg-accent-green" style={{ width: `${score}%` }} />
                <div
                  className="absolute inset-y-0 rounded-full bg-accent-sage/50"
                  style={{ left: `${score}%`, width: `${potential - score}%` }}
                />
              </div>
              <p className="mt-2 text-[13px] text-ink-42">
                {t.result.potentialPrefix} <span className="font-semibold text-ink">{potential}/100</span>{" "}
                {t.result.potentialSuffix(remainingCount)}
              </p>
            </>
          )}
        </div>

        {/* Recruiter notes */}
        {(result.strengths.length > 0 || result.keyRisks.length > 0) && (
          <div className="w-full rounded-2xl border border-ink-border bg-white p-6 text-left">
            <div className="flex items-center justify-between">
              <p className="label-mono">{t.result.notesTitle}</p>
              <div className="inline-flex rounded-full border border-ink-border bg-background p-0.5">
                {result.strengths.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNotesTab("favor")}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      notesTab === "favor" ? "bg-accent-green text-white" : "text-ink-42"
                    }`}
                  >
                    {t.result.favorTab(result.strengths.length)}
                  </button>
                )}
                {result.keyRisks.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setNotesTab("dudas")}
                    className={`rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                      notesTab === "dudas" ? "bg-[#b5533c] text-white" : "text-ink-42"
                    }`}
                  >
                    {t.result.dudasTab(result.keyRisks.length)}
                  </button>
                )}
              </div>
            </div>

            {notesTab === "favor" && result.strengths.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {result.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink">
                    <CheckIcon className="mt-1 size-3 shrink-0 text-accent-green" />
                    <BoldText text={s} />
                  </li>
                ))}
              </ul>
            )}
            {notesTab === "dudas" && result.keyRisks.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {result.keyRisks.map((r, i) => (
                  <li key={i} className="flex gap-2 text-[13px] leading-relaxed text-ink">
                    <AlertIcon className="mt-0.5 size-3 shrink-0 text-[#b5533c]" />
                    <span>&ldquo;<BoldText text={r} />&rdquo;</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* ROI improvements */}
        {roiItems.length > 0 && (
          <div className="w-full rounded-2xl border border-ink-border bg-white p-4 text-left">
            <div className="flex items-center justify-between px-2 pb-1">
              <p className="label-mono">{t.result.roiTitle}</p>
              <p className="text-[12px] text-ink-42">
                {doneCount}/{roiItems.length}
              </p>
            </div>
            <div className="flex flex-col">
              {roiItems.map((item, i) => (
                <RoiRow
                  key={item.stepIndex}
                  index={i}
                  item={item}
                  checked={isItemDone(item)}
                  onClick={() => onImprove(item.stepIndex)}
                />
              ))}
            </div>
          </div>
        )}

        <InterviewPrepWaitlist seniority={seniority} />

        <div className="mt-2 flex w-full flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => onImprove()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-7 py-4 text-[15px] font-medium text-background transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            {t.result.fixCta}
            <ArrowRightIcon className="size-[15px]" />
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRescan}
              className="text-[13px] font-medium text-ink-42 hover:text-ink"
            >
              {t.result.rescanCta}
            </button>
            <span className="h-3 w-px bg-ink-border" />
            <button
              type="button"
              onClick={onReset}
              className="text-[13px] font-medium text-ink-42 hover:text-ink"
            >
              {t.result.resetCta}
            </button>
          </div>
        </div>
      </main>

      <ShareRow t={t} />

      <button
        type="button"
        onClick={() => setFeedbackOpen(true)}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 rounded-full border border-ink-border bg-white px-4 py-2.5 text-[13px] font-medium text-ink shadow-sm hover:border-ink/30"
      >
        <FeedbackIcon className="size-[15px]" />
        {t.result.feedbackButton}
      </button>

      <FeedbackModal
        open={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
        seniority={seniority}
        semaphore={result.semaphore}
        resolvedCount={doneCount}
        totalActionable={roiItems.length}
      />

      <style>{`
        @keyframes confetti-piece {
          0% { transform: translate(0, 0) rotate(0deg) scale(1); opacity: 1; }
          55% { transform: translate(var(--tx-mid), var(--ty-mid)) rotate(calc(var(--rot) * 0.65)) scale(0.85); opacity: 0.9; }
          100% { transform: translate(var(--tx), var(--ty)) rotate(var(--rot)) scale(0.35); opacity: 0; }
        }
        .confetti-piece {
          animation: confetti-piece 1050ms cubic-bezier(0.22, 0.7, 0.35, 1) forwards;
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.45; }
          100% { transform: scale(1.7); opacity: 0; }
        }
        .pulse-ring {
          animation: pulse-ring 1.8s ease-out 2;
        }
        @media (prefers-reduced-motion: reduce) {
          .confetti-piece, .pulse-ring { animation: none; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
