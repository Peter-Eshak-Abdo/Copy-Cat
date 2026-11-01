import { NextRequest, NextResponse } from "next/server";

/**
 * Server-side background removal for passport photos. Providers are tried in order of cut-out quality
 * on hair and shoulders; each one is only used when its key is configured (see claude-req.md).
 * With no key configured the client falls back to the in-browser ISNet model.
 */
async function tryRemoveBg(buffer: Buffer, apiKey: string): Promise<Buffer | null> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(buffer)]), "photo.jpg");
  form.append("size", "auto");
  form.append("type", "person");
  form.append("format", "png");
  const resp = await fetch("https://api.remove.bg/v1.0/removebg", {
    method: "POST",
    headers: { "X-Api-Key": apiKey },
    body: form,
    signal: AbortSignal.timeout(40_000),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => "");
    console.warn("remove.bg failed:", resp.status, detail);
    // 402: the monthly free calls and paid credits are used up
    if (resp.status === 402) throw new Error("quota");
    throw new Error(`remove.bg ${resp.status}: ${detail.slice(0, 200)}`);
  }
  return Buffer.from(await resp.arrayBuffer());
}

async function tryPhotoroom(buffer: Buffer, apiKey: string): Promise<Buffer | null> {
  const form = new FormData();
  form.append("image_file", new Blob([new Uint8Array(buffer)]), "photo.jpg");
  const resp = await fetch("https://sdk.photoroom.com/v1/segment", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  if (!resp.ok) {
    console.warn("Photoroom failed:", resp.status, await resp.text().catch(() => ""));
    return null;
  }
  return Buffer.from(await resp.arrayBuffer());
}

async function tryHuggingFace(buffer: Buffer, token: string): Promise<Buffer | null> {
  const resp = await fetch("https://router.huggingface.co/hf-inference/models/briaai/RMBG-1.4", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "image/jpeg" },
    body: new Uint8Array(buffer),
  });
  // Only accept an actual image; segmentation JSON responses are not a usable cut-out
  if (!resp.ok || !(resp.headers.get("content-type") || "").startsWith("image/")) return null;
  return Buffer.from(await resp.arrayBuffer());
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }

    const buffer = Buffer.from(imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, ""), "base64");

    const providers: Array<[string, string | undefined, (b: Buffer, k: string) => Promise<Buffer | null>]> = [
      ["remove.bg", process.env.REMOVE_BG_API_KEY, tryRemoveBg],
      ["photoroom", process.env.PHOTOROOM_API_KEY, tryPhotoroom],
      ["hf-rmbg", process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY, tryHuggingFace],
    ];

    const quotaExhausted: string[] = [];
    // Why each provider failed, returned to the page (and its console) so a photo that kept its
    // background can be explained
    const errors: string[] = [];
    for (const [name, key, run] of providers) {
      if (!key) continue;
      try {
        const png = await run(buffer, key);
        if (png && png.length > 0) {
          return NextResponse.json({
            success: true,
            cutoutBase64: `data:image/png;base64,${png.toString("base64")}`,
            provider: name,
          });
        }
      } catch (err) {
        if (err instanceof Error && err.message === "quota") quotaExhausted.push(name);
        else {
          console.warn(`${name} background removal failed, trying next provider:`, err);
          errors.push(err instanceof Error ? err.message : String(err));
        }
      }
    }

    // No server provider configured or all failed: the client uses its in-browser model
    return NextResponse.json({
      success: true,
      message: "الخلفية جاهزة للمعالجة والتبييض.",
      provider: "client-canvas",
      quotaExhausted,
      errors,
    });
  } catch (error) {
    console.error("Error in remove-bg route:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء محاولة عزل الخلفية." },
      { status: 500 }
    );
  }
}
