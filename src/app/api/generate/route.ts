import { AiError, generateBio, generateProduct, generateStore } from "@/lib/ai";
import type { CreatorProfile } from "@/lib/types";

export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const profile = body?.profile as CreatorProfile | undefined;
  if (!profile || typeof profile.category !== "string") {
    return Response.json({ error: "Missing creator details." }, { status: 400 });
  }
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "AI isn't configured on this server (GEMINI_API_KEY missing).", code: "config" }, { status: 503 });
  }
  try {
    switch (body.kind) {
      case "store":
        return Response.json(await generateStore(profile, Boolean(body.force)));
      case "bio":
        return Response.json({ bio: await generateBio(profile, String(body.current ?? "")) });
      case "product":
        return Response.json({
          product: await generateProduct(profile, {
            avoid: Array.isArray(body.avoid) ? body.avoid.map(String).slice(0, 10) : [],
            type: body.type,
            titleHint: body.titleHint ? String(body.titleHint).slice(0, 200) : undefined,
            sessionKind: body.sessionKind,
          }),
        });
      default:
        return Response.json({ error: "Unknown request." }, { status: 400 });
    }
  } catch (e) {
    const err = e instanceof AiError ? e : new AiError("upstream", (e as Error).message);
    console.error("[generate]", err.code, err.message);
    const msg =
      err.code === "safety"
        ? "The AI couldn't write this one. Try rephrasing your description."
        : err.code === "rate_limit"
          ? "Lots of people are building stores right now. Please try again in a minute."
          : "The AI is taking a break. Please try again.";
    return Response.json({ error: msg, code: err.code }, { status: 502 });
  }
}
