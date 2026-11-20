import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import * as z from "zod";
import { nanoid } from "nanoid";
import { bandsForPrompt, guardPrice, tierFor } from "./pricing";
import { BIO_MAX, type CreatorProfile, type Product, type ProductType } from "./types";

// Free-tier models are often overloaded (503/504) or rate-limited (429), so we try a
// chain of models, fast "lite" models first. GEMINI_MODEL (optional) goes first.
const MODELS = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-3.5-flash-lite", // fastest and least congested on the free tier
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.8-flash",
].filter((m, i, a) => a.indexOf(m) === i);
const TOTAL_BUDGET_MS = 50_000; // stay under Vercel's 60s function limit

// Reads the key from the environment. Never hard-code it.
let ai: GoogleGenAI | null = null;
const client = () =>
  (ai ??= new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 18_000, retryOptions: { attempts: 1 } },
  }));

export class AiError extends Error {
  constructor(public code: "safety" | "bad_output" | "rate_limit" | "upstream", message: string) {
    super(message);
  }
}

const ProductSchema = z.object({
  type: z.enum(["digital", "session", "locked", "affiliate", "physical"]),
  session_kind: z.enum(["one_on_one", "group", "none"]),
  duration_minutes: z.number(),
  format: z.string(),
  title: z.string(),
  description: z.string(),
  price_inr: z.number(),
  price_rationale: z.string(),
  cta_label: z.string(),
});
type AiProduct = z.infer<typeof ProductSchema>;

const StoreSchema = z.object({
  input_quality: z.enum(["ok", "too_vague"]),
  clarifying_question: z.string(),
  inferred_niche: z.string(),
  display_name: z.string(),
  bio: z.string(),
  products: z.array(ProductSchema),
});

const SYSTEM = `You are the storefront strategist inside SuperProfile, a platform where Indian creators sell digital products, sessions and more to their followers.
Your user is usually a micro-creator (5K–100K followers) who has never priced a product. Your job: turn what we know about them into a store they would be proud to share in their Instagram bio today.

Principles:
- Be specific to THIS creator's niche and voice. Generic ideas ("Ultimate Guide", "Masterclass") are a failure. Name products the way the creator would say them to followers.
- Products must be things a creator can realistically deliver this week, alone, with a phone and Google Drive / Google Meet: PDFs, templates, presets, recipe books, workout plans, short recorded lessons, 1:1 calls, small live group classes, locked bonus content. Avoid affiliate and physical products unless the creator clearly sells physical goods.
- Mix price points: one low-ticket "impulse" item, one mid item, and at most one premium (usually a 1:1 or a cohort class).
- Prices are in Indian rupees, use charm pricing (₹99, ₹149, ₹299, ₹499, ₹999, ₹1,499) and must fit typical Indian buyer willingness to pay for the audience size given. price_rationale: one short sentence a creator would understand ("Below ₹500 so followers can buy on impulse via UPI").
- Descriptions: 2–3 short sentences, benefit first, what the buyer gets, no hype words like "ultimate", "revolutionary", no emojis spam (max one).
- Bio: max ${BIO_MAX} characters, first person, says who they help and with what. No hashtags.
- cta_label: 2–3 words, e.g. "Get the PDF", "Book a call", "Join the class".
- session_kind is "none" and duration_minutes is 0 unless type is "session".
- Never invent facts such as credentials, follower counts or results the creator didn't state.
- Tone: if the language is "hinglish", write bio, titles and descriptions in natural Roman-script Hinglish the way Indian creators write captions (e.g. "Ghar pe banao restaurant-style biryani"). Otherwise use simple Indian English.`;

function creatorContext(p: CreatorProfile) {
  const ig = p.igSignals;
  const tier = tierFor(ig?.followers ?? null);
  const lines = [
    `Creator name: ${p.name || "(not given)"}`,
    `Content category they picked: ${p.category}`,
    `Their own description: ${p.about?.trim() ? `"${p.about.trim()}"` : "(not given)"}`,
    `Language for store copy: ${p.language}`,
  ];
  if (p.handles.length) lines.push(`Instagram handle(s): ${p.handles.map((h) => "@" + h).join(", ")}`);
  if (ig) {
    lines.push(`Instagram name: ${ig.fullName ?? "-"}; followers: ${ig.followers ?? "unknown"}; posts: ${ig.posts ?? "unknown"}`);
    if (ig.bio) lines.push(`Instagram bio: "${ig.bio}"`);
    if (ig.captions.length) lines.push(`Recent captions:\n${ig.captions.map((c) => `- ${c.replace(/\s+/g, " ")}`).join("\n")}`);
  } else {
    lines.push("Instagram data: not available (treat audience as small, under 10K).");
  }
  lines.push(`Typical price bands for this audience size: ${bandsForPrompt(tier)}.`);
  lines.push(
    p.language === "hinglish"
      ? "LANGUAGE: Write the bio, titles, descriptions, price_rationale and cta_label in Roman-script Hinglish (Hindi + English mix, like Instagram captions). Not pure English. Avoid gendered Hindi verb forms about the creator (e.g. write \"main help karta/karti hoon\" as \"main help karti hoon\" only if the creator's gender is stated; otherwise rephrase)."
      : "LANGUAGE: Simple Indian English.",
  );
  return { text: lines.join("\n"), tier };
}

