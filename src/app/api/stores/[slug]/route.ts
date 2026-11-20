import { getRecord, getStats, putRecord } from "@/lib/db";
import { validateStore } from "@/lib/validate";

export async function GET(req: Request, ctx: RouteContext<"/api/stores/[slug]">) {
  const { slug } = await ctx.params;
  const key = new URL(req.url).searchParams.get("k");
  const rec = await getRecord(slug);
  if (!rec || rec.editKey !== key) return Response.json({ error: "Store not found or link expired." }, { status: 404 });
  return Response.json({ store: rec.store, stats: await getStats(slug) });
}

export async function PUT(req: Request, ctx: RouteContext<"/api/stores/[slug]">) {
  const { slug } = await ctx.params;
  const body = await req.json().catch(() => null);
  const rec = await getRecord(slug);
  if (!rec || rec.editKey !== body?.editKey) return Response.json({ error: "Not allowed." }, { status: 403 });
  const v = validateStore(body?.store);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  await putRecord(slug, { editKey: rec.editKey, store: { ...v.store, slug, createdAt: rec.store.createdAt, updatedAt: Date.now() } });
  return Response.json({ ok: true });
}
