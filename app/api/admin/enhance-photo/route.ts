import { NextRequest, NextResponse } from "next/server";
import { getGeminiApiKey } from "@/lib/gemini";

export const maxDuration = 120;

/**
 * AI photo restoration for passport photos (sharpness, noise, exposure), tried in order:
 *   1. Gemini image models (needs billing on the Gemini project: the free tier has 0 image requests)
 *   2. Free Hugging Face Spaces (CodeFormer x3, GFPGAN), raced in parallel
 *   3. Replicate CodeFormer face restoration (REPLICATE_API_TOKEN)
 * When none is available the client applies its own tone correction and sharpening, so this route never
 * blocks the pipeline. The client sends the photo padded to 3:4 and crops the padding back off.
 */

const GEMINI_IMAGE_MODELS = ["gemini-3.1-flash-image", "gemini-2.5-flash-image", "gemini-3.1-flash-lite-image"];

const RESTORE_PROMPT =
  "Restore this photo for an official passport photo print: increase sharpness and clarity, remove noise, " +
  "blur and JPEG artifacts, correct exposure and white balance, and give the face soft even studio lighting. " +
  "Keep the person's identity EXACTLY the same: same face shape, eyes, nose, mouth, skin tone, expression, " +
  "hair, glasses and clothes. Do not beautify, slim, smooth or retouch features. Keep the same framing, " +
  "crop, pose and background; do not add or remove anything.";

type Result = { image: Buffer; mimeType: string } | null;

// A model that answered 429 (quota) is skipped for 10 minutes instead of adding a failed call to every photo
const quotaCooldownUntil: Record<string, number> = {};

async function tryGeminiImage(data: string, mimeType: string, apiKey: string, model: string): Promise<Result> {
  if ((quotaCooldownUntil[model] || 0) > Date.now()) return null;
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: RESTORE_PROMPT }, { inlineData: { mimeType, data } }] }],
        generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: "3:4" } },
      }),
    }
  );
  if (!resp.ok) {
    console.warn(`Gemini image ${model} failed with ${resp.status}`);
    if (resp.status === 429) quotaCooldownUntil[model] = Date.now() + 10 * 60_000;
    return null;
  }
  const body = await resp.json();
  const parts: Array<{ inlineData?: { data: string; mimeType: string } }> = body.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data)?.inlineData;
  return img ? { image: Buffer.from(img.data, "base64"), mimeType: img.mimeType || "image/png" } : null;
}

/**
 * Free face-restoration Spaces on Hugging Face (no billing). Free Spaces are slow and often asleep or
 * queued, so they are raced in parallel and the first finished result wins. HF_TOKEN (optional, free)
 * raises the ZeroGPU quota of the official CodeFormer Space.
 */
type GradioFile = { path: string; meta: { _type: "gradio.FileData" } };
const HF_SPACES: Array<{ name: string; host: string; api: string; data: (img: GradioFile) => unknown[]; output: number }> = [
  // CodeFormer, fidelity 0.8 leans toward the original face over the generative prior
  { name: "hf-leonelhs-codeformer", host: "leonelhs-codeformer.hf.space", api: "predict", data: (img) => [img], output: 1 },
  { name: "hf-maxorange-gfpgan", host: "maxorange-gfpgan-5.hf.space", api: "predict", data: (img) => [img, "v1.4", 2, 50], output: 0 },
  { name: "hf-maana-codeformer", host: "maana-codeformer.hf.space", api: "predict", data: (img) => [img, true, true, true, 2, 0.8], output: 0 },
  { name: "hf-sczhou-codeformer", host: "sczhou-codeformer.hf.space", api: "inference", data: (img) => [img, true, true, true, 2, 0.8], output: 0 },
];

async function callGradioSpace(space: (typeof HF_SPACES)[number], image: Buffer, mimeType: string, signal: AbortSignal): Promise<Result> {
  const base = `https://${space.host}`;
  const auth: Record<string, string> = process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};

  // Gradio 5+ serves its API under /gradio_api, Gradio 4 at the root
  const config = await (await fetch(`${base}/config`, { headers: auth, signal })).json();
  const prefix: string = typeof config.api_prefix === "string" ? config.api_prefix.replace(/\/$/, "") : "";

  const form = new FormData();
  form.append("files", new Blob([new Uint8Array(image)], { type: mimeType }), mimeType === "image/png" ? "photo.png" : "photo.jpg");
  const uploadResp = await fetch(`${base}${prefix}/upload`, { method: "POST", headers: auth, body: form, signal });
  if (!uploadResp.ok) return null;
  const [uploadedPath] = (await uploadResp.json()) as string[];
  const file: GradioFile = { path: uploadedPath, meta: { _type: "gradio.FileData" } };

  const callResp = await fetch(`${base}${prefix}/call/${space.api}`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ data: space.data(file) }),
    signal,
  });
  if (!callResp.ok) return null;
  const { event_id } = await callResp.json();

  // The result arrives as a server-sent event stream ending in "event: complete" (or "event: error")
  const stream = await (await fetch(`${base}${prefix}/call/${space.api}/${event_id}`, { headers: auth, signal })).text();
  const complete = stream.split(/\n\n/).find((block) => block.startsWith("event: complete"));
  if (!complete) return null;
  const dataLine = complete.split("\n").find((l) => l.startsWith("data:"));
  const outputs = dataLine ? JSON.parse(dataLine.slice(5)) : null;
  const out = Array.isArray(outputs) ? outputs[space.output] : null;
  const url: string | undefined = out?.url || (out?.path ? `${base}${prefix}/file=${out.path}` : undefined);
  if (!url) return null;

  const imgResp = await fetch(url, { headers: auth, signal });
  if (!imgResp.ok) return null;
  return { image: Buffer.from(await imgResp.arrayBuffer()), mimeType: imgResp.headers.get("content-type") || "image/png" };
}

