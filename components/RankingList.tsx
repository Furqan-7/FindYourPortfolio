"use client";

import type { Period, Portfolio } from "@/lib/types";
import { PERIODS } from "@/lib/types";
import { displayUrl, formatCount } from "@/lib/format";
import { useLike } from "./LikesProvider";
import { LikeButton } from "./LikeButton";
import { PreviewImage } from "./PreviewImage";
import { ExternalIcon } from "./Icons";
import { SitePreview } from "./live/SitePreview";
import { useHover } from "./PortfolioCard";

type Ranked = Portfolio & { rank: number; score: number };

function Score({ id, period }: { id: number; period: Period }) {
  const { counts } = useLike(id);
  const value = period === "all" ? counts.total : counts[period];
  return (
    <span className="rank-score">
      <strong>{formatCount(value)}</strong>
      <span>{value === 1 ? "like" : "likes"}</span>
    </span>
  );
}

function PodiumCard({ p, period }: { p: Ranked; period: Period }) {
  const { hovered, handlers } = useHover();
  return (
    <article className={`podium-card podium-${p.rank}`} {...handlers}>
      <a
        className="card-link"
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${p.name}'s portfolio, opens in a new tab`}
      />
      <div className="podium-preview">
        <span className={`rank-badge rank-${p.rank}`}>#{p.rank}</span>
        <SitePreview portfolio={p} hovered={hovered} priority />
        <span className="visit-chip" aria-hidden="true">
          Visit site <ExternalIcon width={13} height={13} />
        </span>
      </div>
      <div className="podium-body">
        <div className="podium-text">
          <span className="podium-name">{p.name}</span>
          <span className="podium-tagline">{p.tagline || displayUrl(p.url)}</span>
        </div>
        <div className="podium-meta">
          <Score id={p.id} period={period} />
          <LikeButton id={p.id} name={p.name} size="md" />
        </div>
      </div>
    </article>
  );
}

function Row({ p, period }: { p: Ranked; period: Period }) {
  return (
    <li className="rank-row">
      <a
        className="card-link"
        href={p.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${p.name}'s portfolio, opens in a new tab`}
      />
      <span className="rank-num">{p.rank}</span>
      <span className="rank-thumb">
        <PreviewImage name={p.name} url={p.url} preview={p.preview} />
      </span>
      <div className="rank-text">
        <span className="rank-name">{p.name}</span>
        <span className="rank-tagline">{p.tagline || displayUrl(p.url)}</span>
      </div>
      <Score id={p.id} period={period} />
      <LikeButton id={p.id} name={p.name} />
    </li>
  );
}

export function RankingList({ ranking, period }: { ranking: Ranked[]; period: Period }) {
  const podium = ranking.slice(0, 3);
  const rest = ranking.slice(3);
  return (
    <section aria-label={PERIODS[period].title}>
      <div className="podium">
        {podium.map((p) => (
          <PodiumCard key={p.id} p={p} period={period} />
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="rank-list" start={4}>
          {rest.map((p) => (
            <Row key={p.id} p={p} period={period} />
          ))}
        </ol>
      )}
    </section>
  );
}