async function callModel<T extends z.ZodType>(schema: T, user: string, maxTokens = 4000): Promise<z.infer<T>> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>;
  delete jsonSchema.$schema;
  let text: string | undefined;
  const started = Date.now();
  const tried: string[] = [];
  let lastErr: AiError | null = null;
  for (const model of MODELS) {
    if (Date.now() - started > TOTAL_BUDGET_MS - 10_000) break;
    try {
      const res = await client().models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: SYSTEM,
          responseMimeType: "application/json",
          responseJsonSchema: jsonSchema,
          maxOutputTokens: maxTokens,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });
      const reason = res.candidates?.[0]?.finishReason;
      if (reason === "SAFETY" || reason === "RECITATION" || res.promptFeedback?.blockReason) {
        throw new AiError("safety", `Blocked (${reason ?? res.promptFeedback?.blockReason})`);
      }
      text = res.text;
      console.info(`[ai] answered by ${model} in ${Date.now() - started}ms`);
      if (tried.length) console.info(`[ai] ${model} answered after: ${tried.join(", ")}`);
      break;
    } catch (e) {
      if (e instanceof AiError) throw e;
      const status = e instanceof ApiError ? e.status : 0;
      tried.push(`${model}:${status || "net"}`);
      lastErr = new AiError(status === 429 ? "rate_limit" : "upstream", `Gemini ${model} ${status}: ${(e as Error).message}`.slice(0, 300));
      // busy, rate-limited, unknown model or timeout -> try the next model
      if ([0, 404, 408, 429, 500, 503, 504].includes(status) || status >= 500) continue;
      throw lastErr; // e.g. 400 bad request or 401/403 bad key: switching models won't help
    }
  }
  if (text === undefined) {
    console.error(`[ai] all models failed: ${tried.join(", ")}`);
    if (process.env.NODE_ENV !== "production") {
      try {
        const names: string[] = [];
        for await (const m of await client().models.list()) {
          if (m.name && m.supportedActions?.includes("generateContent")) names.push(m.name.replace("models/", ""));
        }
        console.error(`[ai] models this key can use: ${names.join(", ")}`);
      } catch {}
    }
    throw lastErr ?? new AiError("upstream", "No model available");
  }
  if (!text) throw new AiError("bad_output", "Empty response");
  try {
    return schema.parse(JSON.parse(text)) as z.infer<T>;
  } catch {
    throw new AiError("bad_output", `Unparseable output: ${text.slice(0, 200)}`);
  }
}

function toProduct(a: AiProduct, tier: ReturnType<typeof tierFor>): Product {
  const type = a.type as ProductType;
  const sessionKind = type === "session" ? (a.session_kind === "group" ? "group" : "one_on_one") : undefined;
  const guarded = guardPrice(a.price_inr, type, tier, sessionKind);
  return {
    id: nanoid(8),
    type,
    format: a.format.trim(),
    title: a.title.trim(),
    description: a.description.trim(),
    price: guarded.price,
    compareAtPrice: null,
    priceRationale: guarded.adjusted
      ? `Adjusted to ₹${guarded.price} to match what buyers usually pay creators with an audience your size.`
      : a.price_rationale.trim(),
    ctaLabel: a.cta_label.trim() || "Buy now",
    images: [],
    sessionKind,
    durationMinutes: type === "session" ? Math.max(15, Math.round(a.duration_minutes || 30)) : undefined,
    aiGenerated: true,
  };
}

const clipBio = (s: string) => (s.length <= BIO_MAX ? s : s.slice(0, BIO_MAX - 1).replace(/\s+\S*$/, "") + "…");

export async function generateStore(profile: CreatorProfile, force = false) {
  const { text, tier } = creatorContext(profile);
  const out = await callModel(
    StoreSchema,
    `${text}

Create the storefront: display_name (use the creator's name; clean up handles like "bakar.tales" into a readable brand if no name), bio, and exactly 3 product ideas (at least 2 different product types).
Before that, judge input_quality: "too_vague" ONLY if there is no Instagram data AND the description is gibberish, a single generic word, or gives no clue about what the creator does${force ? " (the creator chose to continue anyway, so set input_quality to \"ok\" and make the best guess from the category)" : ""}. If too_vague, write one friendly clarifying_question (and still fill the other fields with a best guess from the category). Otherwise clarifying_question is "".`,
  );
  return {
    inputQuality: force ? "ok" : out.input_quality,
    clarifyingQuestion: out.clarifying_question,
    niche: out.inferred_niche,
    displayName: out.display_name.trim() || profile.name,
    bio: clipBio(out.bio.trim()),
    products: out.products.slice(0, 4).map((p) => toProduct(p, tier)),
  };
}

export async function generateBio(profile: CreatorProfile, current: string) {
  const { text } = creatorContext(profile);
  const out = await callModel(
    z.object({ bio: z.string() }),
    `${text}\n\nCurrent bio: "${current}"\nWrite a fresh alternative bio (max ${BIO_MAX} characters) with a different angle from the current one.`,
    800,
  );
  return clipBio(out.bio.trim());
}

export async function generateProduct(
  profile: CreatorProfile,
  opts: { avoid: string[]; type?: ProductType; titleHint?: string; sessionKind?: "one_on_one" | "group" },
) {
  const { text, tier } = creatorContext(profile);
  const ask = [
    "Create ONE product for this creator's store.",
    opts.type ? `It must be of type "${opts.type}"${opts.sessionKind ? ` with session_kind "${opts.sessionKind}"` : ""}.` : "",
    opts.titleHint ? `The creator described it as: "${opts.titleHint}". Keep their idea; improve the wording, write the description and suggest a price.` : "",
    opts.avoid.length ? `It must be clearly different from the products already in the store: ${opts.avoid.map((t) => `"${t}"`).join(", ")}.` : "",
  ].filter(Boolean).join("\n");
  const out = await callModel(z.object({ product: ProductSchema }), `${text}\n\n${ask}`, 1500);
  return toProduct(out.product, tier);
}
