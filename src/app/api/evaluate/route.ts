import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { loadRubric } from "@/lib/rubric";
import { CATEGORIES, type EvaluationResult } from "@/lib/types";
import { captureUrlScreenshots, type CapturedImage } from "@/lib/capture";
import { rateLimit, getClientIp } from "@/lib/rateLimit";
import { compositeScore } from "@/lib/scoring";
import { computePercentile } from "@/lib/benchmark";
import { appendEvaluationRow, getEvaluationScores } from "@/lib/googleSheets";

export const runtime = "nodejs";
// QA finding: the Claude vision call alone (6 images + a large structured
// tool schema) measured 55-85s on its own in testing, before capture time
// is even added, and a validation retry (see callEvaluationTool below) can
// trigger a second full call. Vercel clamps this to whatever the plan
// allows, so it's safe to ask for more than Hobby's ceiling; on Hobby this
// still caps at 60s and MAX_PAGES in capture.ts is the only real lever
// left to buy margin.
//
// Production incident (2026-07-13): with up to 5 case studies captured in
// one combined call, a single attempt measured ~160s, leaving almost no
// room for the retry logic to ever actually retry within a 180s budget.
// Raised to 260s (also bump vercel.json's functions.maxDuration to match,
// that value wins over this one and silently overrides it if they drift
// apart again). The evaluation is now split into two parallel calls (core
// verdict + case studies, see callEvaluationTool) specifically to keep
// each one's generation time well under this budget even as the case
// study cap goes up.
export const maxDuration = 260;

const RATE_LIMIT = 6;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

const LANGUAGE_NAMES: Record<string, string> = {
  es: "español",
  en: "inglés",
  fr: "francés",
  pt: "portugués",
};

const SENIORITY_LABELS: Record<string, string> = {
  junior: "Junior",
  mid: "Mid",
  senior: "Senior",
  staff: "Staff / Principal",
};

// Shared by category fixes and case study fixes: one independently
// checkable action item, with an optional concrete text suggestion. The
// user should never have to invent the actual wording themselves when the
// fix involves writing or rewriting something, that's the whole point of
// asking a senior recruiter for help instead of a generic checklist.
const actionItemProperty = {
  type: "object",
  properties: {
    text: {
      type: "string",
      description:
        "Instrucción corta y concreta en imperativo, referenciando algo específico visto en las capturas.",
    },
    suggestion: {
      type: "object",
      description:
        "Propuesta de texto lista para copiar y pegar, en la voz y vocabulario del candidato (imita cómo escribe en sus propias capturas, su nivel de formalidad, sus muletillas). Inclúyela SIEMPRE que la acción implique escribir o reescribir texto, que es la gran mayoría de los casos: titulares, overview, bullets de scope, microcopy, bios. Omite este campo SOLO si la acción es puramente estructural y no involucra ningún texto (ej. 'reordena estos dos proyectos', 'añade una captura de producto', 'corta este case study'). Escribe de forma natural y humana, como lo haría la propia persona: nunca uses guion largo (—), nunca punto y coma, varía el ritmo y la longitud de las frases, evita muletillas genéricas de IA ('en el mundo acelerado de hoy', 'no se trata solo de X, sino de Y').",
      properties: {
        before: {
          type: "string",
          description:
            "Inclúyelo SOLO si la sugerencia reemplaza una frase puntual que ya existe: cítala tal cual aparece. Omite este campo si la sugerencia es texto nuevo sin una frase concreta que reemplazar (ej. un overview entero escrito desde cero).",
        },
        after: {
          type: "string",
          description: "El texto propuesto, listo para usar tal cual, sin que el candidato tenga que redactarlo.",
        },
      },
      required: ["after"],
    },
  },
  required: ["text"],
};

const fixProperty = {
  type: "object",
  description:
    "Sugerencia accionable y específica para esta categoría — nunca un consejo genérico. Debe poder aplicarse hoy mismo.",
  properties: {
    actions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: actionItemProperty,
      description:
        "1-3 acciones concretas y distintas. Si solo hay un problema real, un array de un solo elemento.",
    },
  },
  required: ["actions"],
};

