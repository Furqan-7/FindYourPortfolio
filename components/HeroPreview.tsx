"use client";

import type { Portfolio } from "@/lib/types";
import { PreviewImage } from "./PreviewImage";
import { usePreview } from "./PreviewProvider";
import { useLike } from "./LikesProvider";
import { displayUrl } from "@/lib/format";

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

export function HeroPreview({ portfolio, top }: { portfolio: Portfolio; top: Portfolio[] }) {
  const { open, prefetch } = usePreview();
  const rows = top.length ? top.slice(0, 3) : [portfolio];
  return (
    <div className="ide-card">
      <div className="ide-titlebar">
        <span className="ide-dot" />
        <span className="ide-dot" />
        <span className="ide-dot" />
        <span className="ide-tab">rankings.json</span>
        <span className="ide-tab ide-tab-active">live-preview</span>
      </div>
      <button
        type="button"
        className="hero-preview-container"
        onClick={() => open(portfolio, top.length ? top : undefined)}
        onPointerEnter={() => prefetch(portfolio)}
        aria-label={`Open live preview of ${portfolio.name}'s portfolio`}
      >
        <PreviewImage name={portfolio.name} url={portfolio.url} preview={portfolio.preview} priority />
        <span className="live-chip">▶ Live preview · {displayUrl(portfolio.url)}</span>
      </button>
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
