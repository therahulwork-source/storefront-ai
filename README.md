# Storefront AI

Turn an Instagram handle, or a one-line description, into a ready-to-share storefront for Indian creators. AI writes the bio, suggests 3 products with descriptions and ₹ prices, and the creator edits, regenerates and launches a public link.

Built for the SuperProfile Product Manager assignment ("AI Storefront Generator").

## What it does

1. **Onboarding (3 steps):** name → content category + Instagram handle(s) → "tell us about you" + language (English / Hinglish).
2. **Instagram read (best effort):** tries to read the public profile (name, bio, followers, recent captions). Instagram often blocks automated reads. When it does, the creator is told plainly and asked for a line about themselves instead.
3. **AI drafts the store:** one Gemini call returns the display name, bio (≤116 chars), and 3 products, each with a type, format, title, description, ₹ price, price rationale and button text.
4. **Price guardrails:** Storefront AI proposes prices, then code keeps them inside a range set by **category → product type → audience size**, scaled by session length, and rounds to Indian charm pricing (₹99, ₹499, ₹1,299 …). The editor shows "Creators like you usually charge ₹X–Y". See [Pricing](#pricing).
5. **Edit everything:** the brand step (photo, name, bio with ✨ Rewrite, theme), the products step (edit any field, ✨ Try a different idea per product, ✨ Suggest another idea, ↻ Regenerate whole store, add a product by type and let ✨ Write with AI fill it in), and a payments step (UPI, demo only).
6. **Launch:** creates a public page at `/s/<handle>` and a private edit link `/edit/<handle>?k=<key>` that shows store views and buy clicks.

## Pricing

**Inputs:** category (step 2) → product type → audience size (optional "Your followers" in step 3; blank means under 10K). Session ranges below are for 30 minutes unless stated, and scale with length (60 min ≈ 1.7×).

**Category groups**
- **Expert advice:** Finance & Trading, Law & Legal, Medical, Astrology / Numerology, Education & Career, Technology & IT, Digital Marketing, Coaching
- **Skills & lifestyle coaching:** Fitness & Nutrition, Design & Arts, Beauty & Personal Care, Food & Cooking
- **Entertainment, travel & other:** Entertainment & Media, Travel / Hospitality, Other

| Group | Product | Under 10K | 10K–50K | 50K+ |
|---|---|---|---|---|
| Expert advice | PDF / digital files | ₹99–499 | ₹149–799 | ₹199–1,499 |
| | 1:1 session (30 min) | ₹499–1,499 | ₹749–2,399 | ₹999–4,499 |
| | Group class (60 min, per seat) | ₹349–1,399 | ₹499–2,199 | ₹699–4,199 |
| | Locked content | ₹49–199 | ₹99–299 | ₹99–599 |
| Skills & lifestyle | PDF / digital files | ₹99–399 | ₹149–649 | ₹199–1,199 |
| | 1:1 session (30 min) | ₹299–999 | ₹449–1,599 | ₹599–2,999 |
| | Group class (60 min, per seat) | ₹249–999 | ₹399–1,699 | ₹499–3,099 |
| | Locked content | ₹29–149 | ₹49–249 | ₹49–449 |
| Entertainment, travel & other | PDF / digital files | ₹49–299 | ₹99–499 | ₹99–899 |
| | 1:1 session (30 min) | ₹199–799 | ₹299–1,299 | ₹399–2,399 |
| | Group class (60 min, per seat) | ₹149–849 | ₹249–1,399 | ₹349–2,599 |
| | Locked content | ₹29–149 | ₹49–249 | ₹49–449 |

Affiliate and physical products aren't constrained (₹99–9,999); the real item sets the price.

**Market evidence used (India, public data, Nov 2026)**
- 1:1 calls, Topmate medians for paid calls (Nov 2025–Oct 2026): career coaching ₹609 (middle half ₹310–1,200), mock interview ₹809, product management ₹709, data science ₹510, software engineering ₹498, resume review ₹509, study-abroad counselling ₹1,500.
- Astrology: fixed sessions are typically ₹300–1,999. Online legal advice: about ₹500–1,000 for 30 minutes. Nutritionists: about ₹249–1,500 per consultation, and diet plans ₹499–999.
- Digital products: e-book templates on Topmate at ₹49–199; travel itineraries at ₹81–99; low-ticket workshops at ₹99–499.
- Locked or subscription content: Instagram subscriptions start at ₹89 a month; most creators charge ₹49–399.

These ranges are a v1 assumption built from public listings. v2 should learn them from SuperProfile's own sales data and price experiments.

## Edge cases handled

| Case | Behaviour |
|---|---|
| Handle doesn't exist, is private, or Instagram blocks the read | Friendly message; the description becomes required |
| Malformed handle or full URL pasted | URL is parsed; invalid characters are flagged inline |
| Gibberish or one-word description | The model flags `too_vague` and asks one clarifying question; the creator can answer it or choose "Generate anyway" |
| LLM busy, slow, rate-limited or misconfigured | Falls through a chain of Gemini models (18-second timeout each, about 50 seconds in total); a rate limit gets its own "try again in a minute" message. The error screen keeps the inputs and offers "Try again"; after 2 failures it also offers an editable starter template, clearly labelled |
| Safety block | Friendly message asking the creator to rephrase |
| Refresh mid-flow | Draft is saved in localStorage and restored |
| Oversized images | Resized in the browser; the store payload is capped at about 900 KB |
| Private fields | Meet links, file names and UPI are stripped from the public page |

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Gemini API free tier (a fallback chain starting with `gemini-3.5-flash-lite`, because free-tier models are often busy; JSON output constrained by a Zod schema and validated; low thinking level for speed) · Upstash Redis · Vercel.

Key files:
- `src/lib/ai.ts`: prompts, schemas and Gemini calls
- `src/lib/pricing.ts`: price bands and charm pricing
- `src/lib/instagram.ts`: best-effort profile read
- `src/app/create/page.tsx`: onboarding and generation flow
- `src/components/Editor.tsx`, `ProductEditor.tsx`: the editor
- `src/components/StoreView.tsx`: the storefront (preview and public page)

## Run locally

```bash
cp .env.example .env.local   # add GEMINI_API_KEY
npm install
npm run dev                  # http://localhost:3000
```

Without Redis env vars, stores are kept in memory and are lost on restart.

## Deploy (Vercel)

1. Push this folder to a GitHub repo.
2. In Vercel, use **Add New → Project** and import the repo (framework: Next.js, default settings).
3. **Settings → Environment Variables:** add `GEMINI_API_KEY` (free from aistudio.google.com/apikey).
4. **Storage → Create → Upstash for Redis** (free plan) and connect it to the project. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN`.
5. Redeploy. API keys live only in environment variables, never in the repo.

## Not built (deliberately)

Sign-in/OTP (the brief says not needed; the edit link is a secret key instead), real checkout and payouts, file delivery for digital products, custom domains, and Instagram OAuth (real follower and engagement data).

## How AI was used to build this

Built with Claude Code (Anthropic) as a pair programmer: scaffolding, components and API routes were generated, then reviewed and tested in the browser (wizard, Instagram-blocked path, AI-failure → template path, launch, public page on a mobile viewport).
