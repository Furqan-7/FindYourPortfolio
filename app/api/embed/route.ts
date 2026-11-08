import { NextResponse } from "next/server";
import { getPortfolioRecords, saveFrameable } from "@/lib/portfolios";
import { checkFrameable } from "@/lib/embed";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const MAX_IDS = 12;

/**
 * GET /api/embed?ids=1,2,3 — whether each portfolio can be shown in a live
 * iframe. Cached answers come straight from the database; unknown ones are
 * checked in parallel (each with its own timeout) and saved for a week.
 *
 * Responds with { statuses: { [id]: true | false | null } } where null means
 * the site could not be checked right now.
 */
export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("ids") ?? "";
  const ids = [...new Set(raw.split(",").map(Number))].filter((n) => Number.isInteger(n) && n > 0).slice(0, MAX_IDS);
  if (ids.length === 0) return NextResponse.json({ error: "ids is required" }, { status: 400 });

  const records = await getPortfolioRecords(ids);
  const statuses: Record<number, boolean | null> = {};
  const unknown = records.filter((r) => {
    if (r.frameable !== null) statuses[r.id] = r.frameable;
    return r.frameable === null;
  });

  if (unknown.length > 0) {
    // Only fresh checks cost outbound requests, so only they are rate limited.
    const limit = rateLimit(`embed:${await clientIp()}`, 120, 60 * 1000);
    if (!limit.ok) {
      for (const r of unknown) statuses[r.id] = null;
    } else {
      await Promise.all(
        unknown.map(async (r) => {
          try {
            const frameable = await checkFrameable(r.url);
            await saveFrameable(r.id, frameable);
            statuses[r.id] = frameable;
          } catch {
            statuses[r.id] = null;
          }
        }),
      );
    }
  }

  const allKnown = Object.values(statuses).every((v) => v !== null);
  return NextResponse.json(
    { statuses },
    { headers: { "Cache-Control": allKnown ? "public, max-age=3600, s-maxage=86400" : "no-store" } },
  );
}
