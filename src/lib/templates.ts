import { nanoid } from "nanoid";
import type { CreatorProfile, Product } from "./types";

// Used only when the AI call fails twice, so the creator never hits a dead end.
// Clearly labelled in the UI as a starter template, not AI output.
export function starterProducts(p: CreatorProfile): Product[] {
  const niche = p.category === "Other" ? "my content" : p.category.toLowerCase();
  const base = { compareAtPrice: null, aiGenerated: false } as const;
  return [
    { ...base, images: [], id: nanoid(8), type: "digital", format: "PDF guide", title: `My starter guide to ${niche}`, description: "Everything I wish I knew when I started, in one short PDF you can read in 20 minutes.", price: 199, priceRationale: "Under ₹200 so followers can buy on impulse.", ctaLabel: "Get the PDF" },
    { ...base, images: [], id: nanoid(8), type: "session", format: "30-min 1:1 video call", title: "1:1 call with me", description: "Bring your questions and get personal advice on Google Meet.", price: 499, priceRationale: "A typical first price for a 30-minute call.", ctaLabel: "Book a call", sessionKind: "one_on_one", durationMinutes: 30 },
    { ...base, images: [], id: nanoid(8), type: "locked", format: "Locked bonus post", title: "Behind-the-scenes bonus", description: "Unlock extra tips and resources I don't post publicly.", price: 49, priceRationale: "A low price to test what followers will pay for.", ctaLabel: "Unlock" },
  ];
}
