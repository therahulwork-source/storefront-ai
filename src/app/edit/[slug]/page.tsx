"use client";
import { use, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/client";
import type { Store } from "@/lib/types";
import { Editor, type Section } from "@/components/Editor";
import { Button, Notice, Spinner } from "@/components/ui";

export default function EditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const sp = useSearchParams();
  const key = sp.get("k") ?? "";
  const [store, setStore] = useState<Store | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [stats, setStats] = useState({ views: 0, clicks: 0 });
  const [error, setError] = useState("");
  const [section, setSection] = useState<Section>(1);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [copied, setCopied] = useState(false);
  const [showNew, setShowNew] = useState(sp.get("new") === "1");
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser-only state after mount
    setOrigin(window.location.origin);
    api<{ store: Store; stats: { views: number; clicks: number } }>(`/api/stores/${slug}?k=${encodeURIComponent(key)}`, undefined, "GET")
      .then((r) => {
        setStore(r.store);
        setSaved(JSON.stringify(r.store));
        setStats(r.stats);
      })
      .catch((e) => setError(e.message));
  }, [slug, key]);

  const dirty = store !== null && JSON.stringify(store) !== saved;
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  async function save() {
    if (!store) return;
    setSaving(true);
    setSaveMsg("");
    try {
      await api(`/api/stores/${slug}`, { store, editKey: key }, "PUT");
      setSaved(JSON.stringify(store));
      setSaveMsg("Saved ✓ Your store is updated.");
    } catch (e) {
      setSaveMsg((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (error)
    return (
      <div className="mx-auto max-w-md p-8">
        <Notice tone="error">{error}</Notice>
        <Link href="/create" className="mt-4 inline-block text-sm font-medium text-blue-700">
          Create a new store →
        </Link>
      </div>
    );
  if (!store)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Spinner />
      </div>
    );

  const url = `${origin}/s/${slug}`;
  const share = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Editor
      store={store}
      setStore={setStore}
      mode="live"
      section={section}
      setSection={setSection}
      topBar={
        <div className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-8">
          {showNew && (
            <div className="mb-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 p-4 text-white">
              <div className="flex items-start justify-between">
                <p className="text-lg font-bold">🎉 Your store is live!</p>
                <button onClick={() => setShowNew(false)} aria-label="Dismiss">✕</button>
              </div>
              <p className="mt-1 text-sm text-white/90">Put the link in your Instagram bio. Bookmark this page: it&apos;s your private link to edit the store.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-full truncate rounded-full bg-neutral-100 px-4 py-2 text-sm">🚀 {url.replace(/^https?:\/\//, "")}</span>
            <Button variant="secondary" className="!py-2" onClick={share}>
              {copied ? "Copied ✓" : "Copy link"}
            </Button>
            <a className="rounded-full bg-[#25D366] px-4 py-2 text-sm font-semibold text-white" href={`https://wa.me/?text=${encodeURIComponent(`Check out my store: ${url}`)}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <a className="rounded-full px-3 py-2 text-sm font-semibold text-blue-700" href={url} target="_blank" rel="noopener noreferrer">
              Open ↗
            </a>
          </div>
          <div className="mt-3 flex gap-6 text-sm text-neutral-600">
            <span>
              👀 <b className="text-neutral-900">{stats.views}</b> store views
            </span>
            <span>
              👆 <b className="text-neutral-900">{stats.clicks}</b> buy clicks
            </span>
          </div>
        </div>
      }
      primaryAction={
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-sm text-neutral-600">{saveMsg}</span>}
          <Button onClick={save} loading={saving} disabled={!dirty || store.products.length === 0}>
            {dirty ? "Save changes" : "All changes saved"}
          </Button>
        </div>
      }
    />
  );
}
