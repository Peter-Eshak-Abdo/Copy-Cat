import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { verifySessionTokenEdge } from "@/lib/edge-auth";
import { isAllowedFacebookUrl } from "@/lib/security";

const FB_POSTS_ROOT = path.join(process.cwd(), "public", "uploads", "fb_posts");
const PYTHON_PATH = path.join(process.cwd(), ".venv", "Scripts", "python.exe");

function ensureDirs() {
  if (!fs.existsSync(FB_POSTS_ROOT)) {
    fs.mkdirSync(FB_POSTS_ROOT, { recursive: true });
  }
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  const token =
    req.cookies.get("copycat_session_token")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const auth = await verifySessionTokenEdge(token);
  return auth.isValid;
}

// GET: list past generated Facebook PDFs
export async function GET(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به. يرجى تسجيل الدخول كمسؤول." }, { status: 401 });
    }

    ensureDirs();
    const entries = fs.readdirSync(FB_POSTS_ROOT, { withFileTypes: true });
    const documents = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          const docDir = path.join(FB_POSTS_ROOT, entry.name);
          const subFiles = fs.readdirSync(docDir);
          const pdfFile = subFiles.find((f) => f.toLowerCase().endsWith(".pdf"));
          const images = subFiles
            .filter((f) => [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(f).toLowerCase()))
            .sort();

          if (pdfFile || images.length > 0) {
            const stats = fs.statSync(docDir);
            documents.push({
              id: entry.name,
              title: entry.name.replace(/^doc_\d+_/, "").replace(/_/g, " "),
              dirName: entry.name,
              pdfUrl: pdfFile ? `/uploads/fb_posts/${entry.name}/${pdfFile}` : null,
              pdfFilename: pdfFile || null,
              imageCount: images.length,
              previewImage: images.length > 0 ? `/uploads/fb_posts/${entry.name}/${images[0]}` : null,
              images: images.map((img) => `/uploads/fb_posts/${entry.name}/${img}`),
              createdAt: stats.birthtimeMs || stats.mtimeMs || Date.now(),
            });
          }
        } catch (dirErr) {
          console.warn(`Error reading document dir ${entry.name}:`, dirErr);
        }
      }
    }

    // Sort newest first
    documents.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ success: true, documents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "تعذر جلب المستندات السابقة من الخادم";
    console.error("GET /api/admin/fb-download error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: Trigger download script and stream events via Server-Sent Events (SSE)
export async function POST(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به. انتهت جلسة الدخول." }, { status: 401 });
    }

    ensureDirs();

    let body: { url?: string; title?: string; maxPhotos?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ success: false, error: "صيغة الطلب غير صالحة. يرجى إرسال بيانات JSON صحيحة." }, { status: 400 });
    }

    const title = body?.title;
    const maxPhotos = body?.maxPhotos ?? 120;
    let url = body?.url;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json({ success: false, error: "رابط المنشور مطلوب. يرجى لصق رابط منشور أو ألبوم الفيسبوك." }, { status: 400 });
    }

    url = url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // SSRF Defense: strictly validate URL belongs to legitimate Facebook domains
    if (!isAllowedFacebookUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: "الرابط غير صالح. يرجى التأكد من إدخال رابط فيسبوك صحيح (مثل facebook.com أو fb.watch).",
        },
        { status: 400 }
      );
    }

    const timestamp = Date.now();
    const safeTitle = (title || "ملزمة_فيسبوك")
      .trim()
      .replace(/[\\/*?:"<>|]/g, "_")
      .substring(0, 50);

    const folderName = `doc_${timestamp}_${safeTitle}`;
    const outDir = path.join(FB_POSTS_ROOT, folderName);
    const pdfFilename = `${safeTitle}.pdf`;

    fs.mkdirSync(outDir, { recursive: true });

    // Stream responses using ReadableStream
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      start(controller) {
        const pythonExecutable = fs.existsSync(PYTHON_PATH) ? PYTHON_PATH : "python";
        const scriptPath = path.join(process.cwd(), "scripts", "download_fb_post.py");

        if (!fs.existsSync(scriptPath)) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: "ملف سكريبت التحميل download_fb_post.py غير موجود في مجلد scripts." })}\n\n`)
          );
          controller.close();
          return;
        }

        const args = [
          scriptPath,
          "--url", url,
          "--out-dir", outDir,
          "--pdf-name", pdfFilename,
          "--max", String(Math.max(1, Math.min(200, Number(maxPhotos) || 120))),
        ];

        let pyProc;
        try {
          pyProc = spawn(pythonExecutable, args, {
            cwd: process.cwd(),
            env: { ...process.env, PYTHONIOENCODING: "utf-8" },
          });
        } catch (spawnErr: unknown) {
          const errMsg = spawnErr instanceof Error ? spawnErr.message : "خطأ غير معروف";
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: `تعذر تشغيل بيئة بايثون: ${errMsg}` })}\n\n`)
          );
          controller.close();
          return;
        }

        let lineBuffer = "";

        pyProc.stdout.on("data", (chunk: Buffer) => {
          lineBuffer += chunk.toString("utf-8");
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const parsed = JSON.parse(trimmed);
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
            } catch {
              // Not JSON, send as log
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "log", message: trimmed })}\n\n`)
              );
            }
          }
        });

        pyProc.stderr.on("data", (errChunk: Buffer) => {
          const errText = errChunk.toString("utf-8").trim();
          if (errText) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "log", level: "stderr", message: errText })}\n\n`)
            );
          }
        });

        pyProc.on("close", (code) => {
          if (code !== 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "error", message: `انتهت عملية الفيس بوك بكود (${code}). يرجى التحقق من خصوصية المنشور أو صلاحية الرابط.` })}\n\n`
              )
            );
          }
          controller.close();
        });

        pyProc.on("error", (err) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: `فشل تشغيل بيئة بايثون: ${err.message}` })}\n\n`)
          );
          controller.close();
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة الطلب في الخادم";
    console.error("POST /api/admin/fb-download error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
