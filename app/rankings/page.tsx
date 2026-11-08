import type { Metadata } from "next";
import Link from "next/link";
import { getRanking, likedPortfolioIds } from "@/lib/portfolios";
import { readVoterId } from "@/lib/voter";
import { PERIODS, isPeriod, type LikeCounts, type Period } from "@/lib/types";
import { LikesProvider } from "@/components/LikesProvider";
import { PreviewProvider } from "@/components/PreviewProvider";
import { RankingList } from "@/components/RankingList";

export const metadata: Metadata = {
  title: "Rankings",
  description: "The most liked developer portfolios this week, this year and of all time.",
};

const DESCRIPTIONS: Record<Period, string> = {
  week: "Portfolios that collected the most likes over the last 7 days.",
  year: "Portfolios that collected the most likes over the last 12 months.",
  all: "The most liked portfolios since the directory began.",
};

export default async function RankingsPage({ searchParams }: PageProps<"/rankings">) {
  const sp = await searchParams;
  const period: Period = isPeriod(sp.period) ? sp.period : "week";
  const [ranking, likedIds] = await Promise.all([getRanking(period, 50), readVoterId().then(likedPortfolioIds)]);

  const counts: Record<number, LikeCounts> = {};
  for (const p of ranking) counts[p.id] = p.likes;

  return (
    <LikesProvider key={period} counts={counts} likedIds={likedIds}>
      <PreviewProvider>
        <main className="page">
          <header className="page-head">
            <p className="eyebrow">Rankings</p>
            <h1>{PERIODS[period].title}</h1>
            <p className="lede">{DESCRIPTIONS[period]} Like a portfolio to push it up the board.</p>
            <nav className="period-tabs" aria-label="Ranking period">
              {(Object.keys(PERIODS) as Period[]).map((key) => (
                <Link
                  key={key}
                  href={key === "week" ? "/rankings" : `/rankings?period=${key}`}
                  className={`period-tab${period === key ? " active" : ""}`}
                  aria-current={period === key ? "page" : undefined}
                  scroll={false}
                >
                  {PERIODS[key].label}
                </Link>
              ))}
            </nav>
          </header>

          {ranking.length > 0 ? (
            <RankingList ranking={ranking.map(({ likes: _likes, ...p }) => p)} period={period} />
          ) : (
            <div className="empty-state">
              <strong>No likes {period === "all" ? "yet" : `in this period yet`}</strong>
              Head to the <Link href="/#browse">directory</Link> and like the portfolios you love.
            </div>
          )}
        </main>
      </PreviewProvider>
    </LikesProvider>
  );
}
