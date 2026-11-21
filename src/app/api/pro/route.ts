import { getProJoin, getRecord, recordProJoin, recordProView } from "@/lib/db";
import { tierFor } from "@/lib/pricing";

// Pro waitlist: a fake-door test. Only the store owner (edit key) can record.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const slug = typeof body?.slug === "string" ? body.slug : "";
  const rec = slug ? await getRecord(slug) : null;
  if (!rec || rec.editKey !== body?.editKey) return Response.json({ error: "Not allowed." }, { status: 403 });
  const category = rec.store.profile.category || "Unknown";
  const tier = tierFor(rec.store.profile);

  if (body.action === "view") {
    await recordProView(slug, category, tier);
    return Response.json({ joined: await getProJoin(slug) });
  }
  if (body.action === "join" && (body.plan === "monthly" || body.plan === "yearly")) {
    return Response.json({ joined: await recordProJoin(slug, body.plan, category, tier) });
  }
  return Response.json({ error: "Unknown request." }, { status: 400 });
}
