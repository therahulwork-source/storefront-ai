import type { Store } from "./types";

const MAX_BYTES = 900_000; // keep each store under Upstash's 1 MB value limit

export function validateStore(s: unknown): { ok: true; store: Store } | { ok: false; error: string } {
  const st = s as Store;
  if (!st || typeof st !== "object") return { ok: false, error: "Missing store." };
  if (!st.displayName?.trim()) return { ok: false, error: "Add a display name." };
  if (!Array.isArray(st.products) || st.products.length === 0) return { ok: false, error: "Add at least one product." };
  if (st.products.length > 12) return { ok: false, error: "Up to 12 products for now." };
  for (const p of st.products) {
    if (!p.title?.trim()) return { ok: false, error: "Every product needs a title." };
    if (!Number.isFinite(p.price) || p.price < 0 || p.price > 500000) return { ok: false, error: `Check the price for "${p.title}".` };
  }
  if (JSON.stringify(st).length > MAX_BYTES) return { ok: false, error: "Your images are too large. Remove a few photos and try again." };
  return { ok: true, store: st };
}
