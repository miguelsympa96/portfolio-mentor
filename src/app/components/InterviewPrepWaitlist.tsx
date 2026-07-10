"use client";

import { useState, type FormEvent } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CheckIcon } from "./icons";

export function InterviewPrepWaitlist({ seniority }: { seniority: string }) {
  const { t, locale } = useLocale();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, feature: "interview_prep", seniority, locale }),
      });
      if (!res.ok) throw new Error();
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  if (status === "done") {
    return (
      <div className="w-full rounded-2xl border border-ink-border bg-white p-6 text-center">
        <span className="mx-auto flex size-9 items-center justify-center rounded-full bg-[#eef3ee]">
          <CheckIcon className="size-4 text-accent-green" />
        </span>
        <p className="mt-3 text-[14px] font-medium text-ink">{t.result.waitlistSuccess}</p>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-ink-border bg-white p-6 text-center">
      <p className="font-serif-heading text-[20px]">{t.result.waitlistTitle}</p>
      <p className="mx-auto mt-2 max-w-[400px] text-[13px] leading-relaxed text-ink-42">
        {t.result.waitlistSubtitle}
      </p>
      <form onSubmit={handleSubmit} className="mx-auto mt-4 flex max-w-[380px] flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t.result.waitlistPlaceholder}
          className="w-full rounded-full border border-ink-border bg-background px-4 py-2.5 text-[13px] text-ink outline-none focus:border-ink/30"
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="shrink-0 rounded-full bg-ink px-5 py-2.5 text-[13px] font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {t.result.waitlistCta}
        </button>
      </form>
      {status === "error" && <p className="mt-2 text-[12px] text-[#b5533c]">{t.result.waitlistError}</p>}
    </div>
  );
}
