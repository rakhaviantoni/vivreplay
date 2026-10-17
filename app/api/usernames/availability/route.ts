import { z } from "zod";
import { db } from "@/lib/server/store";

const schema = z.object({ username: z.string().trim().toLowerCase().regex(/^[a-z0-9_-]{3,30}$/) });

function alternatives(username: string) {
  const base = username.slice(0, 26).replace(/[-_]+$/g, "") || "collector";
  return [...new Set([base, `${base}-1`, `${base}-2`, `${base}-3`, `${base}-4`])]
    .filter((candidate) => /^[a-z0-9_-]{3,30}$/.test(candidate));
}

export async function GET(request: Request) {
  const parsed = schema.safeParse({ username: new URL(request.url).searchParams.get("username") ?? "" });
  if (!parsed.success) return Response.json({ error: "Enter a username with 3–30 letters, numbers, dashes, or underscores." }, { status: 400 });

  try {
    const candidates = alternatives(parsed.data.username);
    const statements = candidates.flatMap((candidate) => [
      db().prepare("SELECT 1 AS taken FROM profiles WHERE username=? LIMIT 1").bind(candidate),
      db().prepare('SELECT 1 AS taken FROM "user" WHERE username=? LIMIT 1').bind(candidate),
    ]);
    const results = await db().batch<{ taken: number }>(statements);
    const available = candidates.filter((_, index) => !results[index * 2]?.results?.length && !results[index * 2 + 1]?.results?.length);
    return Response.json({ available: available.includes(parsed.data.username), suggestions: available.slice(0, 4) }, {
      headers: { "Cache-Control": "private, no-store", "Vary": "Cookie" },
    });
  } catch {
    return Response.json({ error: "Username availability could not be checked." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
