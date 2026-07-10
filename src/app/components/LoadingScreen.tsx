"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";

// Gaps between steps (ms), one shorter than the step count — spread across a
// realistic total wait (real evaluation runs ~20-45s) so steps don't all
// finish in the first 12s and then sit stalled on the last one.
const STEP_GAPS_MS = [1800, 2200, 2600, 3000, 3400, 3800, 4200];
const LONG_WAIT_MS = 14000;

export function LoadingScreen() {
  const { t } = useLocale();
  const [stepIndex, setStepIndex] = useState(0);
  const [longWait, setLongWait] = useState(false);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let cumulative = 0;
    STEP_GAPS_MS.forEach((gap, i) => {
      cumulative += gap;
      timers.push(setTimeout(() => setStepIndex(i + 1), cumulative));
    });
    timers.push(setTimeout(() => setLongWait(true), cumulative + LONG_WAIT_MS));
    return () => timers.forEach(clearTimeout);
  }, []);

  const steps = t.loading.steps;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6">
      <div className="relative w-full max-w-md">
        <div className="mb-10 h-[3px] w-full overflow-hidden rounded-full bg-ink-border">
          <div className="h-full w-1/3 animate-[loading-slide_1.4s_ease-in-out_infinite] bg-accent-green" />
        </div>

        <h1 className="mb-2 text-center font-serif-heading text-[26px] sm:text-[30px]">
          {t.loading.heading}
        </h1>
        <p className="mb-8 text-center text-[13px] text-ink-42">
          {t.loading.subtitle}
        </p>

        <ul className="flex flex-col gap-3">
          {steps.map((step, i) => {
            const isDone = i < stepIndex;
            const isActive = i === stepIndex;
            return (
              <li
                key={step}
                className={`flex items-center gap-3 text-[13px] transition-opacity duration-300 ${
                  isDone || isActive ? "opacity-100" : "opacity-35"
                }`}
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${
                    isDone
                      ? "bg-accent-green text-white"
                      : isActive
                      ? "border-2 border-accent-green"
                      : "border border-ink-border"
                  }`}
                >
                  {isDone ? "✓" : ""}
                  {isActive && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-accent-green" />
                  )}
                </span>
                <span className={isActive ? "font-medium text-ink" : "text-ink-42"}>
                  {step}
                </span>
              </li>
            );
          })}
        </ul>

        {longWait && (
          <p className="mt-6 text-center text-[13px] text-ink-42">
            {t.loading.longWait}
          </p>
        )}
      </div>

      <style>{`
        @keyframes loading-slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
