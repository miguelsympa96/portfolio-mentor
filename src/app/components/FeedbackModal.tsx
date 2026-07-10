"use client";

import { useEffect } from "react";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { FeedbackForm } from "./FeedbackForm";

export function FeedbackModal({
  open,
  onClose,
  seniority,
  semaphore,
  resolvedCount,
  totalActionable,
}: {
  open: boolean;
  onClose: () => void;
  seniority: string;
  semaphore: string;
  resolvedCount: number;
  totalActionable: number;
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-fade fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-pop relative flex w-full max-w-[520px] max-h-[85vh] flex-col overflow-y-auto rounded-2xl border border-ink-border bg-white shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.feedback.close}
          className="fixed right-6 top-6 z-10 flex size-8 items-center justify-center rounded-full border border-ink-border bg-white text-ink-42 shadow-sm hover:text-ink"
        >
          ✕
        </button>
        <FeedbackForm
          seniority={seniority}
          semaphore={semaphore}
          resolvedCount={resolvedCount}
          totalActionable={totalActionable}
          onDismiss={onClose}
        />
      </div>

      <style>{`
        @keyframes modal-fade { 0% { opacity: 0; } 100% { opacity: 1; } }
        @keyframes modal-pop { 0% { opacity: 0; transform: scale(0.96) translateY(8px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
        .modal-fade { animation: modal-fade 180ms ease-out; }
        .modal-pop { animation: modal-pop 220ms cubic-bezier(0.22, 0.9, 0.35, 1); }
        @media (prefers-reduced-motion: reduce) {
          .modal-fade, .modal-pop { animation: none; }
        }
      `}</style>
    </div>
  );
}
