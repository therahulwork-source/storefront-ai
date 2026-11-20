"use client";
import type { CreatorProfile, Product, ProductType, Store } from "./types";

export async function api<T>(url: string, body?: unknown, method = "POST"): Promise<T> {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "Something went wrong. Please try again.");
  return j as T;
}

export type StoreGen = {
  inputQuality: "ok" | "too_vague";
  clarifyingQuestion: string;
  niche: string;
  displayName: string;
  bio: string;
  products: Product[];
};

export const genStore = (profile: CreatorProfile, force = false) => api<StoreGen>("/api/generate", { kind: "store", profile, force });
export const genBio = (profile: CreatorProfile, current: string) =>
  api<{ bio: string }>("/api/generate", { kind: "bio", profile, current }).then((r) => r.bio);
export const genProduct = (
  profile: CreatorProfile,
  opts: { avoid: string[]; type?: ProductType; titleHint?: string; sessionKind?: string },
) => api<{ product: Product }>("/api/generate", { kind: "product", profile, ...opts }).then((r) => r.product);

/** Resize an image file to a compact JPEG data URL so stores stay small. */
export function resizeImage(file: File, max = 720, quality = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file."));
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Couldn't read that image."));
    img.src = url;
  });
}

const safe = {
  get<T>(k: string): T | null {
    try {
      const v = localStorage.getItem(k);
      return v ? (JSON.parse(v) as T) : null;
    } catch {
      return null;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: drafts just won't persist */
    }
  },
  del(k: string) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
export const storage = safe;

export type Draft = { stage: "wizard" | "editor"; profile: CreatorProfile; store: Store | null; step: number };
export const DRAFT_KEY = "sf_draft_v1";
export const MINE_KEY = "sf_my_stores_v1";
export type MyStore = { slug: string; editKey: string; name: string };
