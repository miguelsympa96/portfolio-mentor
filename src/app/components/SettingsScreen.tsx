"use client";

import { useState } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { ArrowLeftIcon, ArrowRightIcon, ChevronIcon, ImageIcon, LinkIcon, UploadIcon } from "./icons";

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
  size = "md",
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  size?: "md" | "sm";
}) {
  return (
    <div className="inline-flex items-start gap-1 rounded-full border border-ink-border bg-white p-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`inline-flex items-center gap-1.5 rounded-full font-mono text-[11px] transition-colors ${
              size === "md" ? "px-4 py-1.5" : "px-4 py-1.5"
            } ${active ? "bg-accent-green text-white" : "text-ink-42"}`}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsScreen({
  seniority,
  setSeniority,
  url,
  setUrl,
  images,
  onFilesSelected,
  onRemoveImage,
  jobDescription,
  setJobDescription,
  showJobDescription,
  setShowJobDescription,
  canSubmit,
  onSubmit,
  onBack,
  error,
}: {
  seniority: string;
  setSeniority: (v: string) => void;
  url: string;
  setUrl: (v: string) => void;
  images: { name: string; dataUrl: string }[];
  onFilesSelected: (files: FileList | null) => void;
  onRemoveImage: (index: number) => void;
  jobDescription: string;
  setJobDescription: (v: string) => void;
  showJobDescription: boolean;
  setShowJobDescription: (v: boolean) => void;
  canSubmit: boolean;
  onSubmit: () => void;
  onBack: () => void;
  error: string | null;
}) {
  const { t } = useLocale();
  const [portfolioMode, setPortfolioMode] = useState<"url" | "archivo">(
    "url"
  );
  const [jdMode, setJdMode] = useState<"url" | "texto">("url");

  const seniorityOptions = (["junior", "mid", "senior", "staff"] as const).map((value) => ({
    value,
    ...t.settings.seniorityOptions[value],
  }));

  return (
    <div className="flex min-h-screen flex-col items-center px-6 py-16 sm:py-24">
      <main className="flex w-full max-w-[660px] flex-col">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-42 hover:text-ink"
          >
            <ArrowLeftIcon className="size-3" />
            {t.settings.back}
          </button>
          <h1 className="font-serif-heading text-[28px] leading-[1.13] sm:text-[34px] lg:text-[40px] lg:tracking-[-0.4px]">
            {t.settings.title}
          </h1>
          <p className="mt-2 text-[14px] text-ink-42 sm:text-[15.2px]">
            {t.settings.subtitle}
          </p>
        </div>

        {/* Portfolio */}
        <div className="mt-10">
          <p className="label-mono">{t.settings.portfolioLabel}</p>
          <div className="mt-4">
            <SegmentedToggle
              value={portfolioMode}
              onChange={setPortfolioMode}
              options={[
                { value: "url", label: t.settings.urlTab, icon: <LinkIcon className="size-3" /> },
                { value: "archivo", label: t.settings.fileTab, icon: <ImageIcon className="size-3" /> },
              ]}
            />
          </div>

          <div className="mt-4">
            {portfolioMode === "url" ? (
              <div className="relative">
                <LinkIcon className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-ink-42" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder={t.settings.urlPlaceholder}
                  className="w-full rounded-[14px] border border-ink-border bg-white py-3.5 pl-10 pr-4 text-[13px] text-ink placeholder:text-ink-42/70"
                />
              </div>
            ) : (
              <label className="flex min-h-[158px] w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-ink-border bg-white p-10 text-center">
                <UploadIcon className="size-6 text-ink-42" />
                <div>
                  <p className="text-[14px] text-ink">
                    {t.settings.fileDropTitle}
                  </p>
                  <p className="mt-1 text-[12px] text-ink-42">
                    {t.settings.fileDropHint}
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  multiple
                  className="hidden"
                  disabled={images.length >= 5}
                  onChange={(e) => onFilesSelected(e.target.files)}
                />
              </label>
            )}

            {images.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {images.map((img, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-[13px] text-ink"
                  >
                    <span className="truncate">{img.name}</span>
                    <button
                      type="button"
                      onClick={() => onRemoveImage(i)}
                      className="ml-2 text-ink-42 hover:text-ink"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Oferta de trabajo (colapsable) */}
        <div className="mt-10">
          <p className="label-mono">{t.settings.jobOfferLabel}</p>
          <div className="mt-3 overflow-hidden rounded-2xl border border-ink-border">
          <button
            type="button"
            onClick={() => setShowJobDescription(!showJobDescription)}
            className="flex w-full items-center justify-between bg-white px-5 py-4 text-left"
          >
            <div className="flex items-center gap-3">
              <span
                className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                  showJobDescription ? "border-accent-green" : "border-accent-green/20"
                }`}
              >
                {showJobDescription && (
                  <span className="size-2 rounded-full bg-accent-green" />
                )}
              </span>
              <div>
                <p className="text-[14px] font-medium text-ink">
                  {t.settings.jobOfferToggleTitle}
                </p>
                <p className="text-[12px] font-medium text-ink-42">
                  {t.settings.jobOfferToggleSubtitle}
                </p>
              </div>
            </div>
            <ChevronIcon
              className={`size-3.5 shrink-0 text-ink-42 transition-transform ${
                showJobDescription ? "rotate-90" : ""
              }`}
            />
          </button>

          {showJobDescription && (
            <div className="border-t border-ink-border bg-white px-5 pb-5 pt-5">
              <p className="text-[13px] leading-relaxed text-ink-42">
                {t.settings.jobOfferHint}
              </p>

              <div className="mt-4">
                <SegmentedToggle
                  size="sm"
                  value={jdMode}
                  onChange={setJdMode}
                  options={[
                    { value: "url", label: t.settings.jdUrlTab },
                    { value: "texto", label: t.settings.jdTextTab },
                  ]}
                />
              </div>

              <div className="mt-4">
                {jdMode === "url" ? (
                  <div className="relative">
                    <LinkIcon className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-ink-42" />
                    <input
                      type="text"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                      placeholder={t.settings.jdUrlPlaceholder}
                      className="w-full rounded-[14px] border border-ink-border bg-white py-3.5 pl-10 pr-4 text-[13px] text-ink placeholder:text-ink-42/70"
                    />
                  </div>
                ) : (
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder={t.settings.jdTextPlaceholder}
                    rows={5}
                    className="w-full resize-y rounded-[14px] border border-ink-border bg-white p-4 text-[13px] text-ink placeholder:text-ink-42/70"
                  />
                )}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Nivel objetivo */}
        <div className="mt-10">
          <p className="label-mono">{t.settings.seniorityLabel}</p>
          {jobDescription.trim().length > 0 ? (
            <p className="mt-2 text-[12px] text-ink-42">
              {t.settings.seniorityInferredHint}
            </p>
          ) : (
            <p className="mt-2 text-[12px] text-ink-42">
              {t.settings.seniorityFreeHint}
            </p>
          )}
          <div
            className={`mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 transition-opacity ${
              jobDescription.trim().length > 0 ? "pointer-events-none opacity-40" : ""
            }`}
          >
            {seniorityOptions.map((o) => {
              const active = seniority === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  disabled={jobDescription.trim().length > 0}
                  onClick={() => setSeniority(o.value)}
                  className={`rounded-[14px] border p-[15px] text-left transition-colors ${
                    active
                      ? "border-ink bg-ink"
                      : "border-ink-border bg-white hover:border-ink/30"
                  }`}
                >
                  <p
                    className={`text-[14px] font-semibold ${active ? "text-background" : "text-ink"}`}
                  >
                    {o.label}
                  </p>
                  <p
                    className={`mt-0.5 font-mono text-[11px] ${active ? "text-background/60" : "text-ink-42"}`}
                  >
                    {o.years}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Acciones */}
        <div className="mt-10">
          <button
            id="submit-evaluate"
            type="button"
            disabled={!canSubmit}
            onClick={onSubmit}
            className={`inline-flex items-center gap-2 rounded-full px-7 py-3.5 text-[15px] font-medium text-background transition-opacity ${
              canSubmit ? "bg-ink hover:opacity-90" : "cursor-not-allowed bg-ink/42"
            }`}
          >
            {t.settings.submit}
            <ArrowRightIcon className="size-[15px]" />
          </button>
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-700">{error}</p>
        )}
      </main>
    </div>
  );
}
