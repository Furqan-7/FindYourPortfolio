"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Portfolio, SortMode } from "@/lib/types";
import { firstLetter, formatCount } from "@/lib/format";
import { PortfolioCard } from "./PortfolioCard";
import { useLikeStore } from "./LikesProvider";
import { setLivePreviews, useLivePreviewsEnabled } from "./live/liveSlots";

const SORTS: { key: SortMode; label: string }[] = [
  { key: "az", label: "A–Z" },
  { key: "liked", label: "Most liked" },
  { key: "trending", label: "Trending this week" },
  { key: "newest", label: "Newest" },
];
const LETTERS = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ", "#"];
const BATCH = 24;

export function PortfolioBrowser({
  portfolios,
  initialSort = "az",
  initialQuery = "",
}: {
  portfolios: Portfolio[];
  initialSort?: SortMode;
  initialQuery?: string;
}) {
  const store = useLikeStore();
  const liveEnabled = useLivePreviewsEnabled();
  const [query, setQuery] = useState(initialQuery);
  const [letter, setLetter] = useState("All");
  const [sort, setSort] = useState<SortMode>(initialSort);
  const [visible, setVisible] = useState(BATCH);
  const deferredQuery = useDeferredValue(query);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const present = useMemo(() => {
    const s = new Set<string>();
    for (const p of portfolios) s.add(firstLetter(p.name));
    return s;
  }, [portfolios]);

  // Like counts are read once when the sort/filter changes, so liking a card
  // updates its counter without reshuffling the grid under the cursor.
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const list = portfolios.filter((p) => {
      if (letter !== "All" && firstLetter(p.name) !== letter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.tagline.toLowerCase().includes(q) ||
        p.url.toLowerCase().includes(q)
      );
    });
    if (sort === "az") return list;
    const byName = (a: Portfolio, b: Portfolio) => a.name.localeCompare(b.name);
    if (sort === "newest") return [...list].sort((a, b) => b.createdAt - a.createdAt || byName(a, b));
    const key = sort === "liked" ? "total" : "week";
    const score = new Map(list.map((p) => [p.id, store.countsFor(p.id)]));
    return [...list].sort((a, b) => {
      const sa = score.get(a.id)!, sb = score.get(b.id)!;
      return sb[key] - sa[key] || sb.total - sa.total || byName(a, b);
    });
  }, [portfolios, deferredQuery, letter, sort, store]);

  useEffect(() => setVisible(BATCH), [deferredQuery, letter, sort]);

  // Infinite scroll.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisible((v) => Math.min(v + BATCH, filtered.length));
      },
      { rootMargin: "800px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  const shown = filtered.slice(0, visible);

  return (
    <section className="browse" id="browse" aria-label="Browse portfolios">
      <div className="browse-head">
        <div className="search-row">
          <input
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, role or URL — e.g. “full stack”, “design engineer”, “devops”…"
            aria-label="Search portfolios"
            autoComplete="off"
          />
          <span className="results-count" aria-live="polite">
            Showing {formatCount(shown.length)} of {formatCount(filtered.length)}
          </span>
        </div>
        <div className="filter-bar">
          <div className="sort-row" role="group" aria-label="Sort portfolios">
            <button
              type="button"
              role="switch"
              aria-checked={liveEnabled}
              className={`live-toggle${liveEnabled ? " on" : ""}`}
              onClick={() => setLivePreviews(!liveEnabled)}
              title="Show the real websites inside the cards instead of screenshots"
            >
              <span className="live-toggle-track" aria-hidden="true">
                <span className="live-toggle-thumb" />
              </span>
              Live previews
            </button>
            <span className="sort-divider" aria-hidden="true" />
            {SORTS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`sort-btn${sort === s.key ? " active" : ""}`}
                aria-pressed={sort === s.key}
                onClick={() => setSort(s.key)}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="alpha-row" role="group" aria-label="Filter by first letter">
            {LETTERS.map((L) => (
              <button
                key={L}
                type="button"
                className={`alpha-btn${letter === L ? " active" : ""}`}
                aria-pressed={letter === L}
                disabled={L !== "All" && !present.has(L)}
                onClick={() => setLetter(L)}
              >
                {L}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid">
        {shown.map((p, i) => (
          <PortfolioCard key={p.id} portfolio={p} priority={i < 6} />
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="empty-state">
          <strong>No matches</strong>
          Try a different name, role, or letter — or <Link href="/submit">add your portfolio</Link>.
        </div>
      )}
      <div ref={sentinelRef} className="sentinel" />
    </section>
  );
}
