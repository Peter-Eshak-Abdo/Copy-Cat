import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { getSession } from "@/lib/edge-auth";

/**
 * Fallback file relay for "نقل ملفات" when the direct PC-to-PC (WebRTC) link cannot start. The main
 * path never touches this route: files go straight between the two shop PCs over the router.
 *
 * Files are kept OUTSIDE /public (os.tmpdir on Vercel, .data/ locally), so the only way to get one is
 * this route, which proxy.ts and the check below keep behind the staff login. They expire after 4 hours.
 * On Vercel /tmp belongs to one server instance, so a relayed file can be missing on the other PC; the
 * page says so.
 */
const MAX_FILE_AGE_MS = 4 * 60 * 60 * 1000;
const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
// Vercel rejects request bodies over 4.5 MB; locally the limit is just a sanity cap
const MAX_BYTES = IS_SERVERLESS ? 4 * 1024 * 1024 : 500 * 1024 * 1024;
const ID_RE = /^lan_\d{13}_[a-z0-9]{8}$/;

interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  sender: string;
  timestamp: number;
}

function storeDir(): string {
  const dir = IS_SERVERLESS
    ? path.join(os.tmpdir(), "copycat_lan")
    : path.join(/* turbopackIgnore: true */ process.cwd(), ".data", "lan_share");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanupOldFiles(dir: string) {
  const now = Date.now();
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".meta.json")) continue;
    try {
      const meta: FileMetadata = JSON.parse(fs.readFileSync(path.join(dir, entry), "utf-8"));
      if (now - meta.timestamp > MAX_FILE_AGE_MS) {
        fs.rmSync(path.join(dir, meta.id), { force: true });
        fs.rmSync(path.join(dir, entry), { force: true });
      }
    } catch {
      fs.rmSync(path.join(dir, entry), { force: true });
    }
  }
}

function readMeta(dir: string, id: string): FileMetadata | null {
  if (!ID_RE.test(id)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, `${id}.meta.json`), "utf-8"));
  } catch {
    return null;
  }
}

async function requireSession(req: NextRequest) {
  return getSession(req);
}

// GET: list relayed files, or ?download=<id> to stream one
export async function GET(req: NextRequest) {
  if (!(await requireSession(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const dir = storeDir();
  cleanupOldFiles(dir);

  const downloadId = req.nextUrl.searchParams.get("download");
  if (downloadId) {
    const meta = readMeta(dir, downloadId);
    const filePath = path.join(dir, downloadId);
    if (!meta || !fs.existsSync(filePath)) {
      return NextResponse.json({ success: false, error: "الملف مش موجود (ممكن يكون اتمسح أو على سيرفر تاني)." }, { status: 404 });
    }
    return new Response(fs.readFileSync(filePath), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.name)}`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const files: FileMetadata[] = [];
  for (const entry of fs.readdirSync(dir)) {
    if (!entry.endsWith(".meta.json")) continue;
    const meta = readMeta(dir, entry.replace(/\.meta\.json$/, ""));
    if (meta && fs.existsSync(path.join(dir, meta.id))) files.push(meta);
  }
  files.sort((a, b) => b.timestamp - a.timestamp);
  return NextResponse.json({ success: true, files, maxBytes: MAX_BYTES }, { headers: { "Cache-Control": "no-store" } });
}

// POST: relay one file (multipart: file, sender)
export async function POST(req: NextRequest) {
  if (!(await requireSession(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BYTES + 64 * 1024) {
    return NextResponse.json({ success: false, error: `الملف أكبر من ${Math.round(MAX_BYTES / 1048576)} ميجا.` }, { status: 413 });
  }

  const formData = await req.formData().catch(() => null);
  const file = formData?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "مفيش ملف." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ success: false, error: `الملف أكبر من ${Math.round(MAX_BYTES / 1048576)} ميجا.` }, { status: 413 });
  }

  const dir = storeDir();
  const id = `lan_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 8)}`;
  const sender = String(formData?.get("sender") || "جهاز").slice(0, 60);
  const meta: FileMetadata = {
    id,
    name: (file.name || "file").replace(/[\\/\r\n"]/g, "_").slice(0, 200),
    size: file.size,
    type: (file.type || "application/octet-stream").slice(0, 100),
    sender,
    timestamp: Date.now(),
  };

  fs.writeFileSync(path.join(dir, id), Buffer.from(await file.arrayBuffer()));
  fs.writeFileSync(path.join(dir, `${id}.meta.json`), JSON.stringify(meta), "utf-8");
  return NextResponse.json({ success: true, file: meta });
}

// DELETE: ?id=<exact id>
export async function DELETE(req: NextRequest) {
  if (!(await requireSession(req))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") || "";
  if (!ID_RE.test(id)) return NextResponse.json({ success: false, error: "رقم الملف غلط." }, { status: 400 });
  const dir = storeDir();
  fs.rmSync(path.join(dir, id), { force: true });
  fs.rmSync(path.join(dir, `${id}.meta.json`), { force: true });
  return NextResponse.json({ success: true });
}
