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
  else {
    const s = (mem.get(`stats:${slug}`) as { views: number; clicks: number }) ?? { views: 0, clicks: 0 };
    s[field] += 1;
    mem.set(`stats:${slug}`, s);
  }
}
export async function getStats(slug: string) {
  if (redis) {
    const s = await redis.hgetall<{ views?: number; clicks?: number }>(`stats:${slug}`);
    return { views: Number(s?.views ?? 0), clicks: Number(s?.clicks ?? 0) };
  }
  return (mem.get(`stats:${slug}`) as { views: number; clicks: number }) ?? { views: 0, clicks: 0 };
}
