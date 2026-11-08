import { NextResponse } from "next/server";
import { getPortfolioRecord, saveFrameable } from "@/lib/portfolios";
import { checkFrameable } from "@/lib/embed";

const RECHECK_AFTER = 7 * 24 * 60 * 60 * 1000;

/**
 * GET — whether the portfolio can be shown in the live-preview iframe.
 * Results are cached in the database for a week.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/portfolios/[id]/embed">) {
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  const record = await getPortfolioRecord(id);
  if (!record || record.status !== "approved") return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cacheHeaders = { "Cache-Control": "public, max-age=3600, s-maxage=86400" };
  if (record.frameable !== null && record.frameCheckedAt && Date.now() - record.frameCheckedAt < RECHECK_AFTER) {
    return NextResponse.json({ frameable: record.frameable, cached: true }, { headers: cacheHeaders });
  }

  try {
    const frameable = await checkFrameable(record.url);
    await saveFrameable(id, frameable);
    return NextResponse.json({ frameable, cached: false }, { headers: cacheHeaders });
  } catch {
    // Unreachable or timed out: let the browser try the iframe anyway.
    return NextResponse.json({ frameable: null }, { headers: { "Cache-Control": "no-store" } });
  }
}
