import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const LAN_SHARE_ROOT = path.join(process.cwd(), "public", "uploads", "lan_share");
const MAX_FILE_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours auto-expiry

function ensureRoomDir(roomId: string) {
  const safeRoom = roomId.replace(/[^a-zA-Z0-9_-]/g, "_") || "default_room";
  const roomDir = path.join(LAN_SHARE_ROOT, safeRoom);
  if (!fs.existsSync(roomDir)) {
    fs.mkdirSync(roomDir, { recursive: true });
  }
  return { roomDir, safeRoom };
}

interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  sender: string;
  timestamp: number;
  downloadUrl: string;
}

// Helper to cleanup stale files
function cleanupOldFiles(roomDir: string) {
  try {
    const now = Date.now();
    const entries = fs.readdirSync(roomDir);
    for (const entry of entries) {
      if (entry.endsWith(".meta.json")) {
        try {
          const metaPath = path.join(roomDir, entry);
          const raw = fs.readFileSync(metaPath, "utf-8");
          const meta = JSON.parse(raw);
          if (now - meta.timestamp > MAX_FILE_AGE_MS) {
            const actualFile = entry.replace(/\.meta\.json$/, "");
            const filePath = path.join(roomDir, actualFile);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
          }
        } catch {}
      }
    }
  } catch {}
}

// GET: List shared files in a room
export async function GET(req: NextRequest) {
  try {
    const roomId = req.nextUrl.searchParams.get("roomId") || "copycat-lan-room";
    const { roomDir, safeRoom } = ensureRoomDir(roomId);

    cleanupOldFiles(roomDir);

    const files: FileMetadata[] = [];
    const entries = fs.readdirSync(roomDir);

    for (const entry of entries) {
      if (entry.endsWith(".meta.json")) {
        try {
          const metaPath = path.join(roomDir, entry);
          const raw = fs.readFileSync(metaPath, "utf-8");
          const meta: FileMetadata = JSON.parse(raw);

          // Verify underlying file still exists
          const actualFilename = entry.replace(/\.meta\.json$/, "");
          const actualFilePath = path.join(roomDir, actualFilename);
          if (fs.existsSync(actualFilePath)) {
            meta.downloadUrl = `/uploads/lan_share/${safeRoom}/${actualFilename}`;
            files.push(meta);
          }
        } catch {}
      }
    }

    // Sort newest first
    files.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ success: true, files });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل جلب قائمة الملفات المشتركة";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// POST: Upload a shared file over LAN
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const sender = (formData.get("sender") as string) || "جهاز غير معروف";
    const roomId = (formData.get("roomId") as string) || "copycat-lan-room";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ success: false, error: "لم يتم اختيار أي ملف للرفع" }, { status: 400 });
    }

    const { roomDir, safeRoom } = ensureRoomDir(roomId);

    const fileId = `lan_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const originalName = file.name || "unnamed_file";
    const safeName = originalName.replace(/[^a-zA-Z0-9_\u0600-\u06FF.-]/g, "_");
    const storedFileName = `${fileId}_${safeName}`;

    const filePath = path.join(roomDir, storedFileName);
    const metaPath = path.join(roomDir, `${storedFileName}.meta.json`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    fs.writeFileSync(filePath, buffer);

    const metadata: FileMetadata = {
      id: fileId,
      name: originalName,
      size: file.size,
      type: file.type || "application/octet-stream",
      sender,
      timestamp: Date.now(),
      downloadUrl: `/uploads/lan_share/${safeRoom}/${storedFileName}`,
    };

    fs.writeFileSync(metaPath, JSON.stringify(metadata, null, 2), "utf-8");

    return NextResponse.json({ success: true, file: metadata });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل رفع الملف عبر الشبكة";
    console.error("LAN upload error:", err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE: Remove a file from LAN room
export async function DELETE(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    const roomId = req.nextUrl.searchParams.get("roomId") || "copycat-lan-room";

    if (!id) {
      return NextResponse.json({ success: false, error: "معرف الملف مطلوب للحذف" }, { status: 400 });
    }

    const { roomDir } = ensureRoomDir(roomId);
    const entries = fs.readdirSync(roomDir);

    let deleted = false;
    for (const entry of entries) {
      if (entry.startsWith(id)) {
        try {
          fs.unlinkSync(path.join(roomDir, entry));
          deleted = true;
        } catch {}
      }
    }

    return NextResponse.json({ success: true, deleted });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "فشل حذف الملف من الشبكة";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
