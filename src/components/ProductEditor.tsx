"use client";
import { useRef, useState } from "react";
import { genProduct, resizeImage } from "@/lib/client";
import { bandFor, tierFor } from "@/lib/pricing";
import { PRODUCT_TYPES, type CreatorProfile, type Product } from "@/lib/types";
import { Button, Field, Notice, formatINR, inputCls } from "./ui";

const MAX_IMAGES: Record<Product["type"], number> = { digital: 1, session: 1, locked: 1, affiliate: 1, physical: 6 };

export function ProductEditor({
  p,
  profile,
  others,
  onChange,
  onDelete,
  defaultOpen,
}: {
  p: Product;
  profile: CreatorProfile;
  others: string[];
  onChange: (p: Product) => void;
  onDelete: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Product>) => onChange({ ...p, ...patch });
  const typeLabel = PRODUCT_TYPES.find((t) => t.type === p.type)?.label ?? p.type;

  async function regenerate(useTitleAsHint: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const next = await genProduct(profile, {
        avoid: others,
        type: p.type,
        sessionKind: p.sessionKind,
        titleHint: useTitleAsHint ? p.title : undefined,
      });
      // keep the creator's own uploads and links
      onChange({ ...next, id: p.id, images: p.images, fileName: p.fileName, affiliateUrl: p.affiliateUrl, meetLink: p.meetLink, schedule: p.schedule });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addImages(files: FileList | null) {
    if (!files) return;
    setErr(null);
    const room = MAX_IMAGES[p.type] - (MAX_IMAGES[p.type] === 1 ? 0 : p.images.length);
    try {
      const urls = await Promise.all(Array.from(files).slice(0, Math.max(1, room)).map((f) => resizeImage(f, p.type === "physical" ? 600 : 720)));
      set({ images: MAX_IMAGES[p.type] === 1 ? urls.slice(0, 1) : [...p.images, ...urls].slice(0, 6) });
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const isNew = !p.title && !p.description;
  const showRange = p.type !== "affiliate" && p.type !== "physical";
  const [bandLo, bandHi] = bandFor({
    category: profile.category,
    type: p.type,
    tier: tierFor(profile),
    sessionKind: p.sessionKind,
    durationMinutes: p.durationMinutes,
  });

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white">
      <button type="button" className="flex w-full items-center gap-3 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-neutral-500">
            {typeLabel} · {p.format || "—"} {p.aiGenerated && <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Storefront AI</span>}
          </p>
          <p className="truncate font-semibold text-neutral-900">{p.title || "New product"}</p>
        </div>
        <span className="text-sm font-semibold text-neutral-900">{formatINR(p.price)}</span>
        <span className="text-neutral-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-100 p-4">
          {isNew && (
            <Notice tone="info">Describe your idea in the title box, for example &quot;Weekend baking class&quot;, then tap <b>Write with Storefront AI</b>. It writes the description and suggests a price.</Notice>
          )}
          <Field label="Title">
            <input className={inputCls} value={p.title} maxLength={80} placeholder="e.g. 7-day home workout plan" onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Format" hint="How buyers receive it, e.g. PDF e-book, 30-min video call">
            <input className={inputCls} value={p.format} maxLength={40} onChange={(e) => set({ format: e.target.value })} />
          </Field>
          <Field label="Description">
            <textarea className={`${inputCls} min-h-24`} value={p.description} maxLength={500} onChange={(e) => set({ description: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (₹)">
              <input className={inputCls} type="number" inputMode="numeric" min={0} value={p.price} onChange={(e) => set({ price: Math.max(0, Math.round(Number(e.target.value) || 0)) })} />
            </Field>
            <Field label="Original price (₹)" hint="Optional, shows a discount">
              <input
                className={inputCls}
                type="number"
                inputMode="numeric"
                min={0}
                value={p.compareAtPrice ?? ""}
                placeholder="—"
                onChange={(e) => set({ compareAtPrice: e.target.value ? Math.max(0, Math.round(Number(e.target.value))) : null })}
              />
            </Field>
          </div>
          {(p.priceRationale || showRange) && (
            <div className="space-y-1 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
              {p.priceRationale && (
                <p>
                  💡 <b>Why {formatINR(p.price)}?</b> {p.priceRationale}
                </p>
              )}
              {showRange && (
                <p>
                  📊 Creators like you usually charge <b>{formatINR(bandLo)}–{formatINR(bandHi)}</b> for this.
                  {(p.price < bandLo || p.price > bandHi) && p.price > 0 && <span className="text-amber-700"> Your price is outside this range, which is fine if you have a reason.</span>}
                </p>
              )}
            </div>
          )}
          {p.compareAtPrice !== null && p.compareAtPrice <= p.price && p.compareAtPrice > 0 && (
            <p className="text-xs text-amber-700">The original price should be higher than the price to show a discount.</p>
          )}
          <Field label="Button text">
            <input className={inputCls} value={p.ctaLabel} maxLength={20} onChange={(e) => set({ ctaLabel: e.target.value })} />
          </Field>

          {p.type === "session" && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Session type">
                <select className={inputCls} value={p.sessionKind ?? "one_on_one"} onChange={(e) => set({ sessionKind: e.target.value as Product["sessionKind"] })}>
                  <option value="one_on_one">1:1</option>
                  <option value="group">Group class</option>
                </select>
              </Field>
              <Field label="Duration (min)">
                <input className={inputCls} type="number" min={10} value={p.durationMinutes ?? 30} onChange={(e) => set({ durationMinutes: Math.max(10, Number(e.target.value) || 30) })} />
              </Field>
              <div className="col-span-2">
                <Field label="When are you available?" hint="Shown to buyers, e.g. Sat & Sun, 6–8 PM">
                  <input className={inputCls} value={p.schedule ?? ""} maxLength={60} onChange={(e) => set({ schedule: e.target.value })} />
                </Field>
              </div>
              <div className="col-span-2">
                <Field label="Google Meet link" hint="Private: sent to buyers after they book (not shown on your store)">
                  <input className={inputCls} value={p.meetLink ?? ""} placeholder="https://meet.google.com/..." onChange={(e) => set({ meetLink: e.target.value })} />
                </Field>
              </div>
            </div>
          )}
          {(p.type === "digital" || p.type === "locked") && (
            <Field label="File for buyers" hint="Prototype: we save the file name only. File delivery isn't built yet.">
              <input
                type="file"
                className="block w-full text-sm text-neutral-600 file:mr-3 file:rounded-full file:border-0 file:bg-neutral-100 file:px-4 file:py-2 file:text-sm file:font-medium"
                onChange={(e) => set({ fileName: e.target.files?.[0]?.name })}
              />
              {p.fileName && <span className="mt-1 block text-xs text-neutral-600">📎 {p.fileName}</span>}
            </Field>
          )}
          {p.type === "affiliate" && (
            <Field label="Affiliate link">
              <input className={inputCls} value={p.affiliateUrl ?? ""} placeholder="https://amzn.to/..." onChange={(e) => set({ affiliateUrl: e.target.value })} />
            </Field>
          )}

          <div>
            <p className="mb-1.5 text-sm font-medium text-neutral-800">
              {p.type === "physical" ? "Photos (up to 6)" : p.type === "locked" ? "Preview image (shown blurred)" : "Cover image (optional)"}
            </p>
            <div className="flex flex-wrap gap-2">
              {p.images.map((src, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button type="button" aria-label="Remove image" className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-neutral-900 text-xs text-white" onClick={() => set({ images: p.images.filter((_, j) => j !== i) })}>
                    ×
                  </button>
                </div>
              ))}
              {(p.type === "physical" ? p.images.length < 6 : p.images.length < 1) && (
                <button type="button" className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-neutral-300 text-2xl text-neutral-400" onClick={() => fileRef.current?.click()}>
                  +
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" multiple={p.type === "physical"} className="hidden" onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
            </div>
          </div>

          {err && <Notice tone="error">{err}</Notice>}
          <div className="flex flex-wrap gap-2 pt-1">
            {isNew || !p.aiGenerated ? (
              <Button variant="ai" loading={busy} onClick={() => regenerate(Boolean(p.title))} type="button">
                ✨ Write with Storefront AI
              </Button>
            ) : (
              <Button variant="ai" loading={busy} onClick={() => regenerate(false)} type="button">
                ✨ Try a different idea
              </Button>
            )}
            <Button variant="danger" type="button" onClick={onDelete}>
              Delete
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
