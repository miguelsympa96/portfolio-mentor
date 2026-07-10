"use client";

import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ArrowRightIcon } from "./icons";
import { BoldText } from "./BoldText";

export function HomeScreen({ onStart }: { onStart: () => void }) {
  const { t } = useLocale();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-6 py-16 sm:py-24">
      <main className="relative flex w-full max-w-[660px] flex-col items-center text-center">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static wordmark, not worth the Image component overhead */}
          <img src="/raisemyportfolio.svg" alt="raisemyportfolio.com" className="mx-auto mb-6 h-auto w-[170px]" />
          <h1 className="font-serif-heading text-[32px] font-normal leading-[1.15] sm:text-[42px] sm:leading-[1.15] lg:text-[52.8px] lg:leading-[1.13] lg:tracking-[-0.528px]">
            {t.home.heading1}
            <br />
            <span className="font-semibold">{t.home.heading2}</span>
          </h1>

          <div className="mx-auto mt-5 text-[15px] leading-[1.7] text-ink-42 sm:text-[16.8px]">
            <p className="sm:whitespace-nowrap">
              <BoldText text={t.home.subtitleLine1} />
            </p>
            <p className="mx-auto max-w-[490px]">{t.home.subtitleLine2}</p>
          </div>

          <div className="mt-12 flex justify-center">
            <button
              type="button"
              onClick={onStart}
              className="inline-flex items-center gap-2.5 rounded-full bg-ink px-7 py-3.5 text-[15px] font-medium text-background transition-opacity hover:opacity-90"
            >
              {t.home.cta}
              <ArrowRightIcon className="size-[15px]" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
