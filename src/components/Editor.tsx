"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { nanoid } from "nanoid";
import { api, genBio, genProduct, resizeImage } from "@/lib/client";
import { BIO_MAX, PRODUCT_TYPES, THEMES, type Product, type ProductType, type Store, type ThemeKey } from "@/lib/types";
import { ProductEditor } from "./ProductEditor";
import { StoreView } from "./StoreView";
import { Button, Field, Notice, StepFooter, inputCls } from "./ui";

export type Section = 0 | 1 | 2 | 3 | 4;
const SECTIONS = ["Brand", "Products", "Payments", "Settlements", "Pro ✨"] as const;

function blankProduct(type: ProductType): Product {
  return {
    id: nanoid(8),
    type,
    format: { digital: "PDF / digital file", session: "Video call", locked: "Locked post", affiliate: "Recommended product", physical: "Physical product" }[type],
    title: "",
    description: "",
    price: { digital: 199, session: 499, locked: 49, affiliate: 499, physical: 499 }[type],
    compareAtPrice: null,
    priceRationale: "",
    ctaLabel: { digital: "Get it", session: "Book a call", locked: "Unlock", affiliate: "Shop now", physical: "Buy now" }[type],
    images: [],
    sessionKind: type === "session" ? "one_on_one" : undefined,
    durationMinutes: type === "session" ? 30 : undefined,
    aiGenerated: false,
  };
}

