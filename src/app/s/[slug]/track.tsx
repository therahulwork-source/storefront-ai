"use client";
import { useEffect } from "react";

export function TrackView({ slug }: { slug: string }) {
  useEffect(() => {
    const k = `sf_viewed_${slug}`;
    try {
      if (sessionStorage.getItem(k)) return;
      sessionStorage.setItem(k, "1");
    } catch {}
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, event: "views" }) }).catch(() => {});
  }, [slug]);
  return null;
}