const coreProperties = {
  semaphore: {
    type: "string",
    enum: ["green", "yellow", "red"],
    description:
      "green = pasarías el filtro de 10 segundos, yellow = sobrevive pero con fugas, red = alto riesgo de descarte inmediato",
  },
  headline: {
    type: "string",
    description:
      "Titular compartible en español, ej: 'Tu portfolio pasaría el filtro de 10 segundos de un reclutador senior de Google.'",
  },
  verdict_headline: {
    type: "object",
    description:
      "El veredicto de contratación en 2 líneas cortas y contundentes, en primera persona de reclutador, específico a lo que viste (no genérico). Se muestra en tipografía grande tipo titular, así que la brevedad es un requisito, no una preferencia. Ejemplos de tono: 'Conseguirías la entrevista.' / 'No conseguirías la oferta.' — o 'Este portfolio abre puertas.' / 'No cierra ofertas.'",
    properties: {
      line1: {
        type: "string",
        description:
          "Primera línea del veredicto. Máximo ~8 palabras. Una sola idea, sin nombres propios de proyectos. Envuelve entre **doble asterisco** la única palabra o frase corta que más resuma el veredicto (el verbo clave o el juicio central), el resto de la línea va sin marcar.",
      },
      line2: {
        type: "string",
        description:
          "Segunda línea, matiza o contrasta la primera. Máximo ~14 palabras. Si necesitas nombrar un proyecto concreto, nombra como mucho uno, nunca enumeres varios en la misma frase, eso la alarga demasiado para el tamaño de titular. Envuelve entre **doble asterisco** la parte más concreta y evaluativa de la frase (el matiz clave o el dato puntual), el resto va sin marcar.",
      },
    },
    required: ["line1", "line2"],
  },
  strengths: {
    type: "array",
    minItems: 2,
    maxItems: 4,
    items: { type: "string" },
    description:
      "2-4 fortalezas reales y específicas del candidato (no nombres de categorías del rubric), frases cortas tipo 'Pensamiento de producto en IA', 'Storytelling con datos'. Deben poder defenderse citando algo concreto visto. Envuelve entre **doble asterisco** la parte más concreta y escaneable de la frase (la cifra, el nombre del proyecto o la evidencia puntual), dejando el resto sin marcar, ej. 'Métricas duras y verosímiles en **Compose (4.5h a <30min, +40 NPS)**'.",
  },
  key_risks: {
    type: "array",
    minItems: 2,
    maxItems: 4,
    items: { type: "string" },
    description:
      "2-4 riesgos clave, escritos en primera persona como los diría un reclutador revisando esto en voz alta (ej. 'No puedo saber si esto movió el negocio', 'Necesito ver una prueba más fuerte de resultados'). Cortos, directos, sin adornos. Envuelve entre **doble asterisco** la parte más concreta y escaneable (la cita textual, el nombre del proyecto o el dato en cuestión), ej. 'No puedo saber si el **\"200% improvement\"** en Mural es real o redondeado para la página'.",
  },
  categories: {
    type: "array",
    minItems: 6,
    maxItems: 6,
    description: "Exactamente 6 categorías, en este orden fijo.",
    items: {
      type: "object",
      properties: {
        key: {
          type: "string",
          enum: CATEGORIES.map((c) => c.key),
        },
        score: {
          type: "number",
          description: "Nota de 0 a 10",
        },
        problem: {
          type: "string",
          description:
            "1-2 frases: el problema tal cual, en tono directo de reclutador ('No puedo saber si...', 'Esto no me convence de que...'), referenciando algo concreto visto en las capturas.",
        },
        why_it_matters: {
          type: "string",
          description:
            "1-2 frases: por qué le importa esto a un reclutador de verdad para el nivel de seniority indicado, en primera persona.",
        },
        fix: fixProperty,
      },
      required: ["key", "score", "problem", "why_it_matters", "fix"],
    },
  },
};

// Split into its own tool call (see submitCaseStudiesTool below) rather
// than folded into the same response as semaphore/categories/strengths.
// Production incident (2026-07-13): asking Claude to write up to 5 detailed
// case studies AND everything else in one giant structured response was
// unreliable, two failures in a row with different fields coming back
// broken (case_studies truncated, then semaphore missing), even after
// raising max_tokens. A dedicated, smaller call for case studies is more
// reliable per-call and lets the cap go up (real portfolios commonly carry
// 3-8) instead of trading coverage for reliability.
const caseStudiesProperties = {
  case_studies: {
    type: "array",
    minItems: 1,
    maxItems: 8,
    description:
      "Cada case study o proyecto identificable en las capturas, en el orden actual en que aparece en el portfolio. Entre 1 y 8 elementos, nunca vacío. Si no se puede identificar ningún case study individual en las capturas (ej. solo se ve el home), devuelve un único elemento explicándolo en 'problem' con recommendation 'ampliar'.",
    items: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "Nombre o identificador del proyecto tal como aparece (ej. 'Bigdata — Watchlists'). Si no tiene nombre claro, usa 'Case study 1', 'Case study 2', etc. según el orden en que aparecen.",
        },
        recommendation: {
          type: "string",
          enum: ["mantener", "reordenar", "ampliar", "cortar"],
          description:
            "mantener = está bien donde está; reordenar = debería moverse a otra posición (indica hacia dónde en problem); ampliar = necesita más profundidad/contenido; cortar = considera eliminarlo, no aporta a la candidatura.",
        },
        problem: {
          type: "string",
          description:
            "1 frase específica en tono directo de reclutador: por qué esta recomendación, referenciando algo concreto visto en las capturas.",
        },
        why_it_matters: {
          type: "string",
          description: "1 frase: por qué esto le pesa a un reclutador evaluando este nivel de seniority.",
        },
        fixes: {
          type: "array",
          minItems: 1,
          maxItems: 3,
          items: actionItemProperty,
          description:
            "1-3 acciones concretas, distintas y específicas que el candidato puede aplicar hoy mismo a este case study. Cada elemento debe ser un problema/acción diferente (no dividas una misma idea en varias frases) — si solo hay un problema real, devuelve un array de un solo elemento.",
        },
      },
      required: ["name", "recommendation", "problem", "why_it_matters", "fixes"],
    },
  },
};

