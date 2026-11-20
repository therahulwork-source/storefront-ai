import { fetchInstagram } from "@/lib/instagram";

export async function POST(req: Request) {
  const { handle } = await req.json().catch(() => ({}));
  if (typeof handle !== "string") return Response.json({ ok: false, reason: "invalid" });
  return Response.json(await fetchInstagram(handle));
}
