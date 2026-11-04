import { getGeminiApiKey, VISION_MODELS } from "@/lib/gemini";
import { isRepetitionLoop, looksLikeGarbage, stripRepetitionLoop } from "@/lib/degenerate-text";

/**
 * Document transcription with a chain of vision models, best first. Every provider after Gemini is free
 * (a free account key) and is only used when its key is configured, except Groq whose key already exists.
 *
 *   1. Gemini (4 models, each with its own free daily quota; thinking left on: it improves dense pages)
 *   2. Mistral (MISTRAL_API_KEY, free "Experiment" plan)
 *   3. GitHub Models GPT-4.1 / GPT-4o (GITHUB_MODELS_TOKEN, free with any GitHub account)
 *   4. OpenRouter free vision models (OPENROUTER_API_KEY, free account), discovered at runtime
 *   5. Groq Qwen (GROQ_API_KEY): fast but noticeably less accurate on Arabic, so flagged lowAccuracy
 *
 * Cohere's vision model was tested and invented a whole unrelated page, so it is deliberately not used.
 *
 * Every answer is checked for a repetition loop (lib/degenerate-text.ts). Gemini is streamed so a loop is
 * cut off as soon as it starts instead of running to the token cap (that once took ~7 minutes and
 * returned a page of "||"); a looping or garbage answer counts as a failure and the next model is tried.
 */

export interface VisionTextResult {
  text: string;
  provider: string;
  /** The answer came from a model known to misread Arabic and maths: the UI asks for a manual check */
  lowAccuracy: boolean;
  /** Only the part before a model got stuck repeating itself (every model looped or failed) */
  partial?: boolean;
}

type Provider = { name: string; lowAccuracy?: boolean; timeoutMs: number; run: (timeoutMs: number) => Promise<string | null> };

/**
 * The route may run for 300 s (maxDuration); the chain stops starting new models a little before that
 * so the page gets an answer (and can fall back to Tesseract) instead of a gateway timeout.
 */
const CHAIN_BUDGET_MS = 270_000;
const MIN_ATTEMPT_MS = 20_000;
/**
 * Once this many models got stuck repeating themselves on a page, the rest almost always do too (an exam
 * printed in two columns made every model loop on "||"), so the chain stops and the page reads the page
 * another way (column by column, see lib/column-split.ts) instead of spending minutes on the rest.
 */
const MAX_LOOPS = 2;

function splitDataUrl(imageBase64: string, fallbackMime = "image/jpeg") {
  const mimeMatch = imageBase64.match(/^data:(image\/[\w.+-]+);base64,/);
  return {
    mimeType: mimeMatch ? mimeMatch[1] : fallbackMime,
    data: imageBase64.replace(/^data:[a-zA-Z0-9/.+-]+;base64,/, ""),
  };
}

/** Thrown when a model's answer is a repetition loop; carries whatever came before the loop. */
class LoopError extends Error {
  constructor(readonly salvage: string) {
    super("repetition loop");
  }
}

async function geminiText(model: string, apiKey: string, prompt: string, mimeType: string, data: string, timeoutMs: number) {
  const abort = new AbortController();
  // A hung model must leave time for the next one (a dense page normally takes 15-40s)
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: prompt }] }],
          // A dense page is ~3-6k tokens; 16k leaves room for long pages without letting a loop run far
          generationConfig: { temperature: 0, maxOutputTokens: 16384 },
        }),
        signal: abort.signal,
      }
    );
    if (!resp.ok || !resp.body) {
      console.warn(`OCR ${model} failed with ${resp.status}`);
      return null;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    let checkedAt = 0;
    const takeLines = () => {
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const chunk = JSON.parse(line.slice(5));
          const parts: Array<{ text?: string; thought?: boolean }> = chunk.candidates?.[0]?.content?.parts || [];
          for (const p of parts) if (p.text && !p.thought) text += p.text;
        } catch {
          // keep-alive or a partial line: ignore
        }
      }
    };
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      takeLines();
      // Checking every ~1500 new characters keeps this cheap on long pages
      if (text.length - checkedAt > 1500) {
        checkedAt = text.length;
        if (isRepetitionLoop(text)) {
          abort.abort();
          console.warn(`OCR ${model} got stuck repeating itself after ${text.length} chars, trying next model`);
          throw new LoopError(stripRepetitionLoop(text));
        }
      }
    }
    buffer += "\n";
    takeLines();
    return text.trim() || null;
  } finally {
    clearTimeout(timer);
  }
}

/** OpenAI-compatible chat endpoint with one image (Mistral, GitHub Models, OpenRouter, Groq) */
async function openAiCompatText(url: string, key: string, model: string, prompt: string, dataUrl: string, timeoutMs: number) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) {
    console.warn(`OCR ${model} failed with ${resp.status}`);
    return null;
  }
  const body = await resp.json();
  const content = body.choices?.[0]?.message?.content;
  return typeof content === "string" && content.trim() ? content.trim() : null;
}

// OpenRouter's free vision line-up changes often, so it is read from their public model list (cached 1h)
const OPENROUTER_PREFERRED = ["google/gemma-4-31b-it:free", "thinkingmachines/inkling:free", "nvidia/nemotron-3.5-super-vl:free"];
let openRouterCache: { at: number; models: string[] } | null = null;