const coreRequired = ["semaphore", "headline", "verdict_headline", "strengths", "key_risks", "categories"];

const jobFitProperty = {
  type: "object",
  description:
    "Comparación del portfolio contra la job description proporcionada. Solo se incluye porque se adjuntó una oferta.",
  properties: {
    level: {
      type: "string",
      enum: ["alto", "medio", "bajo"],
      description: "Nivel de fit del portfolio con esta oferta específica.",
    },
    summary: {
      type: "string",
      description: "1-2 frases resumiendo el fit general con la oferta.",
    },
    strengths: {
      type: "array",
      items: { type: "string" },
      description: "2-4 puntos concretos donde el portfolio encaja con lo que pide la oferta.",
    },
    gaps: {
      type: "array",
      items: { type: "string" },
      description: "2-4 puntos concretos que la oferta pide y el portfolio no demuestra.",
    },
  },
  required: ["level", "summary", "strengths", "gaps"],
};

const coreEvaluationTool: Anthropic.Tool = {
  name: "submit_core_evaluation",
  description:
    "Entrega el veredicto general y las 6 categorías de la Capa 1 (tarjeta resumen) del portfolio según el rubric. NO incluye el desglose de case studies, eso va en una herramienta aparte.",
  input_schema: {
    type: "object",
    properties: coreProperties,
    required: coreRequired,
  },
};

const coreEvaluationToolWithJobFit: Anthropic.Tool = {
  name: "submit_core_evaluation",
  description:
    "Entrega el veredicto general y las 6 categorías de la Capa 1 (tarjeta resumen) del portfolio según el rubric, incluyendo fit con una oferta específica. NO incluye el desglose de case studies, eso va en una herramienta aparte.",
  input_schema: {
    type: "object",
    properties: { ...coreProperties, job_fit: jobFitProperty },
    required: [...coreRequired, "job_fit"],
  },
};

const caseStudiesTool: Anthropic.Tool = {
  name: "submit_case_studies",
  description:
    "Entrega el desglose detallado de cada case study identificable en el portfolio (nombre, recomendación, problema, por qué importa, fixes).",
  input_schema: {
    type: "object",
    properties: caseStudiesProperties,
    required: ["case_studies"],
  },
};

function dataUrlToCapturedImage(dataUrl: string): CapturedImage {
  const match = dataUrl.match(/^data:(image\/\w+|application\/pdf);base64,(.+)$/);
  if (!match) {
    throw new Error("Formato de archivo inválido. Sube imágenes o un PDF.");
  }
  const [, mediaType, base64Data] = match;
  return {
    mediaType: mediaType as CapturedImage["mediaType"],
    base64: base64Data,
    sourceUrl: "upload",
    // Manually uploaded screenshots have no known viewport, so we can't
    // ground a mobile-responsiveness verdict on them either way.
    viewport: "desktop",
  };
}

// Anthropic's tool schema `required`/`minItems` are hints to the model, not
// server-enforced constraints — QA testing against real portfolios found
// both a fully-missing required field (semaphore) and an empty array
// despite minItems: 1 (case_studies). Validate before trusting the output.
function findCoreEvaluationIssue(input: Record<string, unknown>): string | null {
  const semaphore = input.semaphore;
  if (semaphore !== "green" && semaphore !== "yellow" && semaphore !== "red") {
    return "semaphore ausente o inválido";
  }
  if (typeof input.headline !== "string" || !input.headline) return "headline ausente";
  const vh = input.verdict_headline as { line1?: string; line2?: string } | undefined;
  if (!vh?.line1 || !vh?.line2) return "verdict_headline incompleto";
  if (!Array.isArray(input.strengths) || input.strengths.length === 0) return "strengths vacío";
  if (!Array.isArray(input.key_risks) || input.key_risks.length === 0) return "key_risks vacío";
  const categories = input.categories as { score?: number }[] | undefined;
  if (!Array.isArray(categories) || categories.length !== 6) return "categories incompleto";
  if (categories.some((c) => typeof c.score !== "number" || c.score < 0 || c.score > 10)) {
    return "categories con score inválido";
  }
  return null;
}

function findCaseStudiesIssue(input: Record<string, unknown>): string | null {
  if (!Array.isArray(input.case_studies) || input.case_studies.length === 0) {
    return "case_studies vacío";
  }
  return null;
}

// snake_case (tool schema) -> camelCase (app types), including nested arrays.
function normalizeEvaluation(input: Record<string, unknown>) {
  const { job_fit, case_studies, verdict_headline, key_risks, categories, ...rest } = input as {
    job_fit?: unknown;
    case_studies?: { why_it_matters: string; [k: string]: unknown }[];
    verdict_headline?: unknown;
    key_risks?: unknown;
    categories?: { why_it_matters: string; [k: string]: unknown }[];
    [k: string]: unknown;
  };

  return {
    ...rest,
    verdictHeadline: verdict_headline,
    keyRisks: key_risks,
    categories: (categories ?? []).map(({ why_it_matters, ...c }) => ({
      ...c,
      whyItMatters: why_it_matters,
    })),
    caseStudies: (case_studies ?? []).map(({ why_it_matters, ...cs }) => ({
      ...cs,
      whyItMatters: why_it_matters,
    })),
    ...(job_fit ? { jobFit: job_fit } : {}),
  };
}

