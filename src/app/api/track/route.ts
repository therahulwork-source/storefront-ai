import { bump } from "@/lib/db";

export async function POST(req: Request) {
  const { slug, event } = await req.json().catch(() => ({}));
  if (typeof slug === "string" && (event === "views" || event === "clicks")) await bump(slug, event);
  return new Response(null, { status: 204 });
}
