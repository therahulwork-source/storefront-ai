import type { AudienceTier, CreatorProfile, ProductType } from "./types";

/*
 * Price guardrails: category → product type → audience size.
 *
 * Storefront AI proposes a price; code keeps it inside a band and rounds it to
 * Indian charm pricing (₹99, ₹149, ₹499, ₹999, ₹1,499 …).
 *
 * Base bands are for creators with under 10K followers and a 30-minute session.
 * They come from public Indian market data (Nov 2026), mainly Topmate's reports
 * on paid 1:1 calls, plus listings for astrology, legal, nutrition, digital
 * products and Instagram subscriptions. See README → Pricing.
 */
export type Tier = AudienceTier;
export type CategoryGroup = "expert" | "skill" | "lifestyle";
type PriceKey = "digital" | "session_one_on_one" | "session_group" | "session_webinar" | "locked";
type Band = [number, number];

const EXPERT = new Set([
  "Finance & Trading", "Law & Legal Services", "Medical", "Astrology / Numerology",
  "Education & Career", "Technology & IT", "Digital Marketing", "Coaching",
]);
const SKILL = new Set(["Fitness & Nutrition", "Design & Arts", "Beauty & Personal Care", "Food & Cooking"]);

export function categoryGroup(category: string): CategoryGroup {
  if (EXPERT.has(category)) return "expert";
  if (SKILL.has(category)) return "skill";
  return "lifestyle"; // Entertainment & Media, Travel / Hospitality, Other
}

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  expert: "Expert advice",
  skill: "Skills & lifestyle coaching",
  lifestyle: "Entertainment, travel & other",
};

// Under-10K base bands (30-min sessions), in ₹
export const BASE: Record<CategoryGroup, Record<PriceKey, Band>> = {
  expert: { digital: [99, 499], session_one_on_one: [499, 1499], session_group: [199, 799], session_webinar: [99, 499], locked: [49, 199] },
  skill: { digital: [99, 399], session_one_on_one: [299, 999], session_group: [149, 599], session_webinar: [99, 399], locked: [29, 149] },
  lifestyle: { digital: [49, 299], session_one_on_one: [199, 799], session_group: [99, 499], session_webinar: [49, 299], locked: [29, 149] },
};

// Audience multipliers applied to [low, high]
export const AUDIENCE_MULT: Record<Tier, [number, number]> = {
  nano: [1, 1],
  micro: [1.5, 1.6],
  mid: [2, 3],
};

const OPEN_BAND: Band = [99, 9999]; // affiliate & physical: the real item sets the price

export function tierFor(profile: Pick<CreatorProfile, "igSignals" | "followerRange">): Tier {
  const f = profile.igSignals?.followers;
  if (f != null) return f < 10_000 ? "nano" : f < 50_000 ? "micro" : "mid";
  return profile.followerRange ?? "nano"; // blank → assume under 10K
}

/** Indian "charm" pricing: 49, 99, 149 … 999, 1,299, 1,699 … 4,999, 5,499 ... */
export function charm(p: number): number {
  if (p <= 0) return 0;
  if (p < 40) return 29;
  if (p < 60) return 49;
  if (p < 120) return 99;
  if (p < 1000) return Math.max(149, Math.round(p / 50) * 50 - 1);
  if (p < 5000) return Math.round(p / 100) * 100 - 1;
  return Math.round(p / 500) * 500 - 1;
}

export function durationFactor(minutes?: number) {
  if (!minutes) return 1;
  return Math.min(2.5, Math.max(0.6, Math.pow(minutes / 30, 0.8)));
}

export type PriceCtx = {
  category: string;
  type: ProductType;
  tier: Tier;
  sessionKind?: string;
  durationMinutes?: number;
};

export function bandFor({ category, type, tier, sessionKind, durationMinutes }: PriceCtx): Band {
  if (type === "affiliate" || type === "physical") return OPEN_BAND;
  const key: PriceKey =
    type === "session"
      ? sessionKind === "group"
        ? "session_group"
        : sessionKind === "webinar"
          ? "session_webinar"
          : "session_one_on_one"
      : type;
  const [lo, hi] = BASE[categoryGroup(category)][key];
  const [ml, mh] = AUDIENCE_MULT[tier];
  // Webinar seats are priced per event, not by length.
  const d = type === "session" && sessionKind !== "webinar" ? durationFactor(durationMinutes) : 1;
  const low = charm(lo * ml * d);
  return [low, Math.max(low, charm(hi * mh * d))];
}

export function bandsForPrompt(category: string, tier: Tier): string {
  const t = (type: ProductType, sessionKind?: string) => {
    const [lo, hi] = bandFor({ category, type, tier, sessionKind, durationMinutes: 30 });
    return `₹${lo}–₹${hi}`;
  };
  return [
    `digital files: ${t("digital")}`,
    `30-min 1:1 session: ${t("session", "one_on_one")} (scale up for longer sessions)`,
    `group class / workshop (per seat): ${t("session", "group")}`,
    `webinar (one-to-many, per seat; free is common as a lead magnet): ${t("session", "webinar")}`,
    `locked content: ${t("locked")}`,
  ].join("; ");
}

/** Clamp an AI-proposed price into the band; returns whether it was adjusted. */
export function guardPrice(price: number, ctx: PriceCtx) {
  const [lo, hi] = bandFor(ctx);
  const raw = Number.isFinite(price) ? price : lo;
  const final = charm(Math.min(hi, Math.max(lo, raw)));
  return { price: Math.min(hi, Math.max(lo, final)), adjusted: Math.abs(final - raw) > raw * 0.15 };
}
