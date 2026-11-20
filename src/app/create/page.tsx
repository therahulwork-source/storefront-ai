"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, DRAFT_KEY, genStore, MINE_KEY, storage, type Draft, type MyStore, type StoreGen } from "@/lib/client";
import { normaliseHandle } from "@/lib/instagram";
import { starterProducts } from "@/lib/templates";
import { CATEGORIES, type CreatorProfile, type IgSignals, type Store } from "@/lib/types";
import { Editor, type Section } from "@/components/Editor";
import { Button, Field, Notice, Spinner, StepFooter, inputCls } from "@/components/ui";

const CAT_EMOJI: Record<string, string> = {
  "Finance & Trading": "💰", "Astrology / Numerology": "🕉️", Coaching: "🎤", "Digital Marketing": "📊", Medical: "⛑️",
  "Education & Career": "🎓", "Fitness & Nutrition": "💪", "Design & Arts": "🎨", "Technology & IT": "💻",
  "Law & Legal Services": "📓", "Travel / Hospitality": "✈️", "Beauty & Personal Care": "💄",
  "Entertainment & Media": "🍿", "Food & Cooking": "🍳", Other: "✨",
};

const emptyProfile: CreatorProfile = { name: "", category: "", handles: [""], about: "", language: "english", igSignals: null };

type IgState = { status: "idle" | "checking" | "found" | "failed"; reason?: string };
type Stage = "wizard" | "generating" | "vague" | "error" | "editor";

function storeFrom(profile: CreatorProfile, g: Pick<StoreGen, "displayName" | "bio" | "products">): Store {
  return {
    slug: "",
    profile,
    displayName: g.displayName || profile.name,
    bio: g.bio,
    avatar: null,
    theme: "midnight",
    products: g.products,
    upiId: "",
    createdAt: 0,
    updatedAt: 0,
  };
}

const INVALID_HANDLE = "doesn't look like an Instagram handle. Handles use letters, numbers, dots and underscores.";

