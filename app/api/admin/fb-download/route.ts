import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import os from "os";
import { PDFDocument } from "pdf-lib";
import { verifySessionTokenEdge } from "@/lib/edge-auth";
import { isAllowedFacebookUrl } from "@/lib/security";

const LOCAL_POSTS_ROOT = path.join(process.cwd(), "public", "uploads", "fb_posts");

function getPythonExecutable(): string | null {
  const winVenv = path.join(process.cwd(), ".venv", "Scripts", "python.exe");
  if (fs.existsSync(winVenv)) return winVenv;

  const posixVenv = path.join(process.cwd(), ".venv", "bin", "python");
  if (fs.existsSync(posixVenv)) return posixVenv;

  return null;
}

/**
 * Returns a guaranteed writable directory for storing generated documents.
 * In local dev: public/uploads/fb_posts
 * On Vercel / serverless: os.tmpdir()/copycat_fb_posts
 */
function getStorageRoot(): { rootDir: string; isServerless: boolean } {
  try {
    if (!fs.existsSync(LOCAL_POSTS_ROOT)) {
      fs.mkdirSync(LOCAL_POSTS_ROOT, { recursive: true });
    }
    // Verify write permissions
    const testFile = path.join(LOCAL_POSTS_ROOT, `.write_test_${Date.now()}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return { rootDir: LOCAL_POSTS_ROOT, isServerless: false };
  } catch {
    // Read-only filesystem (Vercel Lambda)
    const tmpDir = path.join(os.tmpdir(), "copycat_fb_posts");
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    } catch {}
    return { rootDir: tmpDir, isServerless: true };
  }
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  const token =
    req.cookies.get("copycat_session_token")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const auth = await verifySessionTokenEdge(token);
  return auth.isValid;
}

// GET: List past generated Facebook PDFs OR download a specific file
export async function GET(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json(
        { success: false, error: "وصول غير مصرح به. يرجى تسجيل الدخول كمسؤول." },
        { status: 401 }
      );
    }

    const downloadParam = req.nextUrl.searchParams.get("download");
    const dirParam = req.nextUrl.searchParams.get("dir");
    const fileParam = req.nextUrl.searchParams.get("file");

    const { rootDir, isServerless } = getStorageRoot();

    // Direct File Download Handler (Supports both local and /tmp storage)
    if (downloadParam === "1" && dirParam && fileParam) {
      const safeDir = path.basename(dirParam);
      const safeFile = path.basename(fileParam);

      // Search in both primary root and fallback local root
      const candidatePaths = [
        path.join(/* turbopackIgnore: true */ rootDir, safeDir, safeFile),
        path.join(LOCAL_POSTS_ROOT, safeDir, safeFile),
        path.join(/* turbopackIgnore: true */ os.tmpdir(), "copycat_fb_posts", safeDir, safeFile),
      ];

      for (const targetPath of candidatePaths) {
        if (fs.existsSync(targetPath)) {
          const fileBytes = fs.readFileSync(targetPath);
          const ext = path.extname(safeFile).toLowerCase();
          const contentType =
            ext === ".pdf"
              ? "application/pdf"
              : [".jpg", ".jpeg"].includes(ext)
              ? "image/jpeg"
              : ext === ".png"
              ? "image/png"
              : "application/octet-stream";

          return new Response(fileBytes, {
            headers: {
              "Content-Type": contentType,
              "Content-Disposition": `attachment; filename="${encodeURIComponent(safeFile)}"`,
              "Cache-Control": "public, max-age=3600",
            },
          });
        }
      }

      return NextResponse.json(
        { success: false, error: "الملف المطلوب غير موجود أو تم تنظيفه." },
        { status: 404 }
      );
    }

    // List History of Documents safely
    const documents = [];
    const scannedDirs = new Set<string>();

    const dirsToScan = [rootDir];
    if (rootDir !== LOCAL_POSTS_ROOT && fs.existsSync(LOCAL_POSTS_ROOT)) {
      dirsToScan.push(LOCAL_POSTS_ROOT);
    }

    for (const scanDir of dirsToScan) {
      try {
        if (!fs.existsSync(scanDir)) continue;
        const entries = fs.readdirSync(/* turbopackIgnore: true */ scanDir, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.isDirectory() && !scannedDirs.has(entry.name)) {
            scannedDirs.add(entry.name);
            try {
              const docDir = path.join(/* turbopackIgnore: true */ scanDir, entry.name);
              const subFiles = fs.readdirSync(/* turbopackIgnore: true */ docDir);
              const pdfFile = subFiles.find((f) => f.toLowerCase().endsWith(".pdf"));
              const images = subFiles
                .filter((f) =>
                  [".jpg", ".jpeg", ".png", ".webp"].includes(path.extname(f).toLowerCase())
                )
                .sort();

              if (pdfFile || images.length > 0) {
                const stats = fs.statSync(/* turbopackIgnore: true */ docDir);
                const pdfDownloadUrl = pdfFile
                  ? isServerless
                    ? `/api/admin/fb-download?download=1&dir=${encodeURIComponent(entry.name)}&file=${encodeURIComponent(pdfFile)}`
                    : `/uploads/fb_posts/${entry.name}/${pdfFile}`
                  : null;

                const previewUrl =
                  images.length > 0
                    ? isServerless
                      ? `/api/admin/fb-download?download=1&dir=${encodeURIComponent(entry.name)}&file=${encodeURIComponent(images[0])}`
                      : `/uploads/fb_posts/${entry.name}/${images[0]}`
                    : null;

                documents.push({
                  id: entry.name,
                  title: entry.name.replace(/^doc_\d+_/, "").replace(/_/g, " "),
                  dirName: entry.name,
                  pdfUrl: pdfDownloadUrl,
                  pdfFilename: pdfFile || null,
                  imageCount: images.length,
                  previewImage: previewUrl,
                  images: images.map((img) =>
                    isServerless
                      ? `/api/admin/fb-download?download=1&dir=${encodeURIComponent(entry.name)}&file=${encodeURIComponent(img)}`
                      : `/uploads/fb_posts/${entry.name}/${img}`
                  ),
                  createdAt: stats.birthtimeMs || stats.mtimeMs || Date.now(),
                });
              }
            } catch (dirErr) {
              console.warn(`Error reading document dir ${entry.name}:`, dirErr);
            }
          }
        }
      } catch (scanErr) {
        console.warn("Scan dir error:", scanErr);
      }
    }

    // Sort newest first
    documents.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({ success: true, documents });
  } catch (err: unknown) {
    console.error("GET /api/admin/fb-download error:", err);
    return NextResponse.json({ success: true, documents: [] });
  }
}

/**
 * Universal Native Scraper: Extract high-res Facebook CDN image URLs
 */
function extractFacebookImageUrls(html: string): string[] {
  // Unescape JSON escaped slashes and HTML entities
  const unescaped = html
    .replace(/\\\//g, "/")
    .replace(/\\u0026/g, "&")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

  const validUrls: string[] = [];
  const seen = new Set<string>();

  // 1. First, check og:image and twitter:image meta tags (primary high-res source)
  const ogMatches = unescaped.matchAll(
    /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/gi
  );
  for (const match of ogMatches) {
    const rawUrl = match[1];
    if (rawUrl && (rawUrl.includes("fbcdn.net") || rawUrl.includes("scontent"))) {
      const cleanUrl = rawUrl.split('"')[0].split("'")[0].split("\\")[0];
      const baseKey = cleanUrl.split("?")[0];
      if (!seen.has(baseKey)) {
        seen.add(baseKey);
        validUrls.push(cleanUrl);
      }
    }
  }

  // 2. Scan for high-res photo URLs in page body / JSON bundles
  const regex = /https?:\/\/[a-zA-Z0-9.-]*(?:fbcdn\.net|scontent[a-zA-Z0-9.-]*)\/[^\s"'<>\\]+/g;
  const matches = unescaped.match(regex) || [];

  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.split('"')[0].split("'")[0].split("\\")[0];
    const u = cleanUrl.toLowerCase();

    // Ignore UI elements, avatars, emojis, keyframe animations, small icons
    if (
      u.includes("rsrc.php") ||
      u.includes("emoji.php") ||
      u.includes("static.xx") ||
      u.includes("favicon") ||
      u.includes("/badges/") ||
      u.includes("/icons/") ||
      u.includes("s150x150") ||
      u.includes("p50x50") ||
      u.includes("p100x100") ||
      u.includes("s50x50") ||
      u.includes("p32x32") ||
      u.includes("s384x384") ||
      u.includes("p384x384") ||
      u.includes("t1.30497") ||
      u.includes("cp0") ||
      u.includes(".kf")
    ) {
      continue;
    }

    // Typical high-res photo path markers on Facebook CDN
    if (
      u.includes(".jpg") ||
      u.includes(".jpeg") ||
      u.includes(".png") ||
      u.includes(".webp") ||
      u.includes("dst-jpg") ||
      u.includes("t39.30808-6") ||
      u.includes("scontent")
    ) {
      // Deduplicate by base path (ignore volatile token query params)
      const baseKey = cleanUrl.split("?")[0];
      if (!seen.has(baseKey)) {
        seen.add(baseKey);
        validUrls.push(cleanUrl);
      }
    }
  }

  return validUrls;
}

// POST: Trigger download script or native scraper and stream events via SSE
export async function POST(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json(
        { success: false, error: "وصول غير مصرح به. انتهت جلسة الدخول." },
        { status: 401 }
      );
    }

    let body: { url?: string; title?: string; maxPhotos?: number };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { success: false, error: "صيغة الطلب غير صالحة. يرجى إرسال بيانات JSON صحيحة." },
        { status: 400 }
      );
    }

    const title = body?.title;
    const maxPhotos = Math.max(1, Math.min(200, Number(body?.maxPhotos) || 120));
    let url = body?.url;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { success: false, error: "رابط المنشور مطلوب. يرجى لصق رابط منشور أو ألبوم الفيسبوك." },
        { status: 400 }
      );
    }

    url = url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    // SSRF Defense
    if (!isAllowedFacebookUrl(url)) {
      return NextResponse.json(
        {
          success: false,
          error: "الرابط غير صالح. يرجى التأكد من إدخال رابط فيسبوك صحيح (مثل facebook.com أو fb.watch).",
        },
        { status: 400 }
      );
    }

    const { rootDir, isServerless } = getStorageRoot();

    const timestamp = Date.now();
    const safeTitle = (title || "ملزمة_فيسبوك")
      .trim()
      .replace(/[\\/*?:"<>|]/g, "_")
      .substring(0, 50);

    const folderName = `doc_${timestamp}_${safeTitle}`;
    const outDir = path.join(rootDir, folderName);
    const pdfFilename = `${safeTitle}.pdf`;

    try {
      fs.mkdirSync(outDir, { recursive: true });
    } catch (mkdirErr) {
      console.warn("Failed to create outDir:", mkdirErr);
    }

    const encoder = new TextEncoder();

    // Check if Local Python virtual environment is available with playwright
    const pythonExecutable = getPythonExecutable();
    const scriptPath = path.join(process.cwd(), "scripts", "download_fb_post.py");
    const hasPythonScript = !isServerless && !!pythonExecutable && fs.existsSync(scriptPath);

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        // Strategy A: Local Python with Playwright (if running on desktop/local server)
        if (hasPythonScript) {
          sendEvent({
            type: "status",
            message: "جاري تشغيل محرك الفيس بوك المحلي بالمتصفح...",
          });

          const args = [
            scriptPath,
            "--url",
            url!,
            "--out-dir",
            outDir,
            "--pdf-name",
            pdfFilename,
            "--max",
            String(maxPhotos),
          ];

          let pyProc;
          try {
            pyProc = spawn(pythonExecutable, args, {
              cwd: process.cwd(),
              env: { ...process.env, PYTHONIOENCODING: "utf-8" },
            });
          } catch (spawnErr) {
            console.warn("Python spawn failed, falling back to native engine:", spawnErr);
            // Fall through to native extractor below
          }

          if (pyProc) {
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
                  sendEvent(parsed);
                } catch {
                  sendEvent({ type: "log", message: trimmed });
                }
              }
            });

            pyProc.stderr.on("data", (errChunk: Buffer) => {
              const errText = errChunk.toString("utf-8").trim();
              if (errText) {
                sendEvent({ type: "log", level: "stderr", message: errText });
              }
            });

            pyProc.on("close", (code) => {
              if (code !== 0) {
                sendEvent({
                  type: "error",
                  message: `انتهت العملية بكود (${code}). إذا كان المنشور في مجموعة مغلقة، يمكنك سحب وإفلات الصور يدوياً أدناه لتجميعها فوراً.`,
                });
              }
              controller.close();
            });

            pyProc.on("error", (err) => {
              sendEvent({
                type: "error",
                message: `تعذر تشغيل بايثون (${err.message})، جاري التبديل للمحرك السحابي...`,
              });
              controller.close();
            });

            return; // Finished setting up Python process
          }
        }

        // Strategy B: Universal Native Multi-Engine Scraper & pdf-lib Compiler (100% Serverless / Vercel Ready)
        sendEvent({
          type: "status",
          message: "جاري الاتصال بخوادم فيسبوك واستخراج الصور المتاحة...",
        });

        try {
          // Normalize base URLs
          const cleanBaseUrl = url!.replace(/(\?|&)fbclid=[^&]*/, "");
          const mobileUrl = cleanBaseUrl
            .replace("www.facebook.com", "m.facebook.com")
            .replace("web.facebook.com", "m.facebook.com");

          // Multiple realistic client profiles without bot-triggering Sec-Ch headers
          const fetchAttempts: {
            name: string;
            url: string;
            headers: Record<string, string>;
          }[] = [
            {
              name: "النسخة الخفيفة (Facebook Mobile Web)",
              url: mobileUrl,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
              },
            },
            {
              name: "محرك Meta لاستعراض الروابط (Facebook Externalhit)",
              url: cleanBaseUrl,
              headers: {
                "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
                Accept: "*/*",
                "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
              },
            },
            {
              name: "نسخة سطح المكتب النقية (Clean Desktop)",
              url: cleanBaseUrl,
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
              },
            },
            {
              name: "محرك الفهرسة ومحركات البحث (Search Indexer)",
              url: cleanBaseUrl,
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
                Accept: "*/*",
                "Accept-Language": "ar,en-US;q=0.9,en;q=0.8",
              },
            },
          ];

          let imageUrls: string[] = [];

          for (const attempt of fetchAttempts) {
            try {
              sendEvent({
                type: "status",
                message: `جاري فحص المنشور عبر ${attempt.name}...`,
              });

              const resp = await fetch(attempt.url, {
                headers: attempt.headers,
                redirect: "follow",
              });

              if (resp.ok) {
                const html = await resp.text();
                const extracted = extractFacebookImageUrls(html);
                if (extracted.length > 0) {
                  imageUrls = extracted;
                  break;
                }
              }
            } catch (attemptErr) {
              console.warn(`Scraper attempt ${attempt.name} failed:`, attemptErr);
            }
          }

          if (imageUrls.length === 0) {
            sendEvent({
              type: "error",
              message:
                "هذا المنشور خاص أو يتطلب تسجيل الدخول بحساب فيسبوك. لحسن الحظ يمكنك سحب وإفلات صور الملزمة مباشرة في صندوق الرفع أدناه لتوليد ملف الـ PDF فوراً للطباعة!",
            });
            controller.close();
            return;
          }

          const limitedUrls = imageUrls.slice(0, maxPhotos);

          sendEvent({
            type: "status",
            message: `تم اكتشاف ${limitedUrls.length} صورة بالترتيب! جاري التحميل فائق السرعة...`,
          });

          // Download all images in memory
          const downloadedBuffers: { buffer: Buffer; filename: string; webUrl: string }[] = [];

          for (let i = 0; i < limitedUrls.length; i++) {
            const imgUrl = limitedUrls[i];
            const pageNum = i + 1;
            const filename = `page_${String(pageNum).padStart(3, "0")}.jpg`;
            const destPath = path.join(outDir, filename);

            try {
              const imgResp = await fetch(imgUrl, {
                headers: { Referer: "https://www.facebook.com/" },
              });

              if (imgResp.ok) {
                const arrayBuf = await imgResp.arrayBuffer();
                const buf = Buffer.from(arrayBuf);

                if (buf.length > 2000) {
                  try {
                    fs.writeFileSync(destPath, buf);
                  } catch {}

                  const webImgUrl = isServerless
                    ? `/api/admin/fb-download?download=1&dir=${encodeURIComponent(folderName)}&file=${encodeURIComponent(filename)}`
                    : `/uploads/fb_posts/${folderName}/${filename}`;

                  downloadedBuffers.push({ buffer: buf, filename, webUrl: webImgUrl });

                  sendEvent({
                    type: "progress",
                    current: pageNum,
                    image_url: imgUrl,
                  });

                  sendEvent({
                    type: "download_progress",
                    downloaded: downloadedBuffers.length,
                    total: limitedUrls.length,
                    file_name: filename,
                  });
                }
              }
            } catch (dlErr) {
              console.warn(`Failed to download image ${i + 1}:`, dlErr);
            }
          }

          if (downloadedBuffers.length === 0) {
            sendEvent({
              type: "error",
              message: "تعذر تحميل الصور من خوادم فيس بوك. يرجى تجربة رفع الصور مباشرة.",
            });
            controller.close();
            return;
          }

          // Compile into PDF using pdf-lib
          sendEvent({
            type: "status",
            message: `جاري تجميع ${downloadedBuffers.length} صفحة في ملف PDF عالي الجودة للطباعة...`,
          });

          const pdfDoc = await PDFDocument.create();

          for (const item of downloadedBuffers) {
            try {
              let img;
              const isPng =
                item.buffer[0] === 0x89 &&
                item.buffer[1] === 0x50 &&
                item.buffer[2] === 0x4e &&
                item.buffer[3] === 0x47;

              if (isPng) {
                img = await pdfDoc.embedPng(item.buffer);
              } else {
                img = await pdfDoc.embedJpg(item.buffer);
              }

              const page = pdfDoc.addPage([img.width, img.height]);
              page.drawImage(img, {
                x: 0,
                y: 0,
                width: img.width,
                height: img.height,
              });
            } catch (embedErr) {
              console.warn("Skipping corrupt image in PDF:", embedErr);
            }
          }

          const pdfBytes = await pdfDoc.save();
          const pdfPath = path.join(outDir, pdfFilename);

          try {
            fs.writeFileSync(pdfPath, Buffer.from(pdfBytes));
          } catch {}

          const finalPdfUrl = isServerless
            ? `/api/admin/fb-download?download=1&dir=${encodeURIComponent(folderName)}&file=${encodeURIComponent(pdfFilename)}`
            : `/uploads/fb_posts/${folderName}/${pdfFilename}`;

          sendEvent({
            type: "completed",
            total_images: downloadedBuffers.length,
            pdf_url: finalPdfUrl,
            pdf_filename: pdfFilename,
            images: downloadedBuffers.map((b) => b.webUrl),
            message: `تم سحب ودمج ${downloadedBuffers.length} صفحة بنجاح في ملف PDF جاهز للطباعة فوراً!`,
          });

          controller.close();
        } catch (nativeErr: unknown) {
          const msg = nativeErr instanceof Error ? nativeErr.message : "خطأ غير متوقع";
          sendEvent({
            type: "error",
            message: `تعذر معالجة المنشور: ${msg}`,
          });
          controller.close();
        }
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
    const message =
      err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء معالجة الطلب في الخادم";
    console.error("POST /api/admin/fb-download error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
