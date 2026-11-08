import { NextResponse } from "next/server";
import { getRanking } from "@/lib/portfolios";
import { isPeriod } from "@/lib/types";

/** GET /api/rankings?period=week|year|all&limit=50 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") ?? "week";
  if (!isPeriod(period)) {
    return NextResponse.json({ error: "period must be week, year or all" }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
  const ranking = await getRanking(period, limit);
  return NextResponse.json(
    { period, ranking },
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=300" } },
  );
}
