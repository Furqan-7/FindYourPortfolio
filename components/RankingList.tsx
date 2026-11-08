"use client";

import type { Period, Portfolio } from "@/lib/types";
import { PERIODS } from "@/lib/types";
import { displayUrl, formatCount } from "@/lib/format";
import { useLike } from "./LikesProvider";
import { LikeButton } from "./LikeButton";
import { PreviewImage } from "./PreviewImage";
import { usePreview } from "./PreviewProvider";
import { EyeIcon } from "./Icons";
import { LiveFrame } from "./live/LiveFrame";

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

function PodiumCard({ p, period, list }: { p: Ranked; period: Period; list: Portfolio[] }) {
  const { open, prefetch } = usePreview();
  return (
    <article className={`podium-card podium-${p.rank}`}>
      <button
        type="button"
        className="podium-preview"
        onClick={() => open(p, list)}
        onPointerEnter={() => prefetch(p)}
        aria-label={`Open live preview of ${p.name}'s portfolio`}
      >
        <span className={`rank-badge rank-${p.rank}`}>#{p.rank}</span>
        <PreviewImage name={p.name} url={p.url} preview={p.preview} priority>
          <LiveFrame portfolio={p} />
        </PreviewImage>
        <span className="live-chip" aria-hidden="true">
          <EyeIcon width={14} height={14} /> Open full preview
        </span>
      </button>
      <div className="podium-body">
        <div className="podium-text">
          <a className="podium-name" href={p.url} target="_blank" rel="noopener noreferrer">
            {p.name}
          </a>
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

function Row({ p, period, list }: { p: Ranked; period: Period; list: Portfolio[] }) {
  const { open, prefetch } = usePreview();
  return (
    <li className="rank-row">
      <span className="rank-num">{p.rank}</span>
      <button
        type="button"
        className="rank-thumb"
        onClick={() => open(p, list)}
        onPointerEnter={() => prefetch(p)}
        aria-label={`Open live preview of ${p.name}'s portfolio`}
      >
        <PreviewImage name={p.name} url={p.url} preview={p.preview} />
      </button>
      <div className="rank-text">
        <a href={p.url} target="_blank" rel="noopener noreferrer" className="rank-name">
          {p.name}
        </a>
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
          <PodiumCard key={p.id} p={p} period={period} list={ranking} />
        ))}
      </div>
      {rest.length > 0 && (
        <ol className="rank-list" start={4}>
          {rest.map((p) => (
            <Row key={p.id} p={p} period={period} list={ranking} />
          ))}
        </ol>
      )}
    </section>
  );
}
