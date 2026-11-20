import type { ProductType } from "./types";

// Price guardrails: the LLM proposes a price, these bands keep it realistic for
// Indian buyers at the creator's audience size. Bands are a starting assumption
// (see decision doc) and would be tuned from real sales data.
export type Tier = "nano" | "micro" | "mid";

export function tierFor(followers: number | null): Tier {
  if (followers == null || followers < 10_000) return "nano";
  if (followers < 50_000) return "micro";
  return "mid";
}

type Band = [number, number];
const BANDS: Record<string, Record<Tier, Band>> = {
  digital: { nano: [99, 499], micro: [149, 799], mid: [199, 1499] },
  session_one_on_one: { nano: [299, 999], micro: [499, 1999], mid: [999, 2999] },
  session_group: { nano: [99, 499], micro: [199, 799], mid: [299, 1499] },
  locked: { nano: [29, 199], micro: [49, 299], mid: [99, 499] },
  affiliate: { nano: [99, 9999], micro: [99, 9999], mid: [99, 9999] },
  physical: { nano: [99, 9999], micro: [99, 9999], mid: [99, 9999] },
};

export function bandFor(type: ProductType, tier: Tier, sessionKind?: string): Band {
  const key = type === "session" ? (sessionKind === "group" ? "session_group" : "session_one_on_one") : type;
  return BANDS[key][tier];
}

/** Indian "charm" pricing: 49, 99, 149, 199, 299, 499, 999, 1499 ... */
export function charm(p: number): number {
  if (p <= 0) return 0;
  if (p < 60) return 49;
  if (p < 120) return 99;
  if (p < 1000) return Math.max(149, Math.round(p / 50) * 50 - 1);
  return Math.round(p / 500) * 500 - 1;
}

export function bandsForPrompt(tier: Tier): string {
  const t = (k: string) => `₹${BANDS[k][tier][0]}–₹${BANDS[k][tier][1]}`;
  return [
    `digital files: ${t("digital")}`,
    `1:1 session: ${t("session_one_on_one")}`,
    `group class / workshop (per seat): ${t("session_group")}`,
    `locked content: ${t("locked")}`,
  ].join("; ");
}

/** Clamp an AI-proposed price into the band; returns whether it was adjusted. */
export function guardPrice(price: number, type: ProductType, tier: Tier, sessionKind?: string) {
  const [lo, hi] = bandFor(type, tier, sessionKind);
  const raw = Number.isFinite(price) ? price : lo;
  const clamped = Math.min(hi, Math.max(lo, raw));
  const final = charm(clamped);
  return { price: final, adjusted: Math.abs(final - raw) > raw * 0.15 };
}