interface CallEvaluationToolOptions {
  anthropic: Anthropic;
  tool: Anthropic.Tool;
  system: string;
  contextLines: string[];
  imageBlocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam)[];
  maxTokens: number;
  findIssue: (candidate: Record<string, unknown>) => string | null;
  requestStartedAt: number;
  functionBudgetMs: number;
  minRetryBudgetMs: number;
}

// Shared retry loop for a single tool-use call: the tool schema's required
// fields and minItems are hints, not guarantees, so an occasional response
// drops a required field or returns an empty array despite it. A retry
// resolves this in practice far more often than it costs in latency, but
// only if there's realistically enough time budget left to complete one
// (production incident 2026-07-10: an unconditional retry started a second
// ~160s call with only ~46s left, Vercel killed the function mid-flight and
// returned its own plain-text timeout page instead of this route's JSON
// error, which the frontend couldn't parse).
async function callEvaluationTool({
  anthropic,
  tool,
  system,
  contextLines,
  imageBlocks,
  maxTokens,
  findIssue,
  requestStartedAt,
  functionBudgetMs,
  minRetryBudgetMs,
}: CallEvaluationToolOptions): Promise<{ input: Record<string, unknown> | null; lastIssue: string | null }> {
  const MAX_ATTEMPTS = 2;
  let input: Record<string, unknown> | null = null;
  let lastIssue: string | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      const remaining = functionBudgetMs - (Date.now() - requestStartedAt);
      if (remaining < minRetryBudgetMs) {
        console.error(
          `skipping ${tool.name} retry, only ${remaining}ms left in the function budget`
        );
        break;
      }
    }

    const message = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: maxTokens,
      system,
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: contextLines.join("\n") }],
        },
      ],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
    );

    if (!toolUse) {
      lastIssue = "sin tool_use en la respuesta";
      continue;
    }

    const candidate = toolUse.input as Record<string, unknown>;
    const issue = findIssue(candidate);
    if (!issue) {
      input = candidate;
      break;
    }
    lastIssue = issue;
    // Diagnostic detail beyond just the issue name: two production
    // incidents in a row (2026-07-13) failed validation with no way to tell
    // whether the field was truly missing, malformed, or the whole response
    // got cut off by stop_reason "max_tokens". Without this, every
    // recurrence is another blind guess instead of evidence.
    console.error(
      `${tool.name} attempt ${attempt} invalid: ${issue} | stop_reason=${message.stop_reason} | keys=${Object.keys(candidate).join(",")}`
    );
  }

  return { input, lastIssue };
}

