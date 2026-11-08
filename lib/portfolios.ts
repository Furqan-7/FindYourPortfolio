import "server-only";
import type { Row } from "@libsql/client";
import { getDb } from "./db";
import { localPreviewFor } from "./previews";
import { urlKey } from "./url";
import { PERIODS, type LikeCounts, type Period, type PortfolioWithCounts, type RankedPortfolio } from "./types";

const DAY = 24 * 60 * 60 * 1000;

function windowStart(period: Exclude<Period, "all">, now = Date.now()) {
  return now - (PERIODS[period].days as number) * DAY;
}

/** Aggregated like counts per portfolio for the rolling week / year windows. */
const COUNTS_CTE = `
  WITH c AS (
    SELECT portfolio_id,
           COUNT(*) AS total,
           SUM(CASE WHEN created_at >= :week THEN 1 ELSE 0 END) AS week,
           SUM(CASE WHEN created_at >= :year THEN 1 ELSE 0 END) AS year,
           MAX(created_at) AS last_like
      FROM likes
     GROUP BY portfolio_id
  )`;

const SELECT_COLUMNS = `
  p.id, p.name, p.url, p.tagline, p.source, p.created_at,
  COALESCE(c.total, 0) AS total,
  COALESCE(c.week, 0) AS week,
  COALESCE(c.year, 0) AS year`;

function windowArgs() {
  const now = Date.now();
  return { week: windowStart("week", now), year: windowStart("year", now) };
}

function toPortfolio(r: Row): PortfolioWithCounts {
  const url = String(r.url);
  return {
    id: Number(r.id),
    name: String(r.name),
    url,
    tagline: String(r.tagline ?? ""),
    preview: localPreviewFor(url),
    isCommunity: r.source === "community",
    createdAt: Number(r.created_at),
    likes: { total: Number(r.total ?? 0), week: Number(r.week ?? 0), year: Number(r.year ?? 0) },
  };
}

/** Every approved portfolio with its like counts, sorted by name. */
export async function listPortfolios(): Promise<PortfolioWithCounts[]> {
  const db = await getDb();
  const res = await db.execute({
    sql: `${COUNTS_CTE}
          SELECT ${SELECT_COLUMNS}
            FROM portfolios p LEFT JOIN c ON c.portfolio_id = p.id
           WHERE p.status = 'approved'
           ORDER BY p.name COLLATE NOCASE, p.id`,
    args: windowArgs(),
  });
  return res.rows.map(toPortfolio);
}

/** Top portfolios by likes received inside the given window. */
export async function getRanking(period: Period, limit = 50): Promise<RankedPortfolio[]> {
  const db = await getDb();
  const scoreCol = period === "all" ? "c.total" : `c.${period}`;
  const res = await db.execute({
    sql: `${COUNTS_CTE}
          SELECT ${SELECT_COLUMNS}
            FROM portfolios p JOIN c ON c.portfolio_id = p.id
           WHERE p.status = 'approved' AND ${scoreCol} > 0
           ORDER BY ${scoreCol} DESC, c.total DESC, c.last_like DESC, p.name COLLATE NOCASE
           LIMIT :limit`,
    args: { ...windowArgs(), limit },
  });
  return res.rows.map((r, i) => {
    const p = toPortfolio(r);
    const score = period === "all" ? p.likes.total : p.likes[period];
    return { ...p, rank: i + 1, score };
  });
}

export async function likedPortfolioIds(voterId: string | null): Promise<number[]> {
  if (!voterId) return [];
  const db = await getDb();
  const res = await db.execute({ sql: "SELECT portfolio_id FROM likes WHERE voter_id = ?", args: [voterId] });
  return res.rows.map((r) => Number(r.portfolio_id));
}

export async function getLikeCounts(portfolioId: number): Promise<LikeCounts> {
  const db = await getDb();
  const { week, year } = windowArgs();
  const res = await db.execute({
    sql: `SELECT COUNT(*) AS total,
                 COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS week,
                 COALESCE(SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END), 0) AS year
            FROM likes WHERE portfolio_id = ?`,
    args: [week, year, portfolioId],
  });
  const r = res.rows[0];
  return { total: Number(r?.total ?? 0), week: Number(r?.week ?? 0), year: Number(r?.year ?? 0) };
}

export type PortfolioRecord = {
  id: number;
  url: string;
  status: string;
  frameable: boolean | null;
  frameCheckedAt: number | null;
};

export async function getPortfolioRecord(id: number): Promise<PortfolioRecord | null> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, url, status, frameable, frame_checked_at FROM portfolios WHERE id = ?",
    args: [id],
  });
  const r = res.rows[0];
  if (!r) return null;
  return {
    id: Number(r.id),
    url: String(r.url),
    status: String(r.status),
    frameable: r.frameable === null ? null : Number(r.frameable) === 1,
    frameCheckedAt: r.frame_checked_at === null ? null : Number(r.frame_checked_at),
  };
}

export async function saveFrameable(id: number, frameable: boolean) {
  const db = await getDb();
  await db.execute({
    sql: "UPDATE portfolios SET frameable = ?, frame_checked_at = ? WHERE id = ?",
    args: [frameable ? 1 : 0, Date.now(), id],
  });
}

/**
 * Sets the visitor's like to an explicit state. Idempotent: repeating the same
 * request (double clicks, retries) can never double count.
 */
export async function setLike(portfolioId: number, voterId: string, liked: boolean): Promise<LikeCounts> {
  const db = await getDb();
  if (liked) {
    await db.execute({
      sql: "INSERT OR IGNORE INTO likes (portfolio_id, voter_id, created_at) VALUES (?, ?, ?)",
      args: [portfolioId, voterId, Date.now()],
    });
  } else {
    await db.execute({
      sql: "DELETE FROM likes WHERE portfolio_id = ? AND voter_id = ?",
      args: [portfolioId, voterId],
    });
  }
  return getLikeCounts(portfolioId);
}

export async function findByUrl(url: string) {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT id, name, status FROM portfolios WHERE url_key = ?",
    args: [urlKey(url)],
  });
  const r = res.rows[0];
  return r ? { id: Number(r.id), name: String(r.name), status: String(r.status) } : null;
}

export async function countSubmissionsSince(voterId: string, since: number): Promise<number> {
  const db = await getDb();
  const res = await db.execute({
    sql: "SELECT COUNT(*) AS n FROM portfolios WHERE submitted_by = ? AND created_at >= ?",
    args: [voterId, since],
  });
  return Number(res.rows[0]?.n ?? 0);
}

export async function createPortfolio(input: {
  name: string;
  url: string;
  tagline: string;
  submittedBy: string;
}): Promise<{ portfolio: PortfolioWithCounts; status: string }> {
  const db = await getDb();
  const status = process.env.SUBMISSIONS_REQUIRE_REVIEW === "true" ? "pending" : "approved";
  const now = Date.now();
  const res = await db.execute({
    sql: `INSERT INTO portfolios (name, url, url_key, tagline, source, status, submitted_by, created_at)
          VALUES (?, ?, ?, ?, 'community', ?, ?, ?)
          RETURNING id, name, url, tagline, source, created_at`,
    args: [input.name, input.url, urlKey(input.url), input.tagline, status, input.submittedBy, now],
  });
  return { portfolio: toPortfolio(res.rows[0]), status };
}
