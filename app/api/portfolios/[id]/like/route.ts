import { NextResponse } from "next/server";
import { getLikeCounts, getPortfolioRecord, setLike } from "@/lib/portfolios";
import { ensureVoterId, readVoterId } from "@/lib/voter";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { getDb } from "@/lib/db";

async function parseId(params: Promise<{ id: string }>) {
  const id = Number((await params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** GET — current counts and whether this visitor liked the portfolio. */
export async function GET(_req: Request, ctx: RouteContext<"/api/portfolios/[id]/like">) {
  const id = await parseId(ctx.params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  const voterId = await readVoterId();
  const db = await getDb();
  const [likes, mine] = await Promise.all([
    getLikeCounts(id),
    voterId
      ? db.execute({ sql: "SELECT 1 FROM likes WHERE portfolio_id = ? AND voter_id = ?", args: [id, voterId] })
      : null,
  ]);
  return NextResponse.json({ liked: Boolean(mine?.rows.length), likes }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * POST { liked: boolean } — set this visitor's like to an explicit state.
 * Responds with the authoritative counts so the UI can reconcile.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/portfolios/[id]/like">) {
  const id = await parseId(ctx.params);
  if (!id) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const ip = await clientIp();
  const limit = rateLimit(`like:${ip}`, 60, 60 * 1000);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "You're liking too fast — take a breath and try again." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  let liked: unknown;
  try {
    ({ liked } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof liked !== "boolean") {
    return NextResponse.json({ error: "`liked` must be a boolean." }, { status: 400 });
  }

  const portfolio = await getPortfolioRecord(id);
  if (!portfolio || portfolio.status !== "approved") {
    return NextResponse.json({ error: "Portfolio not found." }, { status: 404 });
  }

  const voterId = await ensureVoterId();
  const likes = await setLike(id, voterId, liked);
  return NextResponse.json({ liked, likes }, { headers: { "Cache-Control": "no-store" } });
}