export async function POST(req: NextRequest) {
  const requestStartedAt = Date.now();
  try {
    const ip = getClientIp(req);
    const limit = rateLimit(`evaluate:${ip}`, RATE_LIMIT, RATE_WINDOW_MS);
    if (!limit.allowed) {
      const retryAfterSec = Math.ceil((limit.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        {
          error: `Has alcanzado el límite de análisis por hora. Prueba de nuevo en ${Math.ceil(retryAfterSec / 60)} minutos.`,
        },
        { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
      );
    }

    const body = await req.json();
    const { seniority, images, url, jobDescription, locale } = body as {
      seniority: string;
      images?: string[]; // data URLs, manual fallback
      url?: string;
      jobDescription?: string;
      locale?: string;
    };

    // El nivel de seniority es obligatorio salvo que el candidato haya
    // aportado una oferta de trabajo concreta — en ese caso se infiere del
    // propio texto de la oferta en vez de depender de un valor manual.
    if (!jobDescription && (!seniority || !SENIORITY_LABELS[seniority])) {
      return NextResponse.json(
        { error: "Nivel de seniority inválido." },
        { status: 400 }
      );
    }
    if (seniority && !SENIORITY_LABELS[seniority]) {
      return NextResponse.json(
        { error: "Nivel de seniority inválido." },
        { status: 400 }
      );
    }
    if (!url && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Pega la URL de tu portfolio o sube al menos un archivo (capturas o PDF)." },
        { status: 400 }
      );
    }

    // Testing-only escape hatch: exercises the Playwright/Chromium capture
    // pipeline against a real URL and returns immediately, without ever
    // calling Claude. Zero API cost — use this to confirm captures work on
    // Vercel (or to see how long they take there) before spending tokens.
    const debugCaptureOnly = (body as { debugCaptureOnly?: boolean }).debugCaptureOnly;
    if (debugCaptureOnly && url) {
      const startedAt = Date.now();
      try {
        const captured = await captureUrlScreenshots(url);
        return NextResponse.json({
          ok: true,
          durationMs: Date.now() - startedAt,
          truncatedLinkCount: captured.truncatedLinkCount,
          images: captured.images.map((img) => ({
            viewport: img.viewport,
            sourceUrl: img.sourceUrl,
            mediaType: img.mediaType,
            base64Length: img.base64.length,
          })),
        });
      } catch (err) {
        return NextResponse.json(
          {
            ok: false,
            durationMs: Date.now() - startedAt,
            error: err instanceof Error ? err.message : "Error desconocido",
          },
          { status: 500 }
        );
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Sin API key configurada: devolvemos una evaluación de ejemplo para
      // poder probar el flujo de UI de punta a punta. Se elimina en cuanto
      // ANTHROPIC_API_KEY esté presente.
      return NextResponse.json(mockEvaluation(seniority, !!jobDescription));
    }

    let capturedImages: CapturedImage[] = [];
    let usedFallback = false;
    let truncatedLinkCount = 0;

    if (url) {
      try {
        const captured = await captureUrlScreenshots(url);
        capturedImages = captured.images;
        truncatedLinkCount = captured.truncatedLinkCount;
        if (capturedImages.length === 0) {
          throw new Error("No se pudo capturar contenido de la URL.");
        }
      } catch (captureErr) {
        console.error("capture failed", captureErr);
        if (images && images.length > 0) {
          capturedImages = images.map(dataUrlToCapturedImage);
          usedFallback = true;
        } else {
          return NextResponse.json(
            {
              error:
                "No pude cargar esa URL automáticamente (puede bloquear bots o requerir login). Sube capturas o un PDF de tu portfolio como alternativa.",
            },
            { status: 422 }
          );
        }
      }
    } else if (images && images.length > 0) {
      capturedImages = images.map(dataUrlToCapturedImage);
    }

    const anthropic = new Anthropic({ apiKey });
    const rubric = loadRubric();

    const imageBlocks: (Anthropic.TextBlockParam | Anthropic.ImageBlockParam | Anthropic.DocumentBlockParam)[] =
      [];
    capturedImages.forEach((img, i) => {
      if (img.mediaType === "application/pdf") {
        imageBlocks.push({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: img.base64 },
        });
        return;
      }
      imageBlocks.push({
        type: "text",
        text:
          img.viewport === "mobile"
            ? `Captura ${i + 1}: vista MÓVIL (390x844) de ${img.sourceUrl}. Úsala para evaluar responsive: overflow horizontal, texto cortado, elementos superpuestos o tap targets rotos.`
            : `Captura ${i + 1}: vista de escritorio de ${img.sourceUrl}.`,
      });
      imageBlocks.push({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      });
    });
    const hasMobileCapture = capturedImages.some((img) => img.viewport === "mobile");

    const sharedContextLines = [
      seniority
        ? `Nivel de seniority objetivo del candidato: ${SENIORITY_LABELS[seniority]}.`
        : "El candidato no indicó un nivel de seniority manualmente: infiérelo directamente del título y los requisitos de la oferta de trabajo adjunta.",
      url && !usedFallback
        ? `Las capturas adjuntas fueron tomadas automáticamente navegando: ${url} (home + subpáginas de case studies detectadas).`
        : null,
      url && usedFallback
        ? `No se pudo navegar automáticamente ${url}; se usan capturas subidas manualmente por el usuario.`
        : null,
      url && !usedFallback && truncatedLinkCount > 0
        ? `El portfolio tiene más páginas internas enlazadas de las que se pudieron capturar (${truncatedLinkCount} adicionales sin capturar). Las capturas adjuntas son solo una parte del portfolio completo: no des por hecho que viste todos los case studies del candidato, dilo explícitamente si es relevante para tu evaluación (por ejemplo, en curación).`
        : null,
      "Evalúa el Modo AUDITORÍA, Capa 1 (tarjeta resumen), usando las capturas o el PDF adjuntos como única evidencia visual.",
      "TONO: escribe como un reclutador senior de verdad hablando en primera persona, directo y sin adornos corporativos — evita lenguaje de consultoría genérico. Sé honesto y contundente, no despiadado: nunca inventes contexto que no viste, y reconoce lo que sí funciona con la misma franqueza que lo que no. Ejemplo del tono buscado: en vez de 'Este proyecto carece de impacto medible', escribe 'No puedo saber si esto movió el negocio'.",
      "Cuando te refieras a un case study o proyecto específico (en strengths, key_risks, o el problem/why_it_matters de una categoría), nombra explícitamente cuál es (el nombre del proyecto o 'Case Study N' según el orden en que aparecen) — nunca uses referencias ambiguas tipo 'el case study', 'el trabajo real' o 'ese proyecto' sin decir a cuál te refieres. El lector no puede adivinarlo.",
      hasMobileCapture
        ? "Se adjunta una captura real en viewport móvil (390x844, identificada como tal en el texto que la precede). Úsala para dar un veredicto concreto sobre responsive en la categoría de craft: cita lo que ves (overflow, texto cortado, elementos rotos) en vez de una frase genérica."
        : "No hay captura en viewport móvil disponible (portfolio subido como capturas manuales o PDF). No afirmes ni niegues que el portfolio es responsive en móvil: di explícitamente que no pudiste verificarlo con la evidencia disponible.",
      "Nunca uses el guion largo (—) en ningún texto que generes. Si necesitas una pausa o contraste, usa una coma, un punto o dos puntos en su lugar.",
      locale && locale !== "es"
        ? `Escribe absolutamente todo el texto de tu respuesta en ${LANGUAGE_NAMES[locale] ?? locale}, no en español.`
        : null,
    ].filter((line): line is string => !!line);

    const coreContextLines = [
      ...sharedContextLines,
      "Para cada categoría, incluye un 'fix' con 1-3 acciones accionables y específicas — nunca un consejo genérico tipo 'mejora la claridad'. Si el fix es un cambio de copy concreto, incluye la frase original citada tal cual y una propuesta de reemplazo que preserve el vocabulario y la voz del candidato. Si el problema es falta de impacto medible, recuerda que un diseñador rara vez es dueño de la métrica de negocio: antes de pedir una cifra, considera si el candidato ya muestra un antes/después (menos pasos, un check que antes fallaba), una señal de proceso (un componente o decisión suya que el equipo adoptó) o una cita de usuario/stakeholder tras el lanzamiento, cualquiera de esas tres cuenta como evidencia real. Solo si NINGUNA de las tres existe, la acción debe pedir al candidato que reconstruya el dato (¿lo midió? ¿hay un proxy cualitativo?) y lo etiquete como Medido o Estimado — nunca una cifra fabricada.",
      "Completa también 'strengths' (fortalezas reales y específicas, no nombres de categorías) y 'key_risks' (en primera persona de reclutador) — estos alimentan una sección de 'notas del reclutador', así que deben sonar como notas reales tomadas durante una revisión, no como resumen de categorías.",
      jobDescription
        ? `El candidato quiere aplicar a esta oferta específica:\n"""\n${jobDescription}\n"""\nAdemás de la Capa 1, completa job_fit comparando el portfolio contra los requisitos de esta oferta: nivel de fit, resumen, fortalezas alineadas y gaps concretos.`
        : null,
      "Responde exclusivamente llamando a la herramienta submit_core_evaluation, con las 6 categorías en el orden dado. No incluyas el desglose de case studies, eso lo pide otra herramienta aparte.",
    ].filter((line): line is string => !!line);

    const caseStudiesContextLines = [
      ...sharedContextLines,
      "Los case studies son la parte más importante de un portfolio de diseño: identifica cada case study visible en las capturas o el PDF, en el orden actual en que aparecen, y da una recomendación concreta (mantener / reordenar / ampliar / cortar) con la razón específica. Si hay varios problemas distintos en el mismo case study, sepáralos en elementos individuales de 'fixes' en vez de fundirlos en una sola frase larga. No incluyas la home page ni páginas genéricas (about, builds, contacto) como si fueran un case study propio, solo cuentan los proyectos individuales con su propio problema/proceso/resultado.",
      "Para cada case study, revisa explícitamente si hay capturas o mockups del producto real (no solo texto o fotos del equipo): si las hay, evalúa su calidad visual como parte de craft (¿se ven pulidas y profesionales, con UI consistente y de alta fidelidad, o rotas, pixeladas, con placeholders tipo 'Lorem ipsum' o inconsistentes entre pantallas?) y cítalo con algo concreto que veas. Si un case study específico no tiene ninguna captura de producto en la evidencia que se te dio, dilo explícitamente como 'no veo capturas del producto para este case study en las imágenes disponibles' en vez de asumir que no existen en el portfolio real: puede que simplemente no se capturaron (algunas webs revelan imágenes al hacer scroll, si la captura muestra huecos en blanco sospechosamente grandes, es más probable que sea un fallo de captura que la ausencia real de UI).",
      "Responde exclusivamente llamando a la herramienta submit_case_studies.",
    ].filter((line): line is string => !!line);

    // Two calls in parallel instead of one giant response: production
    // incidents (2026-07-13) showed that asking Claude to write semaphore +
    // categories + strengths + key_risks + up to 5 detailed case studies in
    // a single tool call was unreliable, two failures in a row with
    // different fields coming back broken even after raising max_tokens.
    // Splitting means each call's structured output is much smaller (so
    // less likely to have a malformed field anywhere), and the case-study
    // cap can go up (real portfolios commonly carry 3-8) without
    // reintroducing that risk. Runs concurrently so wall-clock time is
    // bounded by the slower of the two, not their sum — the cost is a
    // second full vision pass over the same images, paid in API cost, not
    // extra wait time.
    const FUNCTION_BUDGET_MS = maxDuration * 1000;
    const MIN_RETRY_BUDGET_MS = 90_000; // a call has measured as slow as ~170s

    const [coreResult, caseStudiesResult] = await Promise.all([
      callEvaluationTool({
        anthropic,
        tool: jobDescription ? coreEvaluationToolWithJobFit : coreEvaluationTool,
        system: rubric,
        contextLines: coreContextLines,
        imageBlocks,
        maxTokens: 4000,
        findIssue: findCoreEvaluationIssue,
        requestStartedAt,
        functionBudgetMs: FUNCTION_BUDGET_MS,
        minRetryBudgetMs: MIN_RETRY_BUDGET_MS,
      }),
      callEvaluationTool({
        anthropic,
        tool: caseStudiesTool,
        system: rubric,
        contextLines: caseStudiesContextLines,
        imageBlocks,
        maxTokens: 8000,
        findIssue: findCaseStudiesIssue,
        requestStartedAt,
        functionBudgetMs: FUNCTION_BUDGET_MS,
        minRetryBudgetMs: MIN_RETRY_BUDGET_MS,
      }),
    ]);

    if (!coreResult.input || !caseStudiesResult.input) {
      const issues = [
        !coreResult.input ? `veredicto general: ${coreResult.lastIssue}` : null,
        !caseStudiesResult.input ? `case studies: ${caseStudiesResult.lastIssue}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      return NextResponse.json(
        { error: `Claude no devolvió una evaluación completa (${issues}). Prueba de nuevo.` },
        { status: 502 }
      );
    }

    const normalized = normalizeEvaluation({
      ...coreResult.input,
      case_studies: caseStudiesResult.input.case_studies,
    }) as EvaluationResult;

    // Benchmark: only for a real, explicit seniority bucket (not one merely
    // inferred from a job description) so the comparison pool stays honest.
    // Logging and the percentile lookup are both best-effort — missing
    // Sheets credentials or a transient failure must never break the
    // evaluation itself, they just mean no benchmark line is shown.
    if (seniority) {
      const score = compositeScore(normalized);
      appendEvaluationRow([seniority, score, new Date().toISOString()]).catch(() => {});
      try {
        const history = await getEvaluationScores();
        const benchmark = computePercentile(score, seniority, history);
        if (benchmark) normalized.benchmark = benchmark;
      } catch {
        // No benchmark shown — see comment above.
      }
    }

    return NextResponse.json(normalized);
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Error desconocido";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function mockEvaluation(seniority: string, withJobFit: boolean) {
  const bySeniority: Record<
    string,
    { semaphore: "green" | "yellow" | "red"; headline: string; verdictHeadline: { line1: string; line2: string } }
  > = {
    junior: {
      semaphore: "yellow",
      headline:
        "Tu portfolio sobrevive el filtro de 10 segundos, pero le falta mostrar tu criterio de diseño para un rol junior.",
      verdictHeadline: {
        line1: "(Ejemplo) Conseguirías la entrevista.",
        line2: "Todavía no demuestras el criterio que un junior necesita mostrar.",
      },
    },
    mid: {
      semaphore: "yellow",
      headline:
        "Tu portfolio pasaría el primer filtro, pero un reclutador mid-level querría ver más impacto medible.",
      verdictHeadline: {
        line1: "(Ejemplo) Seguiría leyendo.",
        line2: "Pero no tengo pruebas de que esto moviera el negocio.",
      },
    },
    senior: {
      semaphore: "red",
      headline:
        "Tu portfolio no pasaría el filtro de 10 segundos de un reclutador senior de Google, falta señal de seniority en el hero.",
      verdictHeadline: {
        line1: "(Ejemplo) No conseguirías la entrevista.",
        line2: "El hero no comunica seniority en los primeros 10 segundos.",
      },
    },
    staff: {
      semaphore: "red",
      headline:
        "Para un rol staff/principal, tu portfolio necesita mostrar impacto organizacional, no solo craft individual.",
      verdictHeadline: {
        line1: "(Ejemplo) Este portfolio abre puertas de mid-level.",
        line2: "No cierra ofertas de staff/principal.",
      },
    },
  };

  const base = bySeniority[seniority] ?? bySeniority.mid;

  return {
    ...base,
    _mock: true,
    strengths: [
      "(Ejemplo) Configura ANTHROPIC_API_KEY para fortalezas reales basadas en tus capturas.",
      "(Ejemplo) Consistencia visual entre pantallas.",
    ],
    keyRisks: [
      "(Ejemplo) No puedo saber si esto movió el negocio.",
      "(Ejemplo) Necesito ver una prueba más fuerte de tu contribución individual.",
    ],
    categories: [
      {
        key: "primera_impresion",
        score: 6,
        problem: "(Ejemplo) El hero muestra el nombre del proyecto pero no el resultado. Configura ANTHROPIC_API_KEY para una evaluación real basada en tus capturas.",
        whyItMatters: "(Ejemplo) En 10 segundos necesito saber tu rol y tu nivel, no el nombre del proyecto.",
        fix: {
          actions: [
            {
              text: "(Ejemplo) Reescribe el titular del hero para que comunique el resultado del proyecto, no solo su nombre.",
              suggestion: {
                before: "(Ejemplo) 'Proyecto Alpha: rediseño de checkout'",
                after: "(Ejemplo) 'Cómo rediseñé el checkout y subí la conversión un 18%'",
              },
            },
          ],
        },
      },
      {
        key: "estructura_narrativa",
        score: 7,
        problem: "(Ejemplo) Se intuye un proceso, pero falta explicitar el 'por qué' de las decisiones de diseño.",
        whyItMatters: "(Ejemplo) Sin el 'por qué' no puedo distinguir criterio de ejecución.",
        fix: {
          actions: [
            {
              text: "(Ejemplo) Añade un subtítulo 'Por qué' antes de cada decisión clave de diseño, explicando la alternativa que descartaste.",
              suggestion: {
                after: "(Ejemplo) 'Por qué: descarté un modal de confirmación porque añadía un paso extra sin reducir errores reales, en su lugar valida en línea mientras el usuario escribe.'",
              },
            },
          ],
        },
      },
      {
        key: "impacto_metricas",
        score: 4,
        problem: "(Ejemplo) No se detectan métricas verificables en las capturas subidas.",
        whyItMatters: "(Ejemplo) Sin números, esto se siente como ejecución, no como ownership.",
        fix: {
          actions: [
            { text: "(Ejemplo) Pregúntate si mediste esto tú, te lo reportaron, o es una estimación." },
            { text: "(Ejemplo) Si no hay cifra exacta, usa un proxy cualitativo y etiquétalo como 'Estimado'." },
          ],
        },
      },
      {
        key: "autoria",
        score: 5,
        problem: "(Ejemplo) El texto usa 'nosotros' con frecuencia, sin desglosar tu contribución individual.",
        whyItMatters: "(Ejemplo) No puedo saber qué hiciste tú y qué hizo el equipo.",
        fix: {
          actions: [
            {
              text: "(Ejemplo) Reemplaza 'diseñamos' por frases que dejen clara tu contribución específica.",
              suggestion: {
                before: "(Ejemplo) 'Diseñamos un nuevo flujo de onboarding'",
                after: "(Ejemplo) 'Propuse y prototipé el nuevo flujo de onboarding, el equipo lo validó conmigo en 2 rondas de test'",
              },
            },
          ],
        },
      },
      {
        key: "craft",
        score: 8,
        problem: "(Ejemplo) Consistencia visual sólida entre las capturas revisadas.",
        whyItMatters: "(Ejemplo) El pulido visual da confianza, pero no compensa lo demás.",
        fix: {
          actions: [
            { text: "(Ejemplo) Revisa el espaciado entre secciones en móvil, hay saltos inconsistentes." },
          ],
        },
      },
      {
        key: "curacion",
        score: 6,
        problem: "(Ejemplo) Cantidad de proyectos razonable; falta confirmar profundidad real de cada uno.",
        whyItMatters: "(Ejemplo) Prefiero 3 proyectos profundos a 6 superficiales.",
        fix: {
          actions: [
            { text: "(Ejemplo) Si tienes más de 4 proyectos, corta el más débil y profundiza en los 3 restantes." },
          ],
        },
      },
    ],
    caseStudies: [
      {
        name: "(Ejemplo) Case study 1",
        recommendation: "mantener",
        problem: "(Ejemplo) Buen gancho inicial y estructura clara. Configura ANTHROPIC_API_KEY para un análisis real.",
        whyItMatters: "(Ejemplo) Esto es lo que quiero ver primero.",
        fixes: [
          {
            text: "(Ejemplo) Añade la métrica de resultado en el primer scroll, no al final.",
            suggestion: { after: "(Ejemplo) 'De 80 a 18 apelaciones al día tras el rediseño.'" },
          },
        ],
      },
      {
        name: "(Ejemplo) Case study 2",
        recommendation: "reordenar",
        problem: "(Ejemplo) Es tu proyecto más fuerte pero está tercero. Los reclutadores rara vez llegan tan abajo.",
        whyItMatters: "(Ejemplo) Si no lo veo en los primeros 2, asumo que no existe.",
        fixes: [{ text: "(Ejemplo) Muévelo a primera posición." }],
      },
      {
        name: "(Ejemplo) Case study 3",
        recommendation: "ampliar",
        problem: "(Ejemplo) Se queda en 'qué' se hizo, sin mostrar el proceso de decisión ni el impacto.",
        whyItMatters: "(Ejemplo) Sin proceso ni impacto, no puedo evaluar tu criterio.",
        fixes: [
          { text: "(Ejemplo) Añade 2-3 pantallas del proceso: research, iteraciones descartadas, decisión final." },
          { text: "(Ejemplo) Incluye al menos una métrica de resultado, aunque sea estimada." },
        ],
      },
    ],
    ...(withJobFit
      ? {
          jobFit: {
            level: "medio" as const,
            summary:
              "(Ejemplo) Cubre parte de lo que pide la oferta, pero configura ANTHROPIC_API_KEY para un análisis real contra esta job description.",
            strengths: [
              "(Ejemplo) Experiencia en el tipo de producto mencionado en la oferta.",
              "(Ejemplo) Craft visual consistente con lo que suelen pedir estas vacantes.",
            ],
            gaps: [
              "(Ejemplo) No se ve evidencia de la métrica de negocio que pide la oferta.",
              "(Ejemplo) Falta mención de trabajo cross-functional con el equipo que menciona el JD.",
            ],
          },
        }
      : {}),
  };
}
