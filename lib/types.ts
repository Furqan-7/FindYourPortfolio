export type Period = "week" | "year" | "all";

export const PERIODS: Record<Period, { label: string; title: string; days: number | null }> = {
  week: { label: "This week", title: "Best of the week", days: 7 },
  year: { label: "This year", title: "Best of the year", days: 365 },
  all: { label: "All time", title: "Best of all time", days: null },
};

export type LikeCounts = { total: number; week: number; year: number };

export type Portfolio = {
  id: number;
  name: string;
  url: string;
  tagline: string;
  /** Local WebP screenshot path, or null when a remote screenshot is needed. */
  preview: string | null;
  /** Full-page screenshot scrolled through on hover, or null. */
  fullPreview: string | null;
  isCommunity: boolean;
  createdAt: number;
  /** Whether the site can be shown in an iframe; null until checked. */
  frameable: boolean | null;
};

export type PortfolioWithCounts = Portfolio & { likes: LikeCounts };

export type RankedPortfolio = PortfolioWithCounts & { rank: number; score: number };

export function isPeriod(v: unknown): v is Period {
  return v === "week" || v === "year" || v === "all";
}

export type SortMode = "az" | "liked" | "trending" | "newest";

export function isSortMode(v: unknown): v is SortMode {
  return v === "az" || v === "liked" || v === "trending" || v === "newest";
}
