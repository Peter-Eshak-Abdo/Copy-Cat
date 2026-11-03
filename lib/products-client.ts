"use client";

/**
 * Product writes from the admin (inventory and product photos pages) go through /api/admin/inventory,
 * which checks the login and records every change in the change log. "local" means the database is not
 * connected and the change only lives on this device.
 */
import type { InventoryItem } from "@/lib/inventory";
import { api, ApiError } from "@/lib/admin-data";

export type WriteResult = "saved" | "local" | "error";

export async function loadProducts(): Promise<InventoryItem[] | null> {
  try {
    const data = await api<{ items: InventoryItem[] }>("/api/admin/inventory");
    return data.items.map((it) => ({
      ...it,
      price: Number(it.price),
      cost_price: it.cost_price == null ? undefined : Number(it.cost_price),
      wholesale_price: it.wholesale_price == null ? undefined : Number(it.wholesale_price),
      wholesale_min_qty: it.wholesale_min_qty == null ? undefined : Number(it.wholesale_min_qty),
      notes: it.notes ?? undefined,
      image: it.image ?? undefined,
      images: Array.isArray(it.images) && it.images.length ? it.images : undefined,
    }));
  } catch {
    return null;
  }
}

export async function saveProduct(item: InventoryItem): Promise<WriteResult> {
  try {
    await api("/api/admin/inventory", { method: "PUT", body: JSON.stringify({ item }) });
    return "saved";
  } catch (err) {
    return err instanceof ApiError && err.status === 503 ? "local" : "error";
  }
}

export async function deleteProduct(id: number): Promise<WriteResult> {
  try {
    await api(`/api/admin/inventory?id=${id}`, { method: "DELETE" });
    return "saved";
  } catch (err) {
    return err instanceof ApiError && err.status === 503 ? "local" : "error";
  }
}
