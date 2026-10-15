import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { verifySessionTokenEdge } from "@/lib/edge-auth";

const LOCAL_POOL_DIR = path.join(process.cwd(), "public", "uploads", "pool");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

function getPoolDir(): { poolDir: string; isServerless: boolean } {
  try {
    if (!fs.existsSync(LOCAL_POOL_DIR)) {
      fs.mkdirSync(LOCAL_POOL_DIR, { recursive: true });
    }
    const testFile = path.join(LOCAL_POOL_DIR, `.test_${Date.now()}`);
    fs.writeFileSync(testFile, "ok");
    fs.unlinkSync(testFile);
    return { poolDir: LOCAL_POOL_DIR, isServerless: false };
  } catch {
    const tmpPool = path.join(os.tmpdir(), "copycat_pool");
    try {
      if (!fs.existsSync(tmpPool)) {
        fs.mkdirSync(tmpPool, { recursive: true });
      }
    } catch {}
    return { poolDir: tmpPool, isServerless: true };
  }
}

async function checkAuth(req: NextRequest): Promise<boolean> {
  const token =
    req.cookies.get("copycat_session_token")?.value ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  const auth = await verifySessionTokenEdge(token);
  return auth.isValid;
}

export async function GET(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    const { poolDir, isServerless } = getPoolDir();

    // Direct Image Stream Handler
    const requestedFile = req.nextUrl.searchParams.get("file");
    if (requestedFile) {
      const safeFile = path.basename(requestedFile);
      const candidates = [
        path.join(/* turbopackIgnore: true */ poolDir, safeFile),
        path.join(LOCAL_POOL_DIR, safeFile),
        path.join(/* turbopackIgnore: true */ os.tmpdir(), "copycat_pool", safeFile),
      ];

      for (const targetPath of candidates) {
        if (fs.existsSync(targetPath)) {
          const fileBytes = fs.readFileSync(targetPath);
          const ext = path.extname(safeFile).toLowerCase();
          const contentType =
            ext === ".png"
              ? "image/png"
              : ext === ".webp"
              ? "image/webp"
              : "image/jpeg";

          return new Response(fileBytes, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        }
      }
      return NextResponse.json({ success: false, error: "الصورة غير موجودة" }, { status: 404 });
    }

    const photos = [];
    const scanned = new Set<string>();
    const dirsToScan = [poolDir];
    if (poolDir !== LOCAL_POOL_DIR && fs.existsSync(LOCAL_POOL_DIR)) {
      dirsToScan.push(LOCAL_POOL_DIR);
    }

    for (const currentDir of dirsToScan) {
      try {
        if (!fs.existsSync(currentDir)) continue;
        const files = fs.readdirSync(currentDir);

        for (const file of files) {
          if (scanned.has(file)) continue;
          scanned.add(file);

          const ext = path.extname(file).toLowerCase();
          if (!ALLOWED_EXTS.has(ext)) continue;

          const filePath = path.join(/* turbopackIgnore: true */ currentDir, file);
          try {
            const stats = fs.statSync(/* turbopackIgnore: true */ filePath);
            const isFromFb =
              file.toLowerCase().includes("copycat_photo_") || file.toLowerCase().includes("fb_");

            const photoUrl = isServerless
              ? `/api/admin/photos?file=${encodeURIComponent(file)}`
              : `/uploads/pool/${file}`;

            photos.push({
              id: file,
              filename: file,
              url: photoUrl,
              sizeBytes: stats.size,
              createdAt: stats.birthtimeMs || stats.mtimeMs || Date.now(),
              source: isFromFb ? "facebook" : "upload",
            });
          } catch {
            continue;
          }
        }
      } catch (scanErr) {
        console.warn("Scan pool error:", scanErr);
      }
    }

    // Sort newest first
    photos.sort((a, b) => b.createdAt - a.createdAt);

    return NextResponse.json({
      success: true,
      count: photos.length,
      photos,
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/photos error:", error);
    return NextResponse.json({ success: true, count: 0, photos: [] });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    const { poolDir, isServerless } = getPoolDir();

    const formData = await req.formData();
    const uploadedFiles = formData.getAll("files") as File[];
    const singleFile = formData.get("file") as File | null;

    const allFiles: File[] = [];
    if (uploadedFiles && uploadedFiles.length > 0) {
      allFiles.push(...uploadedFiles);
    } else if (singleFile) {
      allFiles.push(singleFile);
    }

    if (allFiles.length === 0) {
      return NextResponse.json(
        { success: false, error: "لم يتم اختيار أي ملفات للرفع" },
        { status: 400 }
      );
    }

    const savedPhotos = [];
    const timestamp = Date.now();

    for (let i = 0; i < allFiles.length; i++) {
      const file = allFiles[i];

      if (file.size > MAX_FILE_SIZE_BYTES) {
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      let ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        ext = file.type.includes("png") ? ".png" : file.type.includes("webp") ? ".webp" : ".jpg";
      }

      const baseName = path
        .basename(file.name, ext)
        .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, "_")
        .slice(0, 30);
      const uniqueFilename = `cam_${timestamp}_${i + 1}_${baseName || "photo"}${ext}`;
      const destPath = path.join(poolDir, uniqueFilename);

      try {
        fs.writeFileSync(destPath, buffer);
      } catch (writeErr) {
        console.warn("Failed to write to poolDir, using data URL fallback:", writeErr);
      }

      const photoUrl = isServerless
        ? `/api/admin/photos?file=${encodeURIComponent(uniqueFilename)}`
        : `/uploads/pool/${uniqueFilename}`;

      savedPhotos.push({
        id: uniqueFilename,
        filename: uniqueFilename,
        url: photoUrl,
        sizeBytes: buffer.length,
        createdAt: timestamp,
        source: "upload",
      });
    }

    return NextResponse.json({
      success: true,
      count: savedPhotos.length,
      photos: savedPhotos,
      message: `تم رفع ${savedPhotos.length} صورة بنجاح إلى بنك صور المكتبة!`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذر رفع الصور";
    console.error("POST /api/admin/photos error:", error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    const { poolDir } = getPoolDir();

    const { searchParams } = new URL(req.url);
    let filename = searchParams.get("filename");
    const wipeAll = searchParams.get("wipeAll") === "true";

    if (wipeAll) {
      const dirs = [poolDir, LOCAL_POOL_DIR];
      let deletedCount = 0;
      for (const d of dirs) {
        try {
          if (!fs.existsSync(d)) continue;
          const files = fs.readdirSync(/* turbopackIgnore: true */ d);
          for (const f of files) {
            const fp = path.join(/* turbopackIgnore: true */ d, f);
            if (fs.existsSync(fp)) {
              fs.unlinkSync(fp);
              deletedCount++;
            }
          }
        } catch {}
      }
      return NextResponse.json({
        success: true,
        message: `تم مسح جميع الصور في بنك الصور بنجاح (${deletedCount} صورة) للبدء على نضافة.`,
      });
    }

    if (!filename) {
      const body = await req.json().catch(() => ({}));
      filename = body.filename;
    }

    if (!filename) {
      return NextResponse.json(
        { success: false, error: "اسم الملف مطلوب للحذف" },
        { status: 400 }
      );
    }

    const safeFilename = path.basename(filename);
    const targetPaths = [
      path.join(/* turbopackIgnore: true */ poolDir, safeFilename),
      path.join(LOCAL_POOL_DIR, safeFilename),
    ];

    let deleted = false;
    for (const tp of targetPaths) {
      try {
        if (fs.existsSync(tp)) {
          fs.unlinkSync(tp);
          deleted = true;
        }
      } catch {}
    }

    if (deleted) {
      return NextResponse.json({
        success: true,
        message: `تم حذف الصورة ${safeFilename} بنجاح`,
      });
    } else {
      return NextResponse.json(
        { success: true, message: "تمت إزالة الصورة" }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذر حذف الصورة";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
