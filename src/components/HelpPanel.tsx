"use client";
import { useState } from "react";

const HOW_TO: { title: string; steps: string }[] = [
  { title: "Edit your store", steps: "Make changes in any tab, tick the confirmation box, then tap Save changes. Your public store updates straight away." },
  { title: "Change your theme", steps: "Brand tab → Theme → pick Midnight, Sunset or Mint → Save changes. Use the Mobile/Desktop preview to check it." },
  {
    title: "Add a product",
    steps:
      "Products tab → + Add a product → pick a type → describe it in the title → tap ✨ Write with Storefront AI for a description and price → Save changes. Or tap ✨ Suggest another idea.",
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: "How do I get back to this page later?",
    a: "Use your private edit link (this page's address). Bookmark it. It's also listed on the home page under \"Your stores on this device\". There's no login yet, so keep the link safe: anyone with it can edit your store.",
  },
  { q: "Why is \"Save changes\" greyed out?", a: "You need at least one product, the confirmation box ticked, and an unsaved change." },
  {
    q: "How does Storefront AI pick my prices?",
    a: "It uses your category, the product type and your audience size, within ranges based on what Indian creators charge. You can set any price.",
  },
  { q: "Can I change what Storefront AI wrote?", a: "Yes, every field is editable. Use ✨ Rewrite bio or ✨ Try a different idea for a fresh version." },
  { q: "How do buyers pay?", a: "Checkout isn't live in this demo. Buyers who tap a product see a demo message." },
  { q: "When do I get paid?", a: "After KYC (PAN and a bank account in your name). Payouts aren't live in this demo." },
  { q: "Who ships physical products?", a: "You do, like selling on Instagram. Your delivery charge, dispatch time and return policy are shown to buyers." },
  {
    q: "What can't I sell?",
    a: "Adult or explicit content, anything illegal, other people's content, or impersonation of anyone. Stores that break these rules are removed.",
  },
  {
    q: "What do \"store views\" and \"buy clicks\" mean?",
    a: "Store views are visits to your public store, counted once per visit. Buy clicks are taps on any product's button.",
  },
  { q: "What is Pro?", a: "Upcoming tools to sell more: ad tracking, discount codes and buyer insights. Join the waitlist in the Pro tab." },
];

export function HelpPanel({
  onClose,
  onEditBrand,
  onChangeTheme,
  onAddProduct,
  storeUrl,
}: {
  onClose: () => void;
  onEditBrand: () => void;
  onChangeTheme: () => void;
  onAddProduct: () => void;
  storeUrl: string;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };
  const actions: [string, () => void][] = [
    ["✏️ Edit name, bio or photo", onEditBrand],
    ["🎨 Change theme", onChangeTheme],
    ["➕ Add a product", onAddProduct],
    [copied ? "Copied ✓" : "🔗 Copy your store link", copy],
  ];

  return (
    <div className="fixed inset-0 z-[60] flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-title"
        className="flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4">
          <h2 id="help-title" className="text-lg font-bold text-neutral-950">
            Help
          </h2>
          <button onClick={onClose} aria-label="Close help" className="rounded-full px-2 py-1 text-neutral-500 hover:bg-neutral-100">
            ✕
          </button>
        </div>
        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-5">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Quick actions</h3>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {actions.map(([label, fn]) => (
                <button key={label} onClick={fn} className="rounded-xl border border-neutral-200 px-3 py-3 text-left text-sm font-medium text-neutral-900 hover:border-neutral-400">
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">How to</h3>
            <div className="mt-3 space-y-3">
              {HOW_TO.map((h) => (
                <div key={h.title} className="rounded-xl bg-neutral-50 p-3">
                  <p className="font-semibold text-neutral-900">{h.title}</p>
                  <p className="mt-1 text-sm text-neutral-700">{h.steps}</p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">FAQ</h3>
            <div className="mt-3 divide-y divide-neutral-200 rounded-xl border border-neutral-200">
              {FAQ.map((f) => (
                <details key={f.q} className="group px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-neutral-900">
                    {f.q}
                    <span className="text-neutral-400 transition group-open:rotate-180">▾</span>
                  </summary>
                  <p className="mt-2 text-sm text-neutral-700">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}
