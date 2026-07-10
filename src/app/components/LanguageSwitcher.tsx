"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { SUPPORTED_LOCALES, langName } from "@/lib/i18n/locale";

export function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 left-6 z-40">
      {open && (
        <div className="mb-2 flex flex-col overflow-hidden rounded-2xl border border-ink-border bg-white shadow-sm">
          {SUPPORTED_LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => {
                setLocale(l);
                setOpen(false);
              }}
              className={`px-4 py-2 text-left text-[13px] font-medium transition-colors ${
                l === locale ? "bg-background text-ink" : "text-ink-42 hover:bg-background"
              }`}
            >
              {langName(l)}
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Language"
        className="rounded-full border border-ink-border bg-white px-4 py-2.5 text-[13px] font-medium uppercase text-ink shadow-sm hover:border-ink/30"
      >
        {locale}
      </button>
    </div>
  );
}
