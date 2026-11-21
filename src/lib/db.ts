import { Redis } from "@upstash/redis";
import type { Store } from "./types";

type Record = { store: Store; editKey: string };

const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

// Local-dev fallback when no Redis is configured (data lives only in memory).
const g = globalThis as unknown as { __mem?: Map<string, unknown> };
const mem = (g.__mem ??= new Map<string, unknown>());

export const storageMode = redis ? "redis" : "memory";

async function get<T>(key: string): Promise<T | null> {
  if (redis) return (await redis.get<T>(key)) ?? null;
  return (mem.get(key) as T) ?? null;
}
async function set(key: string, value: unknown) {
  if (redis) await redis.set(key, value);
  else mem.set(key, value);
}

export const getRecord = (slug: string) => get<Record>(`store:${slug}`);
export const putRecord = (slug: string, rec: Record) => set(`store:${slug}`, rec);
export const slugTaken = async (slug: string) => (await getRecord(slug)) !== null;

export async function bump(slug: string, field: "views" | "clicks") {
  if (redis) await redis.hincrby(`stats:${slug}`, field, 1);
  else await hinc(`stats:${slug}`, field);
}
export async function getStats(slug: string) {
  if (redis) {
    const s = await redis.hgetall<{ views?: number; clicks?: number }>(`stats:${slug}`);
    return { views: Number(s?.views ?? 0), clicks: Number(s?.clicks ?? 0) };
  }
  const m = mem.get(`stats:${slug}`) as { views: number; clicks: number } | Map<string, unknown> | undefined;
  if (m instanceof Map) return { views: Number(m.get("views") ?? 0), clicks: Number(m.get("clicks") ?? 0) };
  return m ?? { views: 0, clicks: 0 };
}

// ---- Pro waitlist (fake-door demand test) ----
// Counts are for us, not shown to creators. Read them in the Upstash console:
//   pro:stats    → views, joins, joins:plan:<monthly|yearly>, views:<category>|<tier>, joins:<category>|<tier>
//   pro:waitlist → one entry per store: { plan, category, tier, at }
export type ProPlan = "monthly" | "yearly";
export type ProJoin = { plan: ProPlan; category: string; tier: string; at: number };

function memHash(key: string) {
  let h = mem.get(key) as Map<string, unknown> | undefined;
  if (!h) mem.set(key, (h = new Map()));
  return h;
}
async function hinc(key: string, field: string) {
  if (redis) await redis.hincrby(key, field, 1);
  else {
    const h = memHash(key);
    h.set(field, Number(h.get(field) ?? 0) + 1);
  }
}

export async function getProJoin(slug: string): Promise<ProJoin | null> {
  if (redis) return (await redis.hget<ProJoin>("pro:waitlist", slug)) ?? null;
  return (memHash("pro:waitlist").get(slug) as ProJoin) ?? null;
}

export async function recordProView(slug: string, category: string, tier: string) {
  await Promise.all([hinc("pro:stats", "views"), hinc("pro:stats", `views:${category}|${tier}`), hinc(`stats:${slug}`, "pro_views")]);
}

export async function recordProJoin(slug: string, plan: ProPlan, category: string, tier: string): Promise<ProJoin> {
  const existing = await getProJoin(slug);
  if (existing) return existing; // one join per store
  const entry: ProJoin = { plan, category, tier, at: Date.now() };
  if (redis) await redis.hset("pro:waitlist", { [slug]: entry });
  else memHash("pro:waitlist").set(slug, entry);
  await Promise.all([hinc("pro:stats", "joins"), hinc("pro:stats", `joins:plan:${plan}`), hinc("pro:stats", `joins:${category}|${tier}`)]);
  return entry;
}
