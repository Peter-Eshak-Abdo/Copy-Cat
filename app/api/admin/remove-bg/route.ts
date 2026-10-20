import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "لم يتم تقديم بيانات الصورة." }, { status: 400 });
    }

    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "");
    const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_KEY;

    // 1. Try Hugging Face Serverless Inference with RMBG-1.4 or RMBG-2.0 if token available
    if (hfToken) {
      try {
        const hfResp = await fetch("https://api-inference.huggingface.co/models/briaai/RMBG-1.4", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${hfToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ inputs: cleanBase64 }),
        });

        if (hfResp.ok) {
          const buffer = await hfResp.arrayBuffer();
          const base64Out = Buffer.from(buffer).toString("base64");
          return NextResponse.json({
            success: true,
            cutoutBase64: `data:image/png;base64,${base64Out}`,
            provider: "hf-rmbg",
          });
        }
      } catch (hfErr) {
        console.warn("Hugging Face RMBG failed, falling back:", hfErr);
      }
    }

    // 2. Return success indicator so frontend can use client-side or fallback
    return NextResponse.json({
      success: true,
      message: "الخلفية جاهزة للمعالجة والتبييض.",
      provider: "client-canvas",
    });
  } catch (error) {
    console.error("Error in remove-bg route:", error);
    return NextResponse.json(
      { error: "حدث خطأ أثناء محاولة عزل الخلفية." },
      { status: 500 }
    );
  }
}
