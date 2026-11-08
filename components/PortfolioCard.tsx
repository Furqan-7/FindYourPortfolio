"use client";

import { memo, useState } from "react";
import type { Portfolio } from "@/lib/types";
import { displayUrl } from "@/lib/format";
import { LikeButton } from "./LikeButton";
import { ExternalIcon } from "./Icons";
import { SitePreview } from "./live/SitePreview";

const NEW_FOR = 14 * 24 * 60 * 60 * 1000;

/** Hover (or keyboard focus) state for cards that react to the pointer resting on them. */
export function useHover() {
  const [hovered, setHovered] = useState(false);
  return {
    hovered,
    handlers: {
      onPointerEnter: (e: React.PointerEvent) => e.pointerType === "mouse" && setHovered(true),
      onPointerLeave: () => setHovered(false),
      onFocus: () => setHovered(true),
      onBlur: () => setHovered(false),
    },
  };
}

export const PortfolioCard = memo(function PortfolioCard({
  portfolio,
  priority = false,
  badge,
}: {
  portfolio: Portfolio;
  priority?: boolean;
  badge?: React.ReactNode;
}) {
  const { hovered, handlers } = useHover();
  const [live, setLive] = useState(false);
  const isNew = portfolio.isCommunity && Date.now() - portfolio.createdAt < NEW_FOR;

  return (
    <article className="card" {...handlers}>
      {/* The whole card opens the portfolio; the like button sits above this link. */}
      <a
        className="card-link"
        href={portfolio.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${portfolio.name}'s portfolio (${displayUrl(portfolio.url)}), opens in a new tab`}
      />
      <div className="card-preview">
        <div className="preview-chrome" aria-hidden="true">
          <span className="ide-dot" />
          <span className="ide-dot" />
          <span className="ide-dot" />
          {live && <span className="live-dot">Live</span>}
          <span className="chrome-url">{displayUrl(portfolio.url)}</span>
          {badge}
        </div>
        <SitePreview portfolio={portfolio} hovered={hovered} priority={priority} onLiveChange={setLive} />
        <span className="visit-chip" aria-hidden="true">
          Visit site <ExternalIcon width={13} height={13} />
        </span>
      </div>
      <div className="card-body">
        <p className="card-name">
          <span className="card-name-text">{portfolio.name}</span>
          {isNew && <span className="new-badge">New</span>}
        </p>
        <p className="card-tagline">{portfolio.tagline || " "}</p>
        <div className="card-footer-row">
          <span className="card-url">{displayUrl(portfolio.url)}</span>
          <LikeButton id={portfolio.id} name={portfolio.name} />
        </div>
      </div>
    </article>
  );
});
