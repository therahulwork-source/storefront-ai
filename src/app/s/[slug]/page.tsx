import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getRecord } from "@/lib/db";
import { StoreView } from "@/components/StoreView";
import { TrackView } from "./track";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const rec = await getRecord(slug);
  if (!rec) return { title: "Store not found" };
  return { title: `${rec.store.displayName} · Store`, description: rec.store.bio };
}

export default async function PublicStore({ params }: PageProps<"/s/[slug]">) {
  const { slug } = await params;
  const rec = await getRecord(slug);
  if (!rec) notFound();
  // never expose private fields (meet links, payout details) to buyers
  const store = {
    ...rec.store,
    upiId: "",
    products: rec.store.products.map((p) => ({ ...p, meetLink: undefined, fileName: undefined, priceRationale: "" })),
  };
  return (
    <div className="min-h-dvh">
      <TrackView slug={slug} />
      <StoreView store={store} live />
    </div>
  );
}
