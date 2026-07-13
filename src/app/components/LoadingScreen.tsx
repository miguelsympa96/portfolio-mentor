"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { DocumentIcon } from "./icons";

// Gaps between steps (ms), one shorter than the step count — spread across a
// realistic total wait so steps don't all finish in the first 12s and then
// sit stalled on the last one. The real call to Claude can take 60-170s
// (a validation retry doubles it occasionally), so there are two reassurance
// tiers rather than one, otherwise the same "still working" message sits
// unchanged for over a minute and starts reading as actually stuck.
const STEP_GAPS_MS = [1800, 2200, 2600, 3000, 3400, 3800, 4200];
const LONG_WAIT_MS = 14000;
const VERY_LONG_WAIT_MS = 45000;

interface LoadingScreenProps {
  previewImage?: string | null;
  previewIsPdf?: boolean;
}

// Deliberately not a percentage bar — there's no real progress fraction to
// report (the steps are paced on a timer, not tied to actual backend
// milestones), so a literal progress bar would imply a precision that
// doesn't exist. Two dots orbiting at different radii/speeds/directions
// reads as "quietly working" without claiming to measure anything.
function OrbitIndicator() {
  return (
    <div className="relative mx-auto mb-10 h-14 w-14 md:mx-0">
      <div className="orbit-a absolute inset-0">
        <span className="absolute left-1/2 top-0 size-2 -translate-x-1/2 rounded-full bg-accent-green" />
      </div>
      <div className="orbit-b absolute inset-[10px]">
        <span className="absolute left-1/2 top-0 size-1.5 -translate-x-1/2 rounded-full bg-accent-sage" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="size-2 rounded-full bg-ink/15" />
      </div>
    </div>
  );
}

function PreviewCard({ previewImage, previewIsPdf }: LoadingScreenProps) {
  const { t } = useLocale();
  const ready = !!previewImage || !!previewIsPdf;

  return (
    <div className="preview-in relative overflow-hidden rounded-xl border border-ink-border bg-white shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-ink-border bg-[#f7f6f2] px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5988c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#e5c98c]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#9dc9a8]" />
      </div>
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[#f7f6f2]">
        {!ready && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-ink-border border-t-accent-green" />
            <span className="text-[11px] text-ink-42">{t.loading.previewLoading}</span>
          </div>
        )}
        {previewIsPdf && (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-ink-42">
            <DocumentIcon className="size-7" />
            <span className="text-[12px]">PDF</span>
          </div>
        )}
        {!previewIsPdf && previewImage && (
          // eslint-disable-next-line @next/next/no-img-element -- data URL / remote screenshot, not an optimizable local asset
          <img src={previewImage} alt="" className="h-full w-full object-cover object-top" />
        )}
        {!previewIsPdf && previewImage && (
          <div className="scan-line pointer-events-none absolute inset-x-0 h-1/3 bg-gradient-to-b from-transparent via-accent-green/25 to-transparent" />
        )}
      </div>
    </div>
  );
}

export function LoadingScreen({ previewImage, previewIsPdf }: LoadingScreenProps) {
  const { t } = useLocale();
  const [stepIndex, setStepIndex] = useState(0);
  const [waitTier, setWaitTier] = useState<0 | 1 | 2>(0);
  const [displayIndex, setDisplayIndex] = useState(0);
  const [phraseVisible, setPhraseVisible] = useState(true);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;
    STEP_GAPS_MS.forEach((gap, i) => {
      cumulative += gap;
      timers.push(setTimeout(() => setStepIndex(i + 1), cumulative));
    });
    timers.push(setTimeout(() => setWaitTier(1), cumulative + LONG_WAIT_MS));
    timers.push(setTimeout(() => setWaitTier(2), cumulative + LONG_WAIT_MS + VERY_LONG_WAIT_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Only one phrase on screen at a time: fade the current one out, swap the
  // text while it's invisible, then fade the new one in. Skips the fade on
  // the very first render so the initial phrase doesn't flash in from blank.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayIndex(stepIndex);
      return;
    }
    setPhraseVisible(false);
    const t = setTimeout(() => {
      setDisplayIndex(stepIndex);
      setPhraseVisible(true);
    }, 250);
    return () => clearTimeout(t);
  }, [stepIndex]);

  const steps = t.loading.steps;
  const currentStep = steps[Math.min(displayIndex, steps.length - 1)];

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-4xl grid-cols-1 items-start gap-10 md:grid-cols-2 md:gap-14">
        <div className="mx-auto w-full max-w-md">
          <OrbitIndicator />

          <h1 className="mb-2 text-center font-serif-heading text-[26px] sm:text-[30px] md:text-left">
            {t.loading.heading}
          </h1>
          <p className="mb-2 text-center text-[13px] text-ink-42 md:text-left">
            {t.loading.subtitle}
          </p>
          <p className="mb-8 text-center text-[12px] text-ink-42/80 md:text-left">
            {t.loading.notifyHint}
          </p>

          <div className="flex min-h-[24px] items-center justify-center gap-2.5 md:justify-start">
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-accent-green" />
            <p
              className={`text-[14px] font-medium text-ink transition-all duration-300 ${
                phraseVisible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
              }`}
            >
              {currentStep}
            </p>
          </div>

          {waitTier > 0 && (
            <p className="mt-6 text-center text-[13px] text-ink-42 md:text-left">
              {waitTier === 1 ? t.loading.longWait : t.loading.veryLongWait}
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-md md:mt-[52px]">
          <PreviewCard previewImage={previewImage} previewIsPdf={previewIsPdf} />
        </div>
      </div>

      <style>{`
        @keyframes orbit-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .orbit-a {
          animation: orbit-spin 3.2s linear infinite;
        }
        .orbit-b {
          animation: orbit-spin 4.6s linear infinite reverse;
        }
        @keyframes scan-line-sweep {
          0% { transform: translateY(-100%); }
          100% { transform: translateY(400%); }
        }
        .scan-line {
          animation: scan-line-sweep 2.2s ease-in-out infinite;
        }
        @keyframes preview-fade-in {
          0% { opacity: 0; transform: scale(0.97); }
          100% { opacity: 1; transform: scale(1); }
        }
        .preview-in {
          animation: preview-fade-in 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
