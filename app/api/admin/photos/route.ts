import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const POOL_DIR = path.join(process.cwd(), "public", "uploads", "pool");

function ensureDirectories() {
  if (!fs.existsSync(POOL_DIR)) {
    fs.mkdirSync(POOL_DIR, { recursive: true });
  }
}

export async function GET() {
  try {
    ensureDirectories();

    const files = fs.readdirSync(POOL_DIR);
    const photos = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".webp", ".gif"].includes(ext)) continue;

      const filePath = path.join(POOL_DIR, file);
      try {
        const stats = fs.statSync(filePath);
        const isFromFb = file.toLowerCase().includes("copycat_photo_") || file.toLowerCase().includes("fb_");

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
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
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
      const buffer = Buffer.from(await file.arrayBuffer());

      // Clean extension
      let ext = path.extname(file.name).toLowerCase();
      if (!ext || ext === ".") {
        ext = file.type.includes("png") ? ".png" : file.type.includes("webp") ? ".webp" : ".jpg";
      }

      // Safe clean filename
      const baseName = path.basename(file.name, ext).replace(/[^a-zA-Z0-9_\-\u0600-\u06FF]/g, "_").slice(0, 30);
      const uniqueFilename = `cam_${timestamp}_${i + 1}_${baseName || "photo"}${ext}`;
      const destPath = path.join(POOL_DIR, uniqueFilename);

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
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    ensureDirectories();

    const { searchParams } = new URL(req.url);
    let filename = searchParams.get("filename");

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
    const targetPath = path.join(POOL_DIR, safeFilename);

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
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
