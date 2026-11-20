# Storefront AI

Turn an Instagram handle, or a one-line description, into a ready-to-share storefront for Indian creators. AI writes the bio, suggests 3 products with descriptions and ₹ prices, and the creator edits, regenerates and launches a public link.

Built for the SuperProfile Product Manager assignment ("AI Storefront Generator").

## What it does

1. **Onboarding (3 steps):** name → content category + Instagram handle(s) → "tell us about you" + language (English / Hinglish).
2. **Instagram read (best effort):** tries to read the public profile (name, bio, followers, recent captions). Instagram often blocks automated reads. When it does, the creator is told plainly and asked for a line about themselves instead.
3. **AI drafts the store:** one Gemini call returns the display name, bio (≤116 chars), and 3 products, each with a type, format, title, description, ₹ price, price rationale and button text.
4. **Price guardrails:** the AI proposes prices, then code clamps them to bands by product type and audience size (nano <10K, micro 10–50K, mid 50K+) and applies Indian charm pricing (₹99, ₹149, ₹499 …). If a price was adjusted, the rationale says so.
5. **Edit everything:** the brand step (photo, name, bio with ✨ Rewrite, theme), the products step (edit any field, ✨ Try a different idea per product, ✨ Suggest another idea, ↻ Regenerate whole store, add a product by type and let ✨ Write with AI fill it in), and a payments step (UPI, demo only).
6. **Launch:** creates a public page at `/s/<handle>` and a private edit link `/edit/<handle>?k=<key>` that shows store views and buy clicks.

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
