export type ProductType = "digital" | "session" | "locked" | "affiliate" | "physical";

export const PRODUCT_TYPES: { type: ProductType; label: string; hint: string; emoji: string; beta?: boolean }[] = [
  { type: "digital", label: "Digital files", hint: "E-books, PDFs, templates, presets, videos", emoji: "📁" },
  { type: "session", label: "Online sessions", hint: "1:1 calls or group classes on Google Meet", emoji: "📅" },
  { type: "locked", label: "Locked content", hint: "Fans pay to unlock a file or post", emoji: "🔒" },
  { type: "affiliate", label: "Affiliate products", hint: "Products you recommend, for a commission", emoji: "🤝" },
  { type: "physical", label: "Physical products", hint: "Merch or things you make. You ship them yourself.", emoji: "📦", beta: true },
];

export const CATEGORIES = [
  "Finance & Trading", "Astrology / Numerology", "Coaching", "Digital Marketing", "Medical",
  "Education & Career", "Fitness & Nutrition", "Design & Arts", "Technology & IT",
  "Law & Legal Services", "Travel / Hospitality", "Beauty & Personal Care",
  "Entertainment & Media", "Food & Cooking", "Other",
] as const;

export type Product = {
  id: string;
  type: ProductType;
  format: string; // e.g. "PDF e-book", "30-min 1:1 call"
  title: string;
  description: string;
  price: number | null; // INR; null = not set yet (0 = free)
  compareAtPrice: number | null; // optional "original" price for a discount
  priceRationale: string;
  suggestedPrice?: number; // Storefront AI's price when the creator kept their own
  ctaLabel: string;
  images: string[]; // data URLs (resized on the client)
  // type-specific details
  sessionKind?: "one_on_one" | "group";
  durationMinutes?: number;
  schedule?: string;
  meetLink?: string;
  fileName?: string;
  affiliateUrl?: string;
  // physical products (fulfilled by the creator)
  deliveryCharge?: number; // 0 = free (included in price)
  shipsWithin?: "1-3" | "3-7" | "7-14" | "custom";
  shipsCustomDays?: number; // 1–30, when shipsWithin is "custom"
  returns?: "none" | "7days";
  aiGenerated: boolean;
};

export const MAX_SHIP_DAYS = 30;

/** A product isn't ready to sell until it has a title and a price. */
export const isDraft = (p: Product) => !p.title.trim() || p.price === null;

export function shippingSummary(p: Product): string | null {
  if (p.type !== "physical") return null;
  const delivery = p.deliveryCharge ? `₹${p.deliveryCharge.toLocaleString("en-IN")} delivery` : "Free delivery";
  const days =
    p.shipsWithin === "custom"
      ? `Ships in ${Math.min(MAX_SHIP_DAYS, Math.max(1, p.shipsCustomDays ?? 7))} days`
      : `Ships in ${(p.shipsWithin ?? "3-7").replace("-", "–")} days`;
  const returns = p.returns === "7days" ? "7-day returns" : "No returns";
  return `🚚 ${delivery} · ${days} · ${returns}`;
}

export type Language = "english" | "hinglish";

export type AudienceTier = "nano" | "micro" | "mid"; // <10K, 10K–50K, 50K+

export const AUDIENCE_OPTIONS: { tier: AudienceTier; label: string }[] = [
  { tier: "nano", label: "Under 10K" },
  { tier: "micro", label: "10K–50K" },
  { tier: "mid", label: "50K+" },
];

export type CreatorProfile = {
  name: string;
  category: string;
  handles: string[]; // instagram handles, no @
  about: string; // creator's own one-line description
  language: Language;
  igSignals: IgSignals | null;
  followerRange?: AudienceTier | null; // self-reported; optional
};

export type IgSignals = {
  handle: string;
  fullName: string | null;
  bio: string | null;
  followers: number | null;
  posts: number | null;
  captions: string[];
};

export type Store = {
  slug: string;
  profile: CreatorProfile;
  displayName: string;
  bio: string;
  avatar: string | null;
  theme: ThemeKey;
  products: Product[];
  upiId: string;
  contentConfirmed?: boolean; // creator confirmed products are theirs and contain no adult/explicit/illegal content
  createdAt: number;
  updatedAt: number;
};

export type ThemeKey = "midnight" | "sunset" | "mint";

export const THEMES: Record<ThemeKey, { label: string; bg: string; card: string; accent: string; text: string; sub: string }> = {
  midnight: { label: "Midnight", bg: "linear-gradient(160deg,#0b0b0f 0%,#1d0a0a 55%,#7a1414 100%)", card: "rgba(255,255,255,0.08)", accent: "#ef4444", text: "#ffffff", sub: "rgba(255,255,255,0.72)" },
  sunset: { label: "Sunset", bg: "linear-gradient(160deg,#fff7ed 0%,#fed7aa 60%,#fb923c 100%)", card: "rgba(255,255,255,0.75)", accent: "#c2410c", text: "#1c1917", sub: "#57534e" },
  mint: { label: "Mint", bg: "linear-gradient(160deg,#f0fdf4 0%,#bbf7d0 60%,#34d399 100%)", card: "rgba(255,255,255,0.8)", accent: "#047857", text: "#052e16", sub: "#3f6212" },
};

export const BIO_MAX = 116;
