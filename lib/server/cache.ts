import "server-only";
import { unstable_cache } from "next/cache";

/**
 * unstable_cache, but still works outside a Next request (tsx scripts and tests have no incremental
 * cache there; the function then just runs uncached).
 */
export function cachedQuery<T>(fn: () => Promise<T>, key: string, opts: { tags: string[]; revalidate: number }): () => Promise<T> {
  const cached = unstable_cache(fn, [key], opts);
  return async () => {
    try {
      return await cached();
    } catch (err) {
      if (err instanceof Error && err.message.includes("incrementalCache missing")) return fn();
      throw err;
    }
  };
}
