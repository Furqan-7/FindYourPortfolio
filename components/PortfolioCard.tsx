"use client";

import { memo } from "react";
import type { Portfolio } from "@/lib/types";
import { displayUrl } from "@/lib/format";
import { PreviewImage } from "./PreviewImage";
import { LikeButton } from "./LikeButton";
import { EyeIcon } from "./Icons";
import { usePreview } from "./PreviewProvider";

const NEW_FOR = 14 * 24 * 60 * 60 * 1000;

export const PortfolioCard = memo(function PortfolioCard({
  portfolio,
  list,
  priority = false,
  badge,
}: {
  portfolio: Portfolio;
  /** Sibling portfolios, so the preview modal can step through them. */
  list?: Portfolio[];
  priority?: boolean;
  badge?: React.ReactNode;
}) {
  const { open, prefetch } = usePreview();
  const isNew = portfolio.isCommunity && Date.now() - portfolio.createdAt < NEW_FOR;

  return (
    <article className="card">
      <button
        type="button"
        className="card-preview"
        onClick={() => open(portfolio, list)}
        onPointerEnter={() => prefetch(portfolio)}
        onFocus={() => prefetch(portfolio)}
        aria-label={`Open live preview of ${portfolio.name}'s portfolio`}
      >
        <div className="preview-chrome" aria-hidden="true">
          <span className="ide-dot" />
          <span className="ide-dot" />
          <span className="ide-dot" />
          {badge}
        </div>
        <PreviewImage name={portfolio.name} url={portfolio.url} preview={portfolio.preview} priority={priority} />
        <span className="live-chip" aria-hidden="true">
          <EyeIcon width={14} height={14} /> Live preview
        </span>
      </button>
      <div className="card-body">
        <p className="card-name">
          <a href={portfolio.url} target="_blank" rel="noopener noreferrer">
            {portfolio.name}
          </a>
          {isNew && <span className="new-badge">New</span>}
        </p>
        <p className="card-tagline">{portfolio.tagline || " "}</p>
        <div className="card-footer-row">
          <a className="card-url" href={portfolio.url} target="_blank" rel="noopener noreferrer" tabIndex={-1}>
            {displayUrl(portfolio.url)}
          </a>
          <LikeButton id={portfolio.id} name={portfolio.name} />
        </div>
      </div>
    </article>
  );
});