export default function CreatePage() {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [stage, setStage] = useState<Stage>("wizard");
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<CreatorProfile>(emptyProfile);
  const [ig, setIg] = useState<IgState>({ status: "idle" });
  const [store, setStore] = useState<Store | null>(null);
  const [section, setSection] = useState<Section>(0);
  const [question, setQuestion] = useState("");
  const [extra, setExtra] = useState("");
  const [errMsg, setErrMsg] = useState("");
  const [fails, setFails] = useState(0);
  const [launching, setLaunching] = useState(false);
  const [launchErr, setLaunchErr] = useState("");

  // restore draft
  useEffect(() => {
    const d = storage.get<Draft>(DRAFT_KEY);
    if (d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from browser-only state after mount
      setProfile(d.profile);
      if (d.stage === "editor" && d.store) {
        setStore(d.store);
        setStage("editor");
        setSection(Math.min(2, d.step) as Section);
      } else setStep(Math.min(3, Math.max(1, d.step)));
    }
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    if (stage === "editor" && store) storage.set(DRAFT_KEY, { stage: "editor", profile, store, step: section } satisfies Draft);
    else if (stage === "wizard") storage.set(DRAFT_KEY, { stage: "wizard", profile, store: null, step } satisfies Draft);
  }, [loaded, stage, profile, store, step, section]);

  const p = (patch: Partial<CreatorProfile>) => setProfile((x) => ({ ...x, ...patch }));
  const handles = profile.handles.map((h) => h.trim()).filter(Boolean);
  const badHandle = handles.find((h) => !normaliseHandle(h));
  const igOk = ig.status === "found" && profile.igSignals;
  const aboutWords = profile.about.trim().split(/\s+/).filter(Boolean).length;
  const aboutNeeded = !igOk;

  async function checkInstagram() {
    const first = handles[0] ? normaliseHandle(handles[0]) : null;
    p({ handles: handles.map((h) => normaliseHandle(h) ?? h) });
    if (!first) {
      setIg({ status: "idle" });
      p({ igSignals: null });
      setStep(3);
      return;
    }
    setIg({ status: "checking" });
    setStep(3);
    try {
      const r = await api<{ ok: true; signals: IgSignals } | { ok: false; reason: string }>("/api/instagram", { handle: first });
      if (r.ok) {
        setIg({ status: "found" });
        p({ igSignals: r.signals });
      } else {
        setIg({ status: "failed", reason: r.reason });
        p({ igSignals: null });
      }
    } catch {
      setIg({ status: "failed", reason: "blocked" });
      p({ igSignals: null });
    }
  }

  async function generate(force = false, prof = profile) {
    setStage("generating");
    try {
      const g = await genStore({ ...prof, handles: prof.handles.filter(Boolean) }, force);
      if (g.inputQuality === "too_vague" && !force) {
        setQuestion(g.clarifyingQuestion || "Tell us a little more about what you post and who follows you.");
        setStage("vague");
        return;
      }
      setFails(0);
      setStore(storeFrom({ ...prof, handles: prof.handles.filter(Boolean) }, g));
      setSection(0);
      setStage("editor");
    } catch (e) {
      setFails((f) => f + 1);
      setErrMsg((e as Error).message);
      setStage("error");
    }
  }

  function useTemplate() {
    const prof = { ...profile, handles: profile.handles.filter(Boolean) };
    setStore(
      storeFrom(prof, {
        displayName: prof.name,
        bio: `Hi, I'm ${prof.name || "a creator"}! Everything I make for my community lives here.`.slice(0, 116),
        products: starterProducts(prof),
      }),
    );
    setSection(0);
    setStage("editor");
  }

  async function launch() {
    if (!store) return;
    setLaunching(true);
    setLaunchErr("");
    try {
      const { slug, editKey } = await api<{ slug: string; editKey: string }>("/api/stores", { store });
      const mine = storage.get<MyStore[]>(MINE_KEY) ?? [];
      storage.set(MINE_KEY, [{ slug, editKey, name: store.displayName }, ...mine.filter((m) => m.slug !== slug)].slice(0, 10));
      storage.del(DRAFT_KEY);
      router.push(`/edit/${slug}?k=${editKey}&new=1`);
    } catch (e) {
      setLaunchErr((e as Error).message);
      setLaunching(false);
    }
  }

  function startOver() {
    if (!confirm("Start over? Your current draft will be cleared.")) return;
    storage.del(DRAFT_KEY);
    setProfile(emptyProfile);
    setStore(null);
    setIg({ status: "idle" });
    setStep(1);
    setStage("wizard");
  }

  if (!loaded) return null;

  if (stage === "editor" && store) {
    return (
      <Editor
        store={store}
        setStore={setStore}
        mode="setup"
        section={section}
        setSection={setSection}
        onRegenerateAll={() => {
          if (confirm("Regenerate your bio and all products? Your edits will be replaced.")) generate(true);
        }}
        topBar={
          <div className="flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 sm:px-8">
            <span className="font-bold">Storefront AI</span>
            <button className="text-sm text-neutral-500 hover:text-neutral-900" onClick={startOver}>
              Start over
            </button>
          </div>
        }
        primaryAction={
          <div className="flex flex-col items-end gap-2">
            {launchErr && <span className="text-sm text-red-600">{launchErr}</span>}
            <Button onClick={launch} loading={launching} disabled={store.products.length === 0}>
              🚀 Launch my store
            </Button>
          </div>
        }
      />
    );
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-200 via-indigo-100 to-sky-200 p-3 sm:p-8">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-xl sm:p-12">
        {stage === "generating" && <Generating profile={profile} />}

        {stage === "vague" && (
          <div>
            <h1 className="text-2xl font-bold">Help us get this right 🙏</h1>
            <p className="mt-2 text-neutral-600">{question}</p>
            <textarea className={`${inputCls} mt-4 min-h-24`} placeholder="e.g. I post easy 15-minute Indian dinner recipes for working couples" value={extra} onChange={(e) => setExtra(e.target.value)} />
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => generate(true)}>
                Generate anyway
              </Button>
              <Button
                disabled={extra.trim().split(/\s+/).length < 3}
                onClick={() => {
                  const next = { ...profile, about: `${profile.about} ${extra}`.trim() };
                  setProfile(next);
                  setExtra("");
                  generate(false, next);
                }}
              >
                Update & generate ›
              </Button>
            </div>
          </div>
        )}

        {stage === "error" && (
          <div>
            <h1 className="text-2xl font-bold">That didn&apos;t work</h1>
            <p className="mt-2 text-neutral-600">{errMsg} Your details are saved.</p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button variant="ghost" onClick={() => setStage("wizard")}>
                Edit my details
              </Button>
              {fails >= 2 && (
                <Button variant="secondary" onClick={useTemplate}>
                  Start from a template
                </Button>
              )}
              <Button onClick={() => generate(false)}>Try again</Button>
            </div>
            {fails >= 2 && <p className="mt-3 text-right text-xs text-neutral-500">A template gives you editable starter products now. You can use AI on each product later.</p>}
          </div>
        )}

        {stage === "wizard" && step === 1 && (
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">👋 Let&apos;s build your store in 2 minutes</h1>
            <p className="mt-2 text-neutral-600">Tell us a little about you, and AI will set up a store you can share today.</p>
            <div className="mt-8">
              <Field label="What should we call you?">
                <input autoFocus className={inputCls} value={profile.name} maxLength={40} placeholder="Your name" onChange={(e) => p({ name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && profile.name.trim() && setStep(2)} />
              </Field>
            </div>
            <StepFooter step={1} total={3}>
              <Button disabled={!profile.name.trim()} onClick={() => setStep(2)}>
                Next ›
              </Button>
            </StepFooter>
          </div>
        )}

        {stage === "wizard" && step === 2 && (
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Hi {profile.name.split(" ")[0]}, what type of content do you create?</h1>
            <p className="mt-2 text-neutral-600">This helps AI suggest products that sell in your niche.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => p({ category: c })}
                  className={`rounded-xl border px-3.5 py-2 text-sm sm:text-[15px] ${profile.category === c ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-neutral-200 hover:border-neutral-400"}`}
                >
                  {CAT_EMOJI[c]} {c}
                </button>
              ))}
            </div>
            <div className="my-8 flex items-center gap-3 text-sm text-neutral-600">
              <span className="h-px flex-1 bg-neutral-200" />
              What&apos;s your Instagram handle?
              <span className="h-px flex-1 bg-neutral-200" />
            </div>
            <div className="space-y-2">
              {profile.handles.map((h, i) => (
                <div key={i} className="flex items-center gap-2 rounded-full border border-neutral-300 px-4 py-2.5 focus-within:border-neutral-900">
                  <span>📸</span>
                  <span className="text-neutral-400">@</span>
                  <input
                    className="flex-1 bg-transparent outline-none"
                    value={h}
                    placeholder={i === 0 ? "yourhandle or instagram.com/yourhandle" : "another handle"}
                    onChange={(e) => p({ handles: profile.handles.map((x, j) => (j === i ? e.target.value : x)) })}
                  />
                  {i > 0 && (
                    <button className="text-neutral-400" onClick={() => p({ handles: profile.handles.filter((_, j) => j !== i) })} aria-label="Remove handle">
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {badHandle && <p className="text-xs text-red-600">&quot;{badHandle}&quot; {INVALID_HANDLE}</p>}
              <div className="flex justify-between text-sm">
                {profile.handles.length < 3 ? (
                  <button className="font-medium text-blue-700" onClick={() => p({ handles: [...profile.handles, ""] })}>
                    + Add another handle
                  </button>
                ) : <span />}
                <span className="text-neutral-500">No Instagram? Leave it blank.</span>
              </div>
            </div>
            <StepFooter step={2} total={3}>
              <Button variant="ghost" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button disabled={!profile.category || Boolean(badHandle)} onClick={checkInstagram}>
                Next ›
              </Button>
            </StepFooter>
          </div>
        )}

        {stage === "wizard" && step === 3 && (
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Tell us about you</h1>
            <div className="mt-5">
              {ig.status === "checking" && (
                <Notice tone="info">
                  <span className="flex items-center gap-2">
                    <Spinner /> Looking up @{normaliseHandle(handles[0]) ?? handles[0]}…
                  </span>
                </Notice>
              )}
              {ig.status === "found" && profile.igSignals && (
                <Notice tone="ok">
                  📸 <b>@{profile.igSignals.handle}</b>
                  {profile.igSignals.followers != null && <> · {profile.igSignals.followers.toLocaleString("en-IN")} followers</>}
                  {profile.igSignals.bio && <span className="mt-1 block text-emerald-800">&quot;{profile.igSignals.bio}&quot;</span>}
                </Notice>
              )}
              {ig.status === "failed" && handles.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {handles.map((h) => (
                    <span key={h} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm text-neutral-800">
                      📸 @{normaliseHandle(h) ?? h}
                    </span>
                  ))}
                  <span className="self-center text-xs text-neutral-500">Linked on your store</span>
                </div>
              )}
            </div>
            <div className="mt-6 space-y-5">
              <Field
                label={aboutNeeded ? "Describe what you do in a line or two" : "Anything to add? (optional)"}
                hint={aboutNeeded ? "What you post, who follows you, and what they ask you for most." : "For example, what your followers keep asking you for."}
              >
                <textarea
                  className={`${inputCls} min-h-28`}
                  value={profile.about}
                  maxLength={600}
                  placeholder="e.g. I'm a home baker in Pune. I post eggless cake recipes and followers keep asking for my exact measurements."
                  onChange={(e) => p({ about: e.target.value })}
                />
              </Field>
              <Field label="Store language">
                <div className="flex gap-2">
                  {(["english", "hinglish"] as const).map((l) => (
                    <button key={l} onClick={() => p({ language: l })} className={`rounded-xl border px-4 py-2 text-sm ${profile.language === l ? "border-blue-500 bg-blue-50 ring-1 ring-blue-500" : "border-neutral-200"}`}>
                      {l === "english" ? "English" : "Hinglish (Roman script)"}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
            {aboutNeeded && profile.about.trim().length > 0 && aboutWords < 4 && (
              <p className="mt-2 text-xs text-amber-700">A few more words helps AI suggest better products.</p>
            )}
            <StepFooter step={3} total={3}>
              <Button variant="ghost" onClick={() => setStep(2)}>
                Back
              </Button>
              <Button disabled={ig.status === "checking" || (aboutNeeded && aboutWords < 2)} onClick={() => generate(false)}>
                ✨ Build my store
              </Button>
            </StepFooter>
          </div>
        )}
      </div>
    </div>
  );
}

function Generating({ profile }: { profile: CreatorProfile }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-2xl">
        <Spinner className="text-violet-700" />
      </div>
      <h1 className="mt-5 text-2xl font-bold">Building your store…</h1>
      <p className="mx-auto mt-3 max-w-sm text-neutral-600">
        AI is writing your bio and 3 product ideas{profile.category && profile.category !== "Other" ? ` for ${profile.category.toLowerCase()}` : ""}, with prices that suit Indian buyers.
      </p>
      <p className="mt-6 text-xs text-neutral-500">{secs < 15 ? "Usually takes 5–15 seconds." : "Taking a little longer than usual. Hang on…"}</p>
    </div>
  );
}
