"use client";

import type { Portfolio } from "@/lib/types";
import { useLike } from "./LikesProvider";
import { displayUrl } from "@/lib/format";
import { SitePreview } from "./live/SitePreview";
import { useHover } from "./PortfolioCard";

function Row({ p, last }: { p: Portfolio; last: boolean }) {
  const { counts } = useLike(p.id);
  return (
    <>
      {"  "}
      <span className="p">{"{"}</span> <span className="k">&quot;name&quot;</span>:{" "}
      <span className="s">&quot;{p.name}&quot;</span>, <span className="k">&quot;likes&quot;</span>:{" "}
      <span className="n">{counts.week}</span> <span className="p">{last ? "}" : "},"}</span>
      {"\n"}
    </>
  );
}

export function HeroPreview({
  portfolio,
  top,
  featured = false,
}: {
  portfolio: Portfolio;
  top: Portfolio[];
  featured?: boolean;
}) {
  const { hovered, handlers } = useHover();
  const rows = top.length ? top.slice(0, 3) : [portfolio];
  return (
    <div className="ide-card">
      <div className="ide-titlebar">
        <span className="ide-dot" />
        <span className="ide-dot" />
        <span className="ide-dot" />
        <span className="ide-tab">rankings.json</span>
        <span className="ide-tab ide-tab-active">{featured ? "featured" : "live-preview"}</span>
      </div>
      <a
        className="hero-preview-container"
        href={portfolio.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Visit ${portfolio.name}'s portfolio, opens in a new tab`}
        {...handlers}
      >
        <SitePreview portfolio={portfolio} hovered={hovered} priority />
        <span className="live-chip">
          {featured ? `★ Featured · ${portfolio.name} · ` : ""}
          {displayUrl(portfolio.url)} ↗
        </span>
      </a>
      <pre className="ide-pane">
        <span className="p">[</span>
        {"\n"}
        {rows.map((p, i) => (
          <Row key={p.id} p={p} last={i === rows.length - 1} />
        ))}
        <span className="p">]</span>
      </pre>
      <div className="ide-pipeline">
        <span className="pill pill-read">Fetched</span>
        <span className="pill pill-grep">Ranked</span>
        <span className="pill pill-done">Live</span>
      </div>
    </div>
  );
}
