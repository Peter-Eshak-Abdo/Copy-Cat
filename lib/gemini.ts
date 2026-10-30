import fs from "fs";
import path from "path";

/**
 * Vision model chain, newest first. The free tier gives every model its own small daily quota
 * (gemini-2.5-flash: 20 requests/day), so a 429 / 503 / retired model falls through to the next one.
 */
export const VISION_MODELS = ["gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash", "gemini-2.5-flash-lite"];

export function getGeminiApiKey(): string | undefined {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  if (process.env.GOOGLE_API_KEY) return process.env.GOOGLE_API_KEY;
  try {
    const envPath = path.join(process.cwd(), ".env.local");
    if (fs.existsSync(envPath)) {
      const match = fs.readFileSync(envPath, "utf-8").match(/GEMINI_API_KEY=([^\r\n]+)/);
      if (match && match[1].trim()) return match[1].trim();
    }
  } catch {}
  return undefined;
}

/**
 * Asks a vision model for a JSON answer about one image. Thinking is disabled: these are single-shot
 * detection prompts where thinking only adds latency (and on 2.5-flash ate the whole output budget).
 * Returns the parsed JSON, or null when every model failed.
 */
export async function geminiVisionJson(prompt: string, imageBase64: string, maxOutputTokens = 600): Promise<unknown> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;

  const mimeMatch = imageBase64.match(/^data:(image\/[\w.+-]+);base64,/);
  const data = imageBase64.replace(/^data:[a-zA-Z0-9/.+-]+;base64,/, "");

  for (const model of VISION_MODELS) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { parts: [{ text: prompt }, { inlineData: { mimeType: mimeMatch ? mimeMatch[1] : "image/jpeg", data } }] },
            ],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingBudget: 0 },
            },
          }),
        }
      );
      if (!resp.ok) {
        console.warn(`Gemini ${model} failed with ${resp.status}, trying next model`);
        continue;
      }
      const body = await resp.json();
      const raw: string = body.candidates?.[0]?.content?.parts?.[0]?.text || "";
      return JSON.parse(raw.replace(/```json/g, "").replace(/```/g, "").trim());
    } catch (err) {
      console.warn(`Gemini ${model} error, trying next model:`, err);
    }
  }
  return null;
}
