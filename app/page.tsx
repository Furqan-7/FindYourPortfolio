import Link from "next/link";
import { listPortfolios, likedPortfolioIds } from "@/lib/portfolios";
import { readVoterId } from "@/lib/voter";
import { formatCount } from "@/lib/format";
import { isSortMode, type LikeCounts, type Portfolio } from "@/lib/types";
import { LikesProvider } from "@/components/LikesProvider";
import { PreviewProvider } from "@/components/PreviewProvider";
import { PortfolioBrowser } from "@/components/PortfolioBrowser";
import { PortfolioCard } from "@/components/PortfolioCard";
import { HeroPreview } from "@/components/HeroPreview";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const [all, likedIds] = await Promise.all([listPortfolios(), readVoterId().then(likedPortfolioIds)]);

  const counts: Record<number, LikeCounts> = {};
  const portfolios: Portfolio[] = all.map(({ likes, ...p }) => {
    if (likes.total > 0) counts[p.id] = likes;
    return p;
  });

  const byWeek = all
    .filter((p) => p.likes.week > 0)
    .sort((a, b) => b.likes.week - a.likes.week || b.likes.total - a.likes.total || a.name.localeCompare(b.name));
  const topWeek = byWeek.slice(0, 4).map(({ likes: _likes, ...p }) => p);
  const hero = topWeek.find((p) => p.preview) ?? portfolios.find((p) => p.preview) ?? portfolios[0];
  const total = formatCount(portfolios.length);

  const sort = isSortMode(sp.sort) ? sp.sort : "az";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";

  return (
    <LikesProvider counts={counts} likedIds={likedIds}>
      <PreviewProvider>
        <header className="hero" id="top">
          <div>
            <p className="eyebrow">Developer portfolio directory</p>
            <h1>
              Find your <em>portfolio</em>,<br />
              before you build one.
            </h1>
            <p className="lede">
              {total} real developer portfolios. Search by name or role, open a live preview in one click, vote for
              your favourites — then go build something better.
            </p>
            <div className="hero-ctas">
              <a className="btn btn-primary" href="#browse">
                Browse the collection
              </a>
              <Link className="btn btn-outline" href="/submit">
                Add your portfolio
              </Link>
              <Link className="btn btn-text" href="/rankings">
                See the rankings →
              </Link>
            </div>
          </div>
          {hero && <HeroPreview portfolio={hero} top={topWeek} />}
        </header>

        <section className="top-week" aria-labelledby="top-week-title">
          <div className="section-head">
            <div>
              <p className="eyebrow">Ranking</p>
              <h2 id="top-week-title">Best of the week</h2>
            </div>
            <Link className="btn btn-text" href="/rankings?period=week">
              Full rankings →
            </Link>
          </div>
          {topWeek.length > 0 ? (
            <div className="grid grid-top">
              {topWeek.map((p, i) => (
                <PortfolioCard
                  key={p.id}
                  portfolio={p}
                  list={topWeek}
                  priority
                  badge={<span className={`rank-badge rank-${i + 1}`}>#{i + 1} this week</span>}
                />
              ))}
            </div>
          ) : (
            <div className="empty-state empty-inline">
              <strong>No likes yet this week</strong>
              Tap the heart on portfolios you love — the most liked ones show up here.
            </div>
          )}
        </section>

        <main>
          <PortfolioBrowser portfolios={portfolios} initialSort={sort} initialQuery={q} />
        </main>
      </PreviewProvider>
    </LikesProvider>
  );
}
