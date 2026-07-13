"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { EvaluationResult } from "@/lib/types";
import { saveSession, loadSession, clearSession } from "@/lib/session";
import { HomeScreen } from "./components/HomeScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { LoadingScreen } from "./components/LoadingScreen";
import { ResultScreen } from "./components/ResultScreen";
import { ImproveFlow } from "./components/ImproveFlow";
import { AmbientFlowField } from "./components/AmbientFlowField";
import { LanguageSwitcher } from "./components/LanguageSwitcher";
import { useLocale } from "@/lib/i18n/LocaleProvider";
import { unlockAudioForCompletionSound, playCompletionSound, flashTitleUntilFocused } from "@/lib/notify";

type View = "home" | "settings" | "loading" | "result" | "improve";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const { locale, t } = useLocale();
  const [view, setView] = useState<View>("home");
  const [seniority, setSeniority] = useState("");
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>(
    []
  );
  const [url, setUrl] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [showJobDescription, setShowJobDescription] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [previousResult, setPreviousResult] = useState<EvaluationResult | null>(null);
  const [resolvedActions, setResolvedActions] = useState<Set<string>>(new Set());
  const [improveStartStep, setImproveStartStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewIsPdf, setPreviewIsPdf] = useState(false);

  // Restore a completed analysis after an accidental reload — re-running
  // the analysis costs 20-45s and a real API call, so this is worth
  // recovering. Uploaded files themselves aren't persisted (could blow the
  // localStorage quota), only the finished result.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time client-only
       hydration from localStorage; can't use a lazy useState initializer
       here because `window` isn't available during SSR. */
    const saved = loadSession();
    if (saved) {
      setSeniority(saved.seniority);
      setUrl(saved.url);
      setJobDescription(saved.jobDescription);
      setResult(saved.result);
      setPreviousResult(saved.previousResult ?? null);
      setResolvedActions(new Set(saved.resolvedActions));
      setImproveStartStep(saved.improveStartStep);
      setView(saved.view);
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if ((view === "result" || view === "improve") && result) {
      saveSession({
        view,
        seniority,
        url,
        jobDescription,
        result,
        previousResult,
        resolvedActions: [...resolvedActions],
        improveStartStep,
      });
    }
  }, [hydrated, view, result, previousResult, resolvedActions, seniority, url, jobDescription, improveStartStep]);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, 5 - images.length);
    const encoded = await Promise.all(
      files.map(async (f) => ({ name: f.name, dataUrl: await fileToDataUrl(f) }))
    );
    setImages((prev) => [...prev, ...encoded].slice(0, 5));
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  const canSubmit =
    (!!seniority || jobDescription.trim().length > 0) &&
    (url.trim().length > 0 || images.length > 0);

  // The evaluation now runs as a background job (see /api/evaluate/route.ts):
  // POST kicks it off and returns immediately with a jobId, so this polls a
  // status endpoint instead of holding one fetch open for minutes.
  const JOB_POLL_INTERVAL_MS = 3000;

  async function pollEvaluationJob(jobId: string): Promise<EvaluationResult> {
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, JOB_POLL_INTERVAL_MS));
      const res = await fetch(`/api/evaluate/status/${jobId}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || t.settings.genericError);
      }
      if (data.status === "done") return data.result as EvaluationResult;
      if (data.status === "error") throw new Error(data.error || t.settings.genericError);
      // status === "running": keep polling.
    }
  }

  async function runEvaluation(): Promise<EvaluationResult> {
    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seniority,
        images: images.map((i) => i.dataUrl),
        url: url.trim() || undefined,
        jobDescription: jobDescription.trim() || undefined,
        locale,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || t.settings.genericError);
    }
    return pollEvaluationJob(data.jobId as string);
  }

  // Cosmetic only, never blocks or affects the real evaluation: grabs
  // something to show on the loading screen so the wait feels grounded in
  // the user's actual portfolio instead of a generic spinner. Uploads are
  // already in the browser (instant); a URL needs a fast, separate capture
  // since the full /api/evaluate capture only comes back at the very end.
  function startPreviewCapture() {
    setPreviewImage(null);
    setPreviewIsPdf(false);
    if (images.length > 0) {
      const first = images[0].dataUrl;
      setPreviewIsPdf(first.startsWith("data:application/pdf"));
      setPreviewImage(first);
      return;
    }
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;
    fetch("/api/capture-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: trimmedUrl }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.dataUrl) setPreviewImage(data.dataUrl);
      })
      .catch(() => {
        // No preview is a fine fallback, this never affects the real analysis.
      });
  }

  async function handleSubmit() {
    unlockAudioForCompletionSound();
    startPreviewCapture();
    setError(null);
    setPreviousResult(null);
    setView("loading");
    try {
      const data = await runEvaluation();
      setResult(data);
      setView("result");
      playCompletionSound();
      flashTitleUntilFocused(t.loading.readyTitle);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.settings.unknownError);
      setView("settings");
    }
  }

  // Re-analyzes the same URL/upload after the user has made edits, so the
  // "did the fix actually work" question gets a real re-scanned answer
  // instead of the estimate ImproveFlow shows while resolving checklist items.
  async function handleRescan() {
    if (!result) return;
    unlockAudioForCompletionSound();
    startPreviewCapture();
    setError(null);
    setPreviousResult(result);
    setView("loading");
    try {
      const data = await runEvaluation();
      setResult(data);
      setResolvedActions(new Set());
      setImproveStartStep(0);
      setView("result");
      playCompletionSound();
      flashTitleUntilFocused(t.loading.readyTitle);
    } catch (err) {
      setPreviousResult(null);
      setError(err instanceof Error ? err.message : t.settings.unknownError);
      setView("settings");
    }
  }

  function handleReset() {
    setResult(null);
    setPreviousResult(null);
    setError(null);
    setResolvedActions(new Set());
    setImproveStartStep(0);
    setPreviewImage(null);
    setPreviewIsPdf(false);
    setView("home");
    clearSession();
  }

  function handleImprove(stepIndex = 0) {
    setImproveStartStep(stepIndex);
    setView("improve");
  }

  let screen: ReactNode;

  if (view === "loading") {
    screen = <LoadingScreen previewImage={previewImage} previewIsPdf={previewIsPdf} />;
  } else if (view === "improve" && result) {
    screen = (
      <ImproveFlow
        result={result}
        initialStepIndex={improveStartStep}
        resolvedActions={resolvedActions}
        onResolvedActionsChange={setResolvedActions}
        onBackToResult={() => setView("result")}
      />
    );
  } else if (view === "result" && result) {
    screen = (
      <ResultScreen
        result={result}
        previousResult={previousResult}
        seniority={seniority}
        resolvedActions={resolvedActions}
        onImprove={handleImprove}
        onReset={handleReset}
        onRescan={handleRescan}
      />
    );
  } else if (view === "settings") {
    screen = (
      <SettingsScreen
        seniority={seniority}
        setSeniority={setSeniority}
        url={url}
        setUrl={setUrl}
        images={images}
        onFilesSelected={handleFiles}
        onRemoveImage={removeImage}
        jobDescription={jobDescription}
        setJobDescription={setJobDescription}
        showJobDescription={showJobDescription}
        setShowJobDescription={setShowJobDescription}
        canSubmit={canSubmit}
        onSubmit={handleSubmit}
        onBack={() => setView("home")}
        error={error}
      />
    );
  } else {
    screen = <HomeScreen onStart={() => setView("settings")} />;
  }

  return (
    <>
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <AmbientFlowField className="h-full w-full" />
      </div>
      {/* Hidden once a result exists: the analysis text is frozen in
          whatever language it was generated in, so switching here would
          mix languages (UI chrome reacts live, generated content can't). */}
      {!result && <LanguageSwitcher />}
      {screen}
    </>
  );
}
