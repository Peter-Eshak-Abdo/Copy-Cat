import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";

const FB_POSTS_ROOT = path.join(process.cwd(), "public", "uploads", "fb_posts");
const POOL_DIR = path.join(process.cwd(), "public", "uploads", "pool");
const PYTHON_PATH = path.join(process.cwd(), ".venv", "Scripts", "python.exe");

function ensureDirs() {
  if (!fs.existsSync(FB_POSTS_ROOT)) {
    fs.mkdirSync(FB_POSTS_ROOT, { recursive: true });
  }
  if (!fs.existsSync(POOL_DIR)) {
    fs.mkdirSync(POOL_DIR, { recursive: true });
  }
}

import { verifySessionTokenEdge } from "@/lib/edge-auth";
import { isAllowedFacebookUrl } from "@/lib/security";

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
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    ensureDirs();
    const entries = fs.readdirSync(FB_POSTS_ROOT, { withFileTypes: true });
    const documents = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
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
      }
    }

    // Sort newest first
    documents.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ success: true, documents });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "تعذر جلب المستندات السابقة";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// POST: Trigger download script and stream events via Server-Sent Events (SSE)
export async function POST(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    ensureDirs();
    const body = await req.json();
    const { url, title, saveToPool = true, maxPhotos = 120 } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json({ success: false, error: "رابط المنشور مطلوب." }, { status: 400 });
    }

    // SSRF Defense: strictly validate URL belongs to legitimate Facebook domains
    if (!isAllowedFacebookUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: "الرابط غير صالح. يرجى التأكد من إدخال رابط فيسبوك صحيح (facebook.com).",
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

        const args = [
            scriptPath,
            "--url", url,
            "--out-dir", outDir,
            "--pdf-name", pdfFilename,
            "--max", String(maxPhotos),
        ];

        const pyProc = spawn(pythonExecutable, args, {
          cwd: process.cwd(),
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        });

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

              // If completed and user requested pool sync, copy to pool
              if (parsed.type === "completed" && saveToPool) {
                try {
                  const downloadedFiles = fs.readdirSync(outDir);
                  for (const f of downloadedFiles) {
                    if ([".jpg", ".jpeg", ".png"].includes(path.extname(f).toLowerCase())) {
                      const src = path.join(outDir, f);
                      const dest = path.join(POOL_DIR, `fb_${folderName}_${f}`);
                      fs.copyFileSync(src, dest);
                    }
                  }
                } catch (e) {
                  console.warn("Error copying to pool:", e);
                }
              }

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
                `data: ${JSON.stringify({ type: "error", message: `انتهت العملية بكود خطأ (${code})` })}\n\n`
              )
            );
          }
          controller.close();
        });

        pyProc.on("error", (err) => {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "error", message: `فشل تشغيل بايثون: ${err.message}` })}\n\n`)
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
    const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة الطلب";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
