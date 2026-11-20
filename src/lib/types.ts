export type ProductType = "digital" | "session" | "locked" | "affiliate" | "physical";

export const PRODUCT_TYPES: { type: ProductType; label: string; hint: string; emoji: string }[] = [
  { type: "digital", label: "Digital files", hint: "E-books, PDFs, templates, presets, videos", emoji: "📁" },
  { type: "session", label: "Online sessions", hint: "1:1 calls or group classes on Google Meet", emoji: "📅" },
  { type: "locked", label: "Locked content", hint: "Fans pay to unlock a file or post", emoji: "🔒" },
  { type: "affiliate", label: "Affiliate products", hint: "Products you recommend, for a commission", emoji: "🤝" },
  { type: "physical", label: "Physical products", hint: "Merch or things you make and ship", emoji: "📦" },
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
  price: number; // INR
  compareAtPrice: number | null; // optional "original" price for a discount
  priceRationale: string;
  ctaLabel: string;
  images: string[]; // data URLs (resized on the client)
  // type-specific details
  sessionKind?: "one_on_one" | "group";
  durationMinutes?: number;
  schedule?: string;
  meetLink?: string;
  fileName?: string;
  affiliateUrl?: string;
  aiGenerated: boolean;
};

export type Language = "english" | "hinglish";

export type CreatorProfile = {
  name: string;
  category: string;
  handles: string[]; // instagram handles, no @
  about: string; // creator's own one-line description
  language: Language;
  igSignals: IgSignals | null;
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
