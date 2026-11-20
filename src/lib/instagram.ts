import type { IgSignals } from "./types";

export function normaliseHandle(input: string): string | null {
  let s = input.trim();
  const m = s.match(/instagram\.com\/([^/?#]+)/i);
  if (m) s = m[1];
  s = s.replace(/^@/, "").trim();
  if (!/^[a-zA-Z0-9._]{1,30}$/.test(s)) return null;
  return s.toLowerCase();
}

export type IgResult =
  | { ok: true; signals: IgSignals }
  | { ok: false; reason: "invalid" | "not_found" | "private" | "blocked" };

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

function parseCount(s: string): number | null {
  const m = s.replace(/,/g, "").match(/([\d.]+)\s*([KkMm]?)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const mult = m[2].toLowerCase() === "k" ? 1e3 : m[2].toLowerCase() === "m" ? 1e6 : 1;
  return Math.round(n * mult);
}

async function withTimeout(url: string, init: RequestInit, ms = 4500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, cache: "no-store" });
  } finally {
    clearTimeout(t);
  }
}

/**
 * Best-effort read of public Instagram profile signals. Instagram often blocks
 * server-side requests, so callers must always have a fallback (self-description).
 */
export async function fetchInstagram(rawHandle: string): Promise<IgResult> {
  const handle = normaliseHandle(rawHandle);
  if (!handle) return { ok: false, reason: "invalid" };

  // 1) JSON endpoint used by the Instagram web app
  try {
    const r = await withTimeout(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
      { headers: { "User-Agent": UA, "x-ig-app-id": "936619743392459", Accept: "application/json" } },
    );
    // Note: Instagram answers 404 here when it blocks a request, so a 404 is NOT proof the account is missing.
    if (r.ok && (r.headers.get("content-type") ?? "").includes("json")) {
      const j = await r.json();
      const u = j?.data?.user;
      if (u === null) return { ok: false, reason: "not_found" };
      if (u) {
        const captions: string[] = (u.edge_owner_to_timeline_media?.edges ?? [])
          .map((e: { node?: { edge_media_to_caption?: { edges?: { node?: { text?: string } }[] } } }) =>
            e.node?.edge_media_to_caption?.edges?.[0]?.node?.text ?? "")
          .filter(Boolean)
          .slice(0, 8)
          .map((c: string) => c.slice(0, 300));
        if (u.is_private && !u.biography) return { ok: false, reason: "private" };
        return {
          ok: true,
          signals: {
            handle,
            fullName: u.full_name || null,
            bio: u.biography || null,
            followers: u.edge_followed_by?.count ?? null,
            posts: u.edge_owner_to_timeline_media?.count ?? null,
            captions,
          },
        };
      }
    }
  } catch {
    /* fall through */
  }

  // 2) Public profile HTML meta tags
  try {
    const r = await withTimeout(`https://www.instagram.com/${handle}/`, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (r.ok) {
      const html = await r.text();
      const og = html.match(/<meta property="og:description" content="([^"]*)"/i)?.[1];
      const desc = html.match(/<meta name="description" content="([^"]*)"/i)?.[1];
      const title = html.match(/<meta property="og:title" content="([^"]*)"/i)?.[1];
      if (og) {
        const decode = (s: string) =>
          s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)));
        const followers = og.match(/([\d.,]+[KkMm]?)\s+Followers/i)?.[1];
        const posts = og.match(/([\d.,]+[KkMm]?)\s+Posts/i)?.[1];
        const bio = desc ? decode(desc).match(/on Instagram:\s*"([\s\S]*)"/)?.[1] ?? null : null;
        const fullName = title ? decode(title).replace(/\s*\(@.*$/, "").trim() || null : null;
        return {
          ok: true,
          signals: {
            handle,
            fullName,
            bio,
            followers: followers ? parseCount(followers) : null,
            posts: posts ? parseCount(posts) : null,
            captions: [],
          },
        };
      }
    }
  } catch {
    /* fall through */
  }
  return { ok: false, reason: "blocked" };
}
