"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { CheckIcon, ChevronIcon } from "./icons";

function ChipToggle({
  value,
  onChange,
  options,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  options: string[];
}) {
  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors ${
              active
                ? "border-accent-green bg-accent-green text-white"
                : "border-ink-border bg-white text-ink-42 hover:border-ink/30"
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function FeedbackForm({
  seniority,
  semaphore,
  resolvedCount,
  totalActionable,
  onDismiss,
}: {
  seniority: string;
  semaphore: string;
  resolvedCount: number;
  totalActionable: number;
  onDismiss?: () => void;
}) {
  const { t } = useLocale();
  const [skipped, setSkipped] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => onDismiss?.(), 1800);
    return () => clearTimeout(timer);
  }, [submitted, onDismiss]);

  const [nps, setNps] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const [mostUseful, setMostUseful] = useState<string[]>([]);
  const [missingFeature, setMissingFeature] = useState("");
  const [friction, setFriction] = useState("");
  const [email, setEmail] = useState("");

  const canSubmit = nps !== null && accuracy !== null;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nps,
          accuracy,
          mostUseful: mostUseful.length ? mostUseful : undefined,
          missingFeature: missingFeature || undefined,
          friction: friction || undefined,
          email: email || undefined,
          seniority,
          semaphore,
          resolvedCount,
          totalActionable,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || t.feedback.errorFallback);
      }
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.feedback.errorFallback);
    } finally {
      setSubmitting(false);
    }
  }

  if (skipped) return null;

  if (submitted) {
    return (
      <div className="p-6 text-center">
        <p className="font-serif-heading text-[19px]">{t.feedback.thanksTitle}</p>
        <p className="mt-1.5 text-[13px] text-ink-42">{t.feedback.thanksSubtitle}</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <p className="label-mono">{t.feedback.title}</p>
      <p className="mt-1.5 font-serif-heading text-[19px]">{t.feedback.subtitle}</p>

      <div className="mt-5">
        <p className="text-[13px] font-medium text-ink">{t.feedback.npsQuestion}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Array.from({ length: 11 }, (_, i) => i).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNps(n)}
              className={`flex size-8 items-center justify-center rounded-lg border font-mono text-[12px] transition-colors ${
                nps === n
                  ? "border-ink bg-ink text-background"
                  : "border-ink-border bg-white text-ink-42 hover:border-ink/30"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-42">
          <span>{t.feedback.npsLow}</span>
          <span>{t.feedback.npsHigh}</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-[13px] font-medium text-ink">{t.feedback.accuracyQuestion}</p>
        <div className="mt-2 flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAccuracy(n)}
              className={`flex h-9 flex-1 items-center justify-center rounded-lg border font-mono text-[12px] transition-colors ${
                accuracy === n
                  ? "border-ink bg-ink text-background"
                  : "border-ink-border bg-white text-ink-42 hover:border-ink/30"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[11px] text-ink-42">
          <span>{t.feedback.accuracyLow}</span>
          <span>{t.feedback.accuracyHigh}</span>
        </div>
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-accent-green"
        >
          {t.feedback.expandToggle}
          <ChevronIcon className={`size-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
        </button>

        {expanded && (
          <div className="mt-4 flex flex-col gap-5">
            {totalActionable > 0 && (
              <div>
                <p className="text-[13px] font-medium text-ink">
                  {t.feedback.frictionQuestion(resolvedCount, totalActionable)}
                </p>
                <textarea
                  value={friction}
                  onChange={(e) => setFriction(e.target.value)}
                  rows={2}
                  placeholder={t.feedback.frictionPlaceholder}
                  className="mt-2 w-full resize-y rounded-lg border border-ink-border bg-white p-3 text-[13px] text-ink placeholder:text-ink-42/70"
                />
              </div>
            )}

            <div>
              <p className="text-[13px] font-medium text-ink">{t.feedback.mostUsefulQuestion}</p>
              <div className="mt-2">
                <ChipToggle value={mostUseful} onChange={setMostUseful} options={t.feedback.mostUsefulOptions} />
              </div>
            </div>

            <div>
              <p className="text-[13px] font-medium text-ink">{t.feedback.missingFeatureQuestion}</p>
              <textarea
                value={missingFeature}
                onChange={(e) => setMissingFeature(e.target.value)}
                rows={2}
                placeholder={t.feedback.missingFeaturePlaceholder}
                className="mt-2 w-full resize-y rounded-lg border border-ink-border bg-white p-3 text-[13px] text-ink placeholder:text-ink-42/70"
              />
            </div>

            <div>
              <p className="text-[13px] font-medium text-ink">{t.feedback.emailQuestion}</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.feedback.emailPlaceholder}
                className="mt-2 w-full rounded-lg border border-ink-border bg-white p-3 text-[13px] text-ink placeholder:text-ink-42/70"
              />
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-[13px] text-red-700">{error}</p>}

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[14px] font-medium text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? t.feedback.sending : t.feedback.submit}
          {!submitting && <CheckIcon className="size-3.5" />}
        </button>
        <button
          type="button"
          onClick={() => {
            setSkipped(true);
            onDismiss?.();
          }}
          className="text-[13px] font-medium text-ink-42 hover:text-ink"
        >
          {t.feedback.skip}
        </button>
      </div>
    </div>
  );
}
