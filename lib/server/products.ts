import "server-only";
import { str } from "@/lib/server/route-helpers";

/** A product as stored in public.inventory, validated before every write */
export interface ProductRow {
  id: number;
  name: string;
  category: string;
  price: number;
  cost_price: number | null;
  wholesale_price: number | null;
  wholesale_min_qty: number | null;
  stock_count: number;
  notes: string | null;
  image: string | null;
  images: string[];
}

const num = (v: unknown, min = 0, max = 1_000_000): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n * 100) / 100 : null;
};

const MAX_DATA_URL = 400_000; // ~300 KB image; the admin compresses photos to ~25 KB WebP

const imageUrl = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const s = v.trim();
  // Compressed photos uploaded from the admin: images only, base64, size-capped
  if (s.startsWith("data:")) {
    return s.length <= MAX_DATA_URL && /^data:image\/(webp|jpeg|png|gif);base64,[A-Za-z0-9+/=]+$/.test(s) ? s : null;
  }
  // Site paths or https links (no javascript:, protocol-relative or other schemes)
  if (s.length > 2000) return null;
  return (s.startsWith("/") && !s.startsWith("//")) || s.startsWith("https://") ? s : null;
};

export function cleanProduct(raw: Record<string, unknown>): ProductRow | null {
  const id = Number(raw.id);
  const name = str(raw.name, 300);
  if (!Number.isSafeInteger(id) || id <= 0 || !name) return null;
  const images = Array.isArray(raw.images) ? raw.images.map(imageUrl).filter((x): x is string => !!x).slice(0, 8) : [];
  return {
    id,
    name,
    category: str(raw.category, 120) || "عام",
    price: num(raw.price) ?? 0,
    cost_price: num(raw.cost_price),
    wholesale_price: num(raw.wholesale_price),
    wholesale_min_qty: num(raw.wholesale_min_qty, 0, 1_000_000),
    stock_count: Math.trunc(num(raw.stock_count, -1_000_000) ?? 0),
    notes: str(raw.notes, 2000) || null,
    image: imageUrl(raw.image),
    images,
  };
}

/**
 * Firestore keeps a document under 1 MB and the change log stores before + after of a product in one
 * entry, so a product (mostly its photos) must stay under ~450 KB. The admin compresses photos to ~25 KB.
 */
export const MAX_PRODUCT_BYTES = 450_000;

export const productTooBig = (p: ProductRow) => JSON.stringify(p).length > MAX_PRODUCT_BYTES;