async function raceHfSpaces(data: string, mimeType: string): Promise<{ result: Result; name: string } | null> {
  const image = Buffer.from(data, "base64");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100_000);
  try {
    return await Promise.any(
      HF_SPACES.map(async (space) => {
        const result = await callGradioSpace(space, image, mimeType, controller.signal);
        if (!result || result.image.length === 0) throw new Error(`${space.name}: no result`);
        return { result, name: space.name };
      })
    );
  } catch {
    return null; // every Space failed or timed out
  } finally {
    // The winner is in: stop waiting on the slower Spaces
    clearTimeout(timer);
    controller.abort();
  }
}

async function tryReplicateCodeFormer(dataUrl: string, token: string): Promise<Result> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  // Community models are addressed by version id, so look the current one up instead of hard-coding it
  const modelResp = await fetch("https://api.replicate.com/v1/models/sczhou/codeformer", { headers });
  if (!modelResp.ok) return null;
  const version: string | undefined = (await modelResp.json()).latest_version?.id;
  if (!version) return null;

  const createResp = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: { ...headers, Prefer: "wait=60" },
    body: JSON.stringify({
      version,
      // fidelity 0.8 leans toward the original face (identity) over the generative prior
      input: { image: dataUrl, codeformer_fidelity: 0.8, background_enhance: true, face_upsample: true, upscale: 2 },
    }),
  });
  if (!createResp.ok) {
    console.warn("Replicate CodeFormer failed with", createResp.status);
    return null;
  }
  let prediction = await createResp.json();
  const deadline = Date.now() + 90_000;
  while (["starting", "processing"].includes(prediction.status) && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls.get, { headers });
    if (!poll.ok) return null;
    prediction = await poll.json();
  }
  const outputUrl = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output;
  if (prediction.status !== "succeeded" || typeof outputUrl !== "string") return null;
  const imgResp = await fetch(outputUrl);
  if (!imgResp.ok) return null;
  return { image: Buffer.from(await imgResp.arrayBuffer()), mimeType: imgResp.headers.get("content-type") || "image/png" };
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();
    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }

    const mimeMatch = imageBase64.match(/^data:(image\/[\w.+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const data = imageBase64.replace(/^data:[a-zA-Z0-9/.+-]+;base64,/, "");

    type Attempt = [string, () => Promise<{ result: Result; name: string } | null>];
    const named = (name: string, run: () => Promise<Result>): Attempt => [
      name,
      async () => ({ result: await run(), name }),
    ];

    // Order: Gemini image (only with billing; skipped quickly on 429) -> free HF Spaces -> paid Replicate
    const attempts: Attempt[] = [];
    const geminiKey = getGeminiApiKey();
    if (geminiKey) {
      for (const model of GEMINI_IMAGE_MODELS) {
        attempts.push(named(model, () => tryGeminiImage(data, mimeType, geminiKey, model)));
      }
    }
    attempts.push(["hf-spaces", () => raceHfSpaces(data, mimeType)]);
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      attempts.push(
        named("replicate-codeformer", () => tryReplicateCodeFormer(`data:${mimeType};base64,${data}`, replicateToken))
      );
    }

    for (const [label, run] of attempts) {
      try {
        const answer = await run();
        if (answer?.result && answer.result.image.length > 0) {
          return NextResponse.json({
            success: true,
            provider: answer.name,
            imageBase64: `data:${answer.result.mimeType};base64,${answer.result.image.toString("base64")}`,
          });
        }
      } catch (err) {
        console.warn(`${label} photo restoration failed, trying next provider:`, err);
      }
    }

    // No AI restoration available: the client's own tone correction + sharpening is used
    return NextResponse.json({ success: true, provider: "client" });
  } catch (error) {
    console.error("Error in enhance-photo route:", error);
    return NextResponse.json({ success: true, provider: "client" });
  }
}
