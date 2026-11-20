import { nanoid } from "nanoid";
import { putRecord, slugTaken } from "@/lib/db";
import { slugify } from "@/lib/slug";
import { validateStore } from "@/lib/validate";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const v = validateStore(body?.store);
  if (!v.ok) return Response.json({ error: v.error }, { status: 400 });
  const store = v.store;
  const base = slugify(body?.preferredSlug || store.profile.handles[0] || store.displayName);
  let slug = base;
  for (let i = 0; i < 5 && (await slugTaken(slug)); i++) slug = `${base}${nanoid(3).toLowerCase().replace(/[^a-z0-9]/g, "x")}`;
  const editKey = nanoid(24);
  const now = Date.now();
  await putRecord(slug, { store: { ...store, slug, createdAt: now, updatedAt: now }, editKey });
  return Response.json({ slug, editKey });
}