export function Editor({
  store,
  setStore,
  mode,
  section,
  setSection,
  topBar,
  primaryAction,
  onRegenerateAll,
  pro,
}: {
  store: Store;
  setStore: (s: Store) => void;
  mode: "setup" | "live";
  section: Section;
  setSection: (s: Section) => void;
  topBar?: ReactNode;
  primaryAction: ReactNode;
  onRegenerateAll?: () => void;
  pro?: { slug: string; editKey: string };
}) {
  const [bioBusy, setBioBusy] = useState(false);
  const [ideaBusy, setIdeaBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [device, setDevice] = useState<"mobile" | "desktop">("mobile");
  const [kycMsg, setKycMsg] = useState(false);
  type Joined = { plan: "monthly" | "yearly" } | null;
  const [joined, setJoined] = useState<Joined>(null);
  const [joining, setJoining] = useState<"monthly" | "yearly" | null>(null);
  const [proErr, setProErr] = useState("");
  const proViewed = useRef(false);

  // Fake-door test: record one Pro tab view per visit, and load any earlier join.
  useEffect(() => {
    if (section !== 4 || !pro || proViewed.current) return;
    proViewed.current = true;
    api<{ joined: Joined }>("/api/pro", { ...pro, action: "view" })
      .then((r) => setJoined(r.joined))
      .catch(() => {});
  }, [section, pro]);

  async function joinWaitlist(plan: "monthly" | "yearly") {
    if (!pro) return;
    setJoining(plan);
    setProErr("");
    try {
      const r = await api<{ joined: Joined }>("/api/pro", { ...pro, action: "join", plan });
      setJoined(r.joined);
    } catch (e) {
      setProErr((e as Error).message);
    } finally {
      setJoining(null);
    }
  }
  const avatarRef = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Store>) => setStore({ ...store, ...patch });

  const upi = store.upiId.trim();
  const upiBad = upi.length > 0 && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upi);

  async function rewriteBio() {
    setBioBusy(true);
    setErr(null);
    try {
      set({ bio: await genBio(store.profile, store.bio) });
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBioBusy(false);
    }
  }

  async function suggestIdea() {
    setIdeaBusy(true);
    setErr(null);
    try {
      const p = await genProduct(store.profile, { avoid: store.products.map((x) => x.title) });
      set({ products: [...store.products, p] });
      setOpenId(p.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setIdeaBusy(false);
    }
  }

  function addType(t: ProductType) {
    const p = blankProduct(t);
    set({ products: [...store.products, p] });
    setOpenId(p.id);
    setPicker(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-neutral-100 lg:flex-row">
      <div className="flex-1 lg:max-w-2xl lg:overflow-y-auto lg:border-r lg:border-neutral-200 lg:h-dvh">
        {topBar}
        <div className="px-4 py-6 sm:px-8">
          {mode === "live" ? (
            <nav className="mb-6 flex gap-1 overflow-x-auto rounded-full bg-white p-1 shadow-sm">
              {SECTIONS.map((s, i) => (
                <button key={s} className={`flex-1 shrink-0 whitespace-nowrap rounded-full px-2.5 py-2 text-[13px] font-semibold sm:px-3 sm:text-sm ${section === i ? "bg-neutral-950 text-white" : "text-neutral-600"}`} onClick={() => setSection(i as Section)}>
                  {s}
                </button>
              ))}
            </nav>
          ) : null}

          {section === 0 && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">Let&apos;s brand your store</h1>
              <p className="mt-1 text-neutral-600">{store.products.some((x) => x.aiGenerated) ? "Storefront AI wrote this from your details. Change anything you like." : "Here's a starting point. Change anything you like."}</p>
              <div className="mt-6 flex flex-col gap-6 sm:flex-row">
                <div className="flex flex-col items-center gap-2">
                  {store.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={store.avatar} alt="" className="h-28 w-28 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-neutral-200 text-4xl text-neutral-500">👤</div>
                  )}
                  <div className="flex gap-1">
                    <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => avatarRef.current?.click()}>
                      ✎ {store.avatar ? "Change" : "Add photo"}
                    </Button>
                    {store.avatar && (
                      <Button variant="ghost" className="!px-3 !py-1.5 text-xs" onClick={() => set({ avatar: null })}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    ref={avatarRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (!f) return;
                      try {
                        set({ avatar: await resizeImage(f, 320, 0.8) });
                      } catch (x) {
                        setErr((x as Error).message);
                      }
                    }}
                  />
                </div>
                <div className="flex-1 space-y-4">
                  <Field label="Display name">
                    <input className={inputCls} value={store.displayName} maxLength={40} onChange={(e) => set({ displayName: e.target.value })} />
                  </Field>
                  <Field
                    label="Bio"
                    right={<span className={`text-xs ${store.bio.length > BIO_MAX ? "text-red-600" : "text-neutral-400"}`}>{store.bio.length}/{BIO_MAX}</span>}
                  >
                    <textarea className={`${inputCls} min-h-24`} value={store.bio} maxLength={BIO_MAX} onChange={(e) => set({ bio: e.target.value })} />
                  </Field>
                  <Button variant="ai" loading={bioBusy} onClick={rewriteBio}>
                    ✨ Rewrite bio
                  </Button>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-neutral-800">Theme</p>
                    <div className="flex gap-2">
                      {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                        <button
                          key={k}
                          onClick={() => set({ theme: k })}
                          className={`flex flex-col items-center gap-1 rounded-xl p-1.5 text-xs ${store.theme === k ? "ring-2 ring-neutral-900" : ""}`}
                        >
                          <span className="h-10 w-14 rounded-lg" style={{ background: THEMES[k].bg }} />
                          {THEMES[k].label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {section === 1 && (
            <section>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">What you&apos;ll sell</h1>
                  <p className="mt-1 text-neutral-600">{store.products.some((x) => x.aiGenerated) ? "Storefront AI picked these for your audience and priced them for Indian buyers." : "Starter products to edit, or use Storefront AI to fill them in."} Open any one to edit it.</p>
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {store.products.map((p, i) => (
                  <ProductEditor
                    key={p.id}
                    p={p}
                    profile={store.profile}
                    defaultOpen={openId === p.id}
                    others={store.products.filter((x) => x.id !== p.id).map((x) => x.title)}
                    onChange={(np) => set({ products: store.products.map((x, j) => (j === i ? np : x)) })}
                    onDelete={() => set({ products: store.products.filter((x) => x.id !== p.id) })}
                  />
                ))}
                {store.products.length === 0 && <Notice tone="warn">Your store needs at least one product before it can go live.</Notice>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setPicker(!picker)}>
                  + Add a product
                </Button>
                <Button variant="ai" loading={ideaBusy} onClick={suggestIdea} disabled={store.products.length >= 12}>
                  ✨ Suggest another idea
                </Button>
                {onRegenerateAll && (
                  <Button variant="ghost" onClick={onRegenerateAll}>
                    ↻ Regenerate whole store
                  </Button>
                )}
              </div>
              {picker && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <p className="text-sm font-medium text-neutral-800 sm:col-span-2">What do you want to sell?</p>
                  {PRODUCT_TYPES.map((t) => (
                    <button key={t.type} onClick={() => addType(t.type)} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-3 text-left hover:border-neutral-400">
                      <span className="text-2xl">{t.emoji}</span>
                      <span>
                        <span className="block font-semibold text-neutral-900">{t.label}</span>
                        <span className="block text-xs text-neutral-500">{t.hint}</span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {section === 2 && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">Get paid</h1>
              <p className="mt-1 text-neutral-600">Where should your earnings go?</p>
              <div className="mt-6 space-y-4">
                <Notice tone="warn">Demo: payouts aren&apos;t connected yet, so nothing is charged or paid out. You can skip this step.</Notice>
                <Field label="UPI ID (optional)" hint="e.g. yourname@okaxis. Bank account setup comes later.">
                  <input className={inputCls} value={store.upiId} placeholder="yourname@bank" onChange={(e) => set({ upiId: e.target.value })} />
                </Field>
                {upiBad && <p className="text-xs text-red-600">That doesn&apos;t look like a UPI ID. It should look like name@bank.</p>}
                <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p>
                      🔒 <b>KYC required before your first payout.</b> We verify your PAN and a bank account in your name. This keeps buyers safe from fake and impersonation stores.
                    </p>
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">KYC: Not started</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {section === 3 && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">Settlements</h1>
              <div className="mt-6 rounded-2xl border border-neutral-200 bg-white p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-neutral-100 text-2xl">🔒</div>
                <p className="mt-4 text-lg font-semibold text-neutral-900">Complete KYC to see your earnings and payouts</p>
                <p className="mx-auto mt-2 max-w-md text-sm text-neutral-600">
                  We verify your PAN and a bank account in the same name before any money moves. This protects buyers from fake stores and protects you from chargebacks.
                </p>
                <div className="mx-auto mt-5 max-w-sm rounded-xl bg-neutral-50 p-4 text-left text-sm text-neutral-700">
                  <p className="font-medium text-neutral-900">After KYC you&apos;ll see:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>Orders, units sold and items sold</li>
                    <li>Gross sales, fees and net earnings</li>
                    <li>Settled and unsettled amounts</li>
                    <li>A date filter and Excel download</li>
                  </ul>
                </div>
                <Button className="mt-5" onClick={() => setKycMsg(true)}>
                  Complete KYC
                </Button>
                {kycMsg && <p className="mt-3 text-sm text-amber-700">KYC isn&apos;t available in this demo.</p>}
              </div>
            </section>
          )}

          {section === 4 && (
            <section>
              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">SuperStore Pro ✨</h1>
              <p className="mt-1 text-neutral-600">Grow faster with advanced analytics and performance marketing tools.</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <p className="font-semibold text-neutral-900">🎯 Performance marketing</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    <li>Trackable links for every post and reel</li>
                    <li>Meta and Google pixel, so you can run ads and measure sales</li>
                    <li>Discount codes and limited-time offers</li>
                    <li>Abandoned-checkout reminders on WhatsApp</li>
                  </ul>
                </div>
                <div className="rounded-2xl border border-neutral-200 bg-white p-4">
                  <p className="font-semibold text-neutral-900">📈 Advanced analytics</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
                    <li>The full funnel: store visits → buy clicks → purchases</li>
                    <li>Where buyers come from: Instagram, WhatsApp, YouTube and more</li>
                    <li>Conversion rate for each product</li>
                    <li>Repeat buyers and top customers</li>
                  </ul>
                </div>
              </div>
              <div className="relative mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-4" aria-hidden>
                <div className="flex h-28 items-end gap-3 blur-[3px]">
                  {[100, 72, 48, 30, 18].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-violet-300" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-neutral-700">🔒 Funnel insights with Pro</div>
              </div>
              <div className="mt-6 rounded-2xl bg-neutral-950 p-5 text-white">
                <p className="text-sm font-medium text-white/70">Pro is launching soon. Join the waitlist for your plan.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {([
                    ["monthly", "₹999", "/month", "Cancel anytime"],
                    ["yearly", "₹7,999", "/year", "Save 33%"],
                  ] as const).map(([plan, price, per, note]) => (
                    <div key={plan} className={`rounded-xl p-4 ${joined?.plan === plan ? "bg-white/20 ring-2 ring-white" : "bg-white/10"}`}>
                      <p className="text-2xl font-bold">
                        {price}
                        <span className="text-base font-medium text-white/70">{per}</span>
                      </p>
                      <p className="text-xs text-white/70">{note}</p>
                      <button
                        onClick={() => joinWaitlist(plan)}
                        disabled={Boolean(joined) || joining !== null || !pro}
                        className="mt-3 w-full rounded-full bg-white py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
                      >
                        {joined?.plan === plan ? "On the waitlist ✓" : joining === plan ? "Joining…" : "Join the waitlist"}
                      </button>
                    </div>
                  ))}
                </div>
                {joined && <p className="mt-3 text-sm text-white/85">You&apos;re on the waitlist. We&apos;ll let you know when Pro launches.</p>}
                {proErr && <p className="mt-3 text-sm text-red-300">{proErr}</p>}
              </div>
            </section>
          )}

          {err && (
            <div className="mt-4">
              <Notice tone="error">{err}</Notice>
            </div>
          )}

          {mode === "setup" ? (
            <StepFooter step={section + 1} total={3}>
              {section > 0 && (
                <Button variant="ghost" onClick={() => setSection((section - 1) as Section)}>
                  Back
                </Button>
              )}
              {section < 2 ? (
                <Button onClick={() => setSection((section + 1) as Section)} disabled={section === 1 && store.products.length === 0}>
                  Next ›
                </Button>
              ) : (
                primaryAction
              )}
            </StepFooter>
          ) : (
            section <= 2 && <div className="sticky bottom-0 mt-8 flex justify-end gap-2 bg-neutral-100/90 py-3 backdrop-blur">{primaryAction}</div>
          )}
        </div>
      </div>

      {/* Desktop: live preview with Mobile / Desktop switch */}
      <aside className="hidden flex-1 flex-col bg-neutral-900 p-6 lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Preview</h2>
          <div className="flex gap-1 rounded-full bg-white/10 p-1" role="tablist" aria-label="Preview device">
            {(["mobile", "desktop"] as const).map((d) => (
              <button
                key={d}
                role="tab"
                aria-selected={device === d}
                onClick={() => setDevice(d)}
                className={`rounded-full px-4 py-1.5 text-sm font-semibold ${device === d ? "bg-white text-neutral-950" : "text-white/70 hover:text-white"}`}
              >
                {d === "mobile" ? "📱 Mobile" : "🖥 Desktop"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center pt-6">
          {device === "mobile" ? (
            <div className="h-full max-h-[760px] w-[380px] overflow-hidden rounded-[44px] border-[10px] border-neutral-950 bg-black shadow-2xl">
              <div className="h-full overflow-y-auto">
                <StoreView store={store} />
              </div>
            </div>
          ) : (
            <div className="flex h-full max-h-[760px] w-full max-w-[1000px] flex-col overflow-hidden rounded-xl border border-neutral-700 bg-black shadow-2xl">
              <div className="flex items-center gap-2 border-b border-neutral-700 bg-neutral-800 px-3 py-2">
                <span className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                </span>
                <span className="mx-auto truncate rounded-md bg-neutral-700 px-4 py-1 text-xs text-white/80">
                  {store.slug && typeof window !== "undefined" ? `${window.location.host}/s/${store.slug}` : "Your store link"}
                </span>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <StoreView store={store} />
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile: preview toggle */}
      <button onClick={() => setPreview(true)} className="fixed bottom-20 right-4 z-40 rounded-full bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-lg lg:hidden">
        👁 Preview
      </button>
      {preview && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black lg:hidden">
          <button onClick={() => setPreview(false)} className="fixed right-4 top-4 z-50 rounded-full bg-white px-4 py-2 text-sm font-semibold shadow">
            ✕ Close preview
          </button>
          <StoreView store={store} />
        </div>
      )}
    </div>
  );
}
