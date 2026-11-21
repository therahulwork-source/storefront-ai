"use client";
import { useRef, useState } from "react";
import { genProduct, resizeImage } from "@/lib/client";
import { bandFor, tierFor } from "@/lib/pricing";
import { MAX_SHIP_DAYS, PRODUCT_TYPES, isDraft, type CreatorProfile, type Product } from "@/lib/types";
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
  const typeInfo = PRODUCT_TYPES.find((t) => t.type === p.type);
  const typeLabel = typeInfo?.label ?? p.type;

  // "Write with Storefront AI": polish the creator's own title and description; keep a price they set.
  // "Try a different idea": replace an AI-made product with a fresh idea.
  async function regenerate(polishCreatorText: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const next = await genProduct(profile, {
        avoid: others,
        type: p.type,
        sessionKind: p.sessionKind,
        titleHint: polishCreatorText ? p.title : undefined,
        descriptionHint: polishCreatorText && p.description.trim() ? p.description : undefined,
      });
      const creatorPrice = polishCreatorText ? p.price : null;
      const keep = {
        id: p.id,
        images: p.images,
        fileName: p.fileName,
        affiliateUrl: p.affiliateUrl,
        meetLink: p.meetLink,
        schedule: p.schedule,
        deliveryCharge: p.deliveryCharge,
        shipsWithin: p.shipsWithin,
        shipsCustomDays: p.shipsCustomDays,
        returns: p.returns,
      };
      onChange({
        ...next,
        ...keep,
        price: creatorPrice ?? next.price,
        suggestedPrice: creatorPrice !== null && creatorPrice !== next.price ? (next.price ?? undefined) : undefined,
        compareAtPrice: polishCreatorText ? p.compareAtPrice : next.compareAtPrice,
        aiGenerated: polishCreatorText ? p.aiGenerated : true,
      });
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
  // No price signals until Storefront AI has looked at the product.
  const aiPriced = p.aiGenerated || Boolean(p.priceRationale);
  const showRange = aiPriced && p.type !== "affiliate" && p.type !== "physical";
  const draft = isDraft(p);
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
            {typeLabel}
            {typeInfo?.beta && <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">Beta</span>} · {p.format || "—"} {p.aiGenerated && <span className="ml-1 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">Storefront AI</span>}
          </p>
          <p className="truncate font-semibold text-neutral-900">{p.title || "New product"}</p>
        </div>
        {draft ? (
          <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">Draft</span>
        ) : (
          <span className="text-sm font-semibold text-neutral-900">{p.price === 0 ? "Free" : formatINR(p.price ?? 0)}</span>
        )}
        <span className="text-neutral-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-neutral-100 p-4">
          {isNew && (
            <Notice tone="info">
              Add a title, for example &quot;Weekend baking class&quot;, and a description if you like. Then tap <b>Write with Storefront AI</b> to polish the wording and suggest a price.
            </Notice>
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
              <input
                className={inputCls}
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Set a price"
                value={p.price ?? ""}
                onChange={(e) => set({ price: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value) || 0)) })}
              />
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
          {aiPriced && (p.priceRationale || showRange) && (
            <div className="space-y-1 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-900">
              {p.priceRationale && p.suggestedPrice !== undefined && p.suggestedPrice !== p.price ? (
                <p>
                  💡 <b>Storefront AI suggests {formatINR(p.suggestedPrice)}.</b> {p.priceRationale}{" "}
                  <button type="button" className="font-semibold underline" onClick={() => set({ price: p.suggestedPrice!, suggestedPrice: undefined })}>
                    Use {formatINR(p.suggestedPrice)}
                  </button>
                </p>
              ) : (
                p.priceRationale &&
                p.price !== null && (
                  <p>
                    💡 <b>Why {formatINR(p.price)}?</b> {p.priceRationale}
                  </p>
                )
              )}
              {showRange && (
                <p>
                  📊 Creators like you usually charge <b>{formatINR(bandLo)}–{formatINR(bandHi)}</b> for this.
                  {p.price !== null && (p.price < bandLo || p.price > bandHi) && p.price > 0 && <span className="text-amber-700"> Your price is outside this range, which is fine if you have a reason.</span>}
                </p>
              )}
            </div>
          )}
          {p.compareAtPrice !== null && p.price !== null && p.compareAtPrice <= p.price && p.compareAtPrice > 0 && (
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
          {p.type === "physical" && (
            <div className="space-y-3 rounded-xl border border-neutral-200 p-3">
              <p className="text-xs text-neutral-600">📦 You pack, ship and handle returns yourself, just like selling on Instagram.</p>
              <Field label="Delivery charge">
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className={`${inputCls} w-auto`}
                    value={p.deliveryCharge ? "flat" : "free"}
                    onChange={(e) => set({ deliveryCharge: e.target.value === "free" ? 0 : p.deliveryCharge || 49 })}
                  >
                    <option value="free">Free (included in price)</option>
                    <option value="flat">Flat charge</option>
                  </select>
                  {Boolean(p.deliveryCharge) && (
                    <input
                      className={`${inputCls} w-28`}
                      type="number"
                      min={1}
                      aria-label="Delivery charge in rupees"
                      value={p.deliveryCharge}
                      onChange={(e) => set({ deliveryCharge: Math.max(1, Math.round(Number(e.target.value) || 1)) })}
                    />
                  )}
                </div>
              </Field>
              <Field label="Ships within" hint={p.shipsWithin === "custom" ? `Up to ${MAX_SHIP_DAYS} days.` : undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <select className={`${inputCls} w-auto`} value={p.shipsWithin ?? "3-7"} onChange={(e) => set({ shipsWithin: e.target.value as Product["shipsWithin"], shipsCustomDays: p.shipsCustomDays ?? 10 })}>
                    <option value="1-3">1–3 days</option>
                    <option value="3-7">3–7 days</option>
                    <option value="7-14">7–14 days</option>
                    <option value="custom">Custom</option>
                  </select>
                  {p.shipsWithin === "custom" && (
                    <>
                      <input
                        className={`${inputCls} w-20`}
                        type="number"
                        min={1}
                        max={MAX_SHIP_DAYS}
                        aria-label="Ships within, days"
                        value={p.shipsCustomDays ?? 10}
                        onChange={(e) => set({ shipsCustomDays: Math.min(MAX_SHIP_DAYS, Math.max(1, Math.round(Number(e.target.value) || 1))) })}
                      />
                      <span className="text-sm text-neutral-600">days</span>
                    </>
                  )}
                </div>
              </Field>
              <Field label="Returns">
                <select className={`${inputCls} w-auto`} value={p.returns ?? "none"} onChange={(e) => set({ returns: e.target.value as Product["returns"] })}>
                  <option value="none">No returns</option>
                  <option value="7days">Returns within 7 days (you handle them)</option>
                </select>
              </Field>
            </div>
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
            {!p.aiGenerated ? (
              <Button variant="ai" loading={busy} onClick={() => regenerate(true)} type="button" disabled={!p.title.trim()} title={!p.title.trim() ? "Add a title first" : undefined}>
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
          {!p.aiGenerated && !p.title.trim() && <p className="text-xs text-neutral-500">Add a title first to use Storefront AI.</p>}
        </div>
      )}
    </div>
  );
}
