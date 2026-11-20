"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { MINE_KEY, storage, type MyStore } from "@/lib/client";

export default function Home() {
  const [mine, setMine] = useState<MyStore[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser-only state after mount
    setMine(storage.get<MyStore[]>(MINE_KEY) ?? []);
  }, []);
  return (
    <main className="min-h-dvh bg-gradient-to-br from-slate-950 via-indigo-950 to-rose-900 text-white">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5 py-20 text-center sm:py-28">
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium">For Indian creators · free</span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">Your Instagram, turned into a store in 2 minutes.</h1>
        <p className="mt-5 max-w-xl text-lg text-white/75">
          Share your handle or a line about what you do. AI writes your bio, suggests products your followers will actually buy, and prices them in rupees.
        </p>
        <Link href="/create" className="mt-8 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-neutral-950 hover:bg-white/90">
          ✨ Build my store
        </Link>
        <div className="mt-14 grid w-full gap-3 text-left sm:grid-cols-3">
          {[
            ["1", "Tell us about you", "Your Instagram handle, or one line on what you post."],
            ["2", "AI drafts your store", "Bio, 3 product ideas, descriptions and ₹ prices."],
            ["3", "Edit and share", "Change anything, then put the link in your bio."],
          ].map(([n, t, d]) => (
            <div key={n} className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-white/60">Step {n}</p>
              <p className="mt-1 font-semibold">{t}</p>
              <p className="mt-1 text-sm text-white/70">{d}</p>
            </div>
          ))}
        </div>
        {mine.length > 0 && (
          <div className="mt-10 w-full rounded-2xl bg-white/10 p-4 text-left">
            <p className="text-sm font-semibold">Your stores on this device</p>
            <ul className="mt-2 space-y-1 text-sm">
              {mine.map((m) => (
                <li key={m.slug} className="flex justify-between gap-3">
                  <span className="truncate">{m.name}</span>
                  <span className="flex gap-3">
                    <Link className="underline" href={`/s/${m.slug}`}>View</Link>
                    <Link className="underline" href={`/edit/${m.slug}?k=${m.editKey}`}>Edit</Link>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
