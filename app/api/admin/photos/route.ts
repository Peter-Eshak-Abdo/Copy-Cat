import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { verifySessionTokenEdge } from "@/lib/edge-auth";

const POOL_DIR = path.join(process.cwd(), "public", "uploads", "pool");
const ALLOWED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

function ensureDirectories() {
  if (!fs.existsSync(POOL_DIR)) {
    fs.mkdirSync(POOL_DIR, { recursive: true });
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

    ensureDirectories();

    const files = fs.readdirSync(POOL_DIR);
    const photos = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) continue;

      const filePath = path.join(POOL_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        const isFromFb =
          file.toLowerCase().includes("copycat_photo_") || file.toLowerCase().includes("fb_");

        photos.push({
          id: file,
          filename: file,
          url: `/uploads/pool/${file}`,
          sizeBytes: stats.size,
          createdAt: stats.birthtimeMs || stats.mtimeMs || Date.now(),
          source: isFromFb ? "facebook" : "upload",
        });
      } catch {
        continue;
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
    const message = error instanceof Error ? error.message : "تعذر جلب الصور من بنك الصور";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    ensureDirectories();

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

      // Enforce file size limit
      if (file.size > MAX_FILE_SIZE_BYTES) {
        continue;
      }

      const buffer = Buffer.from(await file.arrayBuffer());

      // Clean extension and validate whitelist
      let ext = path.extname(file.name).toLowerCase();
      if (!ALLOWED_EXTS.has(ext)) {
        ext = file.type.includes("png") ? ".png" : file.type.includes("webp") ? ".webp" : ".jpg";
      }

      // Safe clean filename with strict sanitization (no path traversal possible)
      const baseName = path
        .basename(file.name, ext)
        .replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, "_")
        .slice(0, 30);
      const uniqueFilename = `cam_${timestamp}_${i + 1}_${baseName || "photo"}${ext}`;
      const destPath = path.join(POOL_DIR, uniqueFilename);

      // Verify destPath is strictly inside POOL_DIR
      if (!destPath.startsWith(POOL_DIR)) {
        continue;
      }

      fs.writeFileSync(destPath, buffer);

      savedPhotos.push({
        id: uniqueFilename,
        filename: uniqueFilename,
        url: `/uploads/pool/${uniqueFilename}`,
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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const isAuthed = await checkAuth(req);
    if (!isAuthed) {
      return NextResponse.json({ success: false, error: "وصول غير مصرح به" }, { status: 401 });
    }

    ensureDirectories();

    const { searchParams } = new URL(req.url);
    let filename = searchParams.get("filename");
    const wipeAll = searchParams.get("wipeAll") === "true";

    // Support wiping all photos cleanly if user requested clean slate
    if (wipeAll) {
      const files = fs.readdirSync(POOL_DIR);
      let deletedCount = 0;
      for (const f of files) {
        const fp = path.join(POOL_DIR, f);
        if (fs.existsSync(fp)) {
          fs.unlinkSync(fp);
          deletedCount++;
        }
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

    // Path traversal defense: extract base name only and verify full path is inside POOL_DIR
    const safeFilename = path.basename(filename);
    const targetPath = path.resolve(POOL_DIR, safeFilename);

    if (!targetPath.startsWith(path.resolve(POOL_DIR))) {
      return NextResponse.json(
        { success: false, error: "محاولة وصول غير مصرح بها إلى مسار الملف" },
        { status: 403 }
      );
    }

    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      return NextResponse.json({
        success: true,
        message: `تم حذف الصورة ${safeFilename} بنجاح`,
      });
    } else {
      return NextResponse.json(
        { success: false, error: "الصورة غير موجودة" },
        { status: 404 }
      );
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "تعذر حذف الصورة";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
