import "server-only";
import { urlKey } from "./url";
import type { Portfolio } from "./types";

/**
 * The portfolio showcased in the home page hero. Override with the
 * FEATURED_PORTFOLIO_URL environment variable.
 */
export const FEATURED_PORTFOLIO_URL = process.env.FEATURED_PORTFOLIO_URL || "https://furqan7.dev";

export function findFeatured<T extends Portfolio>(portfolios: T[]): T | undefined {
  const key = urlKey(FEATURED_PORTFOLIO_URL);
  return portfolios.find((p) => urlKey(p.url) === key);
}
