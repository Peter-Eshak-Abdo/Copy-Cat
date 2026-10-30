import { getGeminiApiKey, VISION_MODELS } from "@/lib/gemini";

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
 */

export interface VisionTextResult {
  text: string;
  provider: string;
  /** The answer came from a model known to misread Arabic and maths: the UI asks for a manual check */
  lowAccuracy: boolean;
}

type Provider = { name: string; lowAccuracy?: boolean; run: () => Promise<string | null> };

function splitDataUrl(imageBase64: string, fallbackMime = "image/jpeg") {
  const mimeMatch = imageBase64.match(/^data:(image\/[\w.+-]+);base64,/);
  return {
    mimeType: mimeMatch ? mimeMatch[1] : fallbackMime,
    data: imageBase64.replace(/^data:[a-zA-Z0-9/.+-]+;base64,/, ""),
  };
}

async function geminiText(model: string, apiKey: string, prompt: string, mimeType: string, data: string) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ inlineData: { mimeType, data } }, { text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 32768 },
      }),
      // A hung model must leave time for the next one (a dense page normally takes 15-40s)
      signal: AbortSignal.timeout(70_000),
    }
  );
  if (!resp.ok) {
    console.warn(`OCR ${model} failed with ${resp.status}`);
    return null;
  }
  const body = await resp.json();
  const parts: Array<{ text?: string; thought?: boolean }> = body.candidates?.[0]?.content?.parts || [];
  return parts.filter((p) => p.text && !p.thought).map((p) => p.text).join("").trim() || null;
}

/** OpenAI-compatible chat endpoint with one image (Mistral, GitHub Models, OpenRouter, Groq) */
async function openAiCompatText(url: string, key: string, model: string, prompt: string, dataUrl: string) {
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
    signal: AbortSignal.timeout(100_000),
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
      providers.push({ name: model, run: () => geminiText(model, geminiKey, prompt, mimeType, data) });
    }
  }

  const mistralKey = process.env.MISTRAL_API_KEY;
  if (mistralKey) {
    for (const model of ["mistral-medium-latest", "pixtral-large-latest"]) {
      providers.push({
        name: `mistral:${model}`,
        run: () => openAiCompatText("https://api.mistral.ai/v1/chat/completions", mistralKey, model, prompt, dataUrl),
      });
    }
  }

  const githubToken = process.env.GITHUB_MODELS_TOKEN;
  if (githubToken) {
    for (const model of ["openai/gpt-4.1", "openai/gpt-4o"]) {
      providers.push({
        name: `github:${model}`,
        run: () => openAiCompatText("https://models.github.ai/inference/chat/completions", githubToken, model, prompt, dataUrl),
      });
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    for (const model of await openRouterFreeVisionModels()) {
      providers.push({
        name: `openrouter:${model}`,
        run: () => openAiCompatText("https://openrouter.ai/api/v1/chat/completions", openRouterKey, model, prompt, dataUrl),
      });
    }
  }

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    providers.push({
      name: "groq:qwen/qwen3.8-27b",
      lowAccuracy: true,
      run: () => openAiCompatText("https://api.groq.com/openai/v1/chat/completions", groqKey, "qwen/qwen3.8-27b", prompt, dataUrl),
    });
  }

  for (const p of providers) {
    if (onlyProvider && p.name !== onlyProvider) continue;
    try {
      const text = await p.run();
      if (text) return { text, provider: p.name, lowAccuracy: !!p.lowAccuracy };
    } catch (err) {
      console.warn(`OCR provider ${p.name} failed, trying next:`, err);
    }
  }
  return null;
}
