"use client";
import { useState } from "react";
import { THEMES, shippingSummary, type Product, type Store } from "@/lib/types";
import { formatINR } from "./ui";

const TYPE_EMOJI: Record<Product["type"], string> = { digital: "📘", session: "📅", locked: "🔒", affiliate: "🤝", physical: "📦" };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "★";
}

export function StoreView({ store, live = false }: { store: Store; live?: boolean }) {
  const t = THEMES[store.theme] ?? THEMES.midnight;
  const [checkout, setCheckout] = useState<Product | null>(null);

  const onBuy = (p: Product) => {
    if (live) {
      fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: store.slug, event: "clicks" }) }).catch(() => {});
    }
    if (p.type === "affiliate" && p.affiliateUrl && live) {
      window.open(p.affiliateUrl, "_blank", "noopener");
      return;
    }
    setCheckout(p);
  };

  return (
    <div className={`${live ? "min-h-dvh" : "min-h-full"} w-full`} style={{ background: t.bg, color: t.text }}>
      <div className="mx-auto max-w-md px-4 pb-10 pt-10">
        <header className="flex flex-col items-center text-center">
          {store.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={store.avatar} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-white/30" />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full text-3xl font-bold ring-4 ring-white/30" style={{ background: t.accent, color: "#fff" }}>
              {initials(store.displayName)}
            </div>
          )}
          <h1 className="mt-4 text-2xl font-bold tracking-tight">{store.displayName || "Your name"}</h1>
          {store.bio && <p className="mt-2 max-w-xs text-[15px] leading-snug" style={{ color: t.sub }}>{store.bio}</p>}
          {store.profile.handles.length > 0 && (
            <div className="mt-3 flex gap-2">
              {store.profile.handles.map((h) => (
                <a key={h} href={`https://instagram.com/${h}`} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1 text-xs font-medium" style={{ background: t.card, color: t.text }}>
                  📸 @{h}
                </a>
              ))}
            </div>
          )}
        </header>

        <main className="mt-8 space-y-4">
          {store.products.map((p) => (
            <ProductCard key={p.id} p={p} theme={t} onBuy={() => onBuy(p)} />
          ))}
          {store.products.length === 0 && <p className="text-center text-sm" style={{ color: t.sub }}>Products will appear here.</p>}
        </main>

        <footer className="mt-10 text-center text-xs" style={{ color: t.sub }}>
          Made with Storefront AI
        </footer>
      </div>

      {checkout && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onClick={() => setCheckout(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-neutral-900" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-neutral-500">{checkout.format}</p>
            <h3 className="mt-1 text-lg font-bold">{checkout.title}</h3>
            <p className="mt-3 text-2xl font-bold">{formatINR(checkout.price)}</p>
            <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              This is a demo store, so checkout isn&apos;t live yet. In the real product, buyers pay here by UPI or card.
            </p>
            <button className="mt-5 w-full rounded-full bg-neutral-950 py-3 text-sm font-semibold text-white" onClick={() => setCheckout(null)}>
              Got it
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, theme, onBuy }: { p: Product; theme: (typeof THEMES)[keyof typeof THEMES]; onBuy: () => void }) {
  const [open, setOpen] = useState(false);
  const off = p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
  const img = p.images[0];
  return (
    <article className="overflow-hidden rounded-2xl backdrop-blur" style={{ background: theme.card }}>
      {img && (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img} alt="" className={`aspect-[16/9] w-full object-cover ${p.type === "locked" ? "blur-md" : ""}`} />
          {p.type === "locked" && <span className="absolute inset-0 flex items-center justify-center text-4xl">🔒</span>}
        </div>
      )}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {!img && <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/80 text-xl">{TYPE_EMOJI[p.type]}</span>}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: theme.sub }}>
              {p.format}
              {p.type === "session" && p.durationMinutes && !/min|hour|hr/i.test(p.format) ? ` · ${p.durationMinutes} min` : ""}
            </p>
            <h2 className="mt-0.5 text-[17px] font-semibold leading-snug">{p.title || "Untitled product"}</h2>
          </div>
        </div>
        {p.description && (
          <p className={`mt-2 text-sm leading-relaxed ${open ? "" : "line-clamp-3"}`} style={{ color: theme.sub }} onClick={() => setOpen(!open)}>
            {p.description}
          </p>
        )}
        {p.type === "session" && p.schedule && <p className="mt-2 text-xs" style={{ color: theme.sub }}>🗓 {p.schedule}</p>}
        {shippingSummary(p) && <p className="mt-2 text-xs" style={{ color: theme.sub }}>{shippingSummary(p)}</p>}
        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold">{p.price > 0 ? formatINR(p.price) : "Free"}</span>
            {off > 0 && (
              <>
                <span className="text-sm line-through" style={{ color: theme.sub }}>{formatINR(p.compareAtPrice!)}</span>
                <span className="rounded bg-emerald-500 px-1.5 py-0.5 text-[11px] font-bold text-white">{off}% OFF</span>
              </>
            )}
          </div>
          <button onClick={onBuy} className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ background: theme.accent }}>
            {p.ctaLabel || "Buy now"}
          </button>
        </div>
      </div>
    </article>
  );
}