async function openRouterFreeVisionModels(): Promise<string[]> {
  if (openRouterCache && Date.now() - openRouterCache.at < 3_600_000) return openRouterCache.models;
  try {
    const resp = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(10_000) });
    const list: Array<{ id: string; architecture?: { input_modalities?: string[] } }> = (await resp.json()).data || [];
    const free = list
      .filter((m) => m.id.endsWith(":free") && m.architecture?.input_modalities?.includes("image"))
      .filter((m) => !/safety|guard/i.test(m.id))
      .map((m) => m.id);
    const ordered = [...OPENROUTER_PREFERRED.filter((m) => free.includes(m)), ...free.filter((m) => !OPENROUTER_PREFERRED.includes(m))];
    openRouterCache = { at: Date.now(), models: ordered.slice(0, 3) };
  } catch {
    openRouterCache = { at: Date.now(), models: OPENROUTER_PREFERRED };
  }
  return openRouterCache.models;
}

/**
 * `onlyProvider` restricts the chain to one model: the verification pass must run on the model that made
 * the draft. In testing a weaker fallback "verifying" a stronger model's draft solved the exam's blanks and
 * broke correct fractions, so a review by any other model does more harm than none.
 */
export async function transcribeImage(
  prompt: string,
  imageBase64: string,
  onlyProvider?: string
): Promise<VisionTextResult | null> {
  const { mimeType, data } = splitDataUrl(imageBase64);
  const dataUrl = `data:${mimeType};base64,${data}`;
  const providers: Provider[] = [];

  const geminiKey = getGeminiApiKey();
  if (geminiKey) {
    for (const model of VISION_MODELS) {
      providers.push({ name: model, timeoutMs: 70_000, run: (t) => geminiText(model, geminiKey, prompt, mimeType, data, t) });
    }
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    for (const model of ["mistral-medium-latest", "pixtral-large-latest"]) {
      providers.push({
        name: `mistral:${model}`,
        timeoutMs: 100_000,
        run: (t) => openAiCompatText("https://api.mistral.ai/v1/chat/completions", mistralKey, model, prompt, dataUrl, t),
      });
    }
  }

  const githubToken = process.env.GITHUB_MODELS_TOKEN;
  if (githubToken) {
    for (const model of ["openai/gpt-4.1", "openai/gpt-4o"]) {
      providers.push({
        name: `github:${model}`,
        timeoutMs: 100_000,
        run: (t) => openAiCompatText("https://models.github.ai/inference/chat/completions", githubToken, model, prompt, dataUrl, t),
      });
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    for (const model of await openRouterFreeVisionModels()) {
      providers.push({
        name: `openrouter:${model}`,
        timeoutMs: 100_000,
        run: (t) => openAiCompatText("https://openrouter.ai/api/v1/chat/completions", openRouterKey, model, prompt, dataUrl, t),
      });
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({
      name: "groq:qwen/qwen3.8-27b",
      lowAccuracy: true,
      timeoutMs: 100_000,
      run: (t) => openAiCompatText("https://api.groq.com/openai/v1/chat/completions", groqKey, "qwen/qwen3.8-27b", prompt, dataUrl, t),
    });
  }

  const startedAt = Date.now();
  let loops = 0;
  // Longest usable part seen before a model started looping; used only if every model fails
  let salvage: { text: string; provider: string } | null = null;
  const keepSalvage = (text: string, provider: string) => {
    if (text && !looksLikeGarbage(text) && text.length > (salvage?.text.length ?? 0)) salvage = { text, provider };
  };

  for (const p of providers) {
    if (onlyProvider && p.name !== onlyProvider) continue;
    if (loops >= MAX_LOOPS) {
      console.warn(`OCR: ${loops} models looped on this page, stopping the chain`);
      break;
    }
    const left = CHAIN_BUDGET_MS - (Date.now() - startedAt);
    if (left < MIN_ATTEMPT_MS) {
      console.warn(`OCR chain out of time before ${p.name}`);
      break;
    }
    try {
      const text = await p.run(Math.min(p.timeoutMs, left));
      if (!text) continue;
      if (looksLikeGarbage(text)) {
        console.warn(`OCR provider ${p.name} returned a repetition loop / garbage (${text.length} chars), trying next`);
        keepSalvage(stripRepetitionLoop(text), p.name);
        loops++;
        continue;
      }
      return { text, provider: p.name, lowAccuracy: !!p.lowAccuracy };
    } catch (err) {
      if (err instanceof LoopError) {
        keepSalvage(err.salvage, p.name);
        loops++;
        continue;
      }
      console.warn(`OCR provider ${p.name} failed, trying next:`, err);
    }
  }
  // Only part of the page was read before the loop: better than nothing, but it must be checked by hand
  const partial = salvage as { text: string; provider: string } | null;
  if (partial) return { text: partial.text, provider: partial.provider, lowAccuracy: true, partial: true };
  // Every model that answered looped and nothing usable was left: still report it as a loop, so the page
  // tries its other ways (columns, then Tesseract) rather than treating it as "no AI available"
  if (loops > 0) return { text: "", provider: "", lowAccuracy: true, partial: true };
  return null;
}
