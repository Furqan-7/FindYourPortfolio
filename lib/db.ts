import "server-only";
import { createClient, type Client, type InStatement } from "@libsql/client";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import seedPortfolios from "@/data/portfolios.json";
import legacyLikes from "@/data/legacy-likes.json";
import { urlKey } from "./url";

/**
 * Embedded database.
 *
 * Uses libSQL (SQLite). By default the database is a local file at
 * `data/app.db`, so the app runs with zero external services. Point
 * `DATABASE_URL` at a hosted libSQL/Turso database (plus
 * `DATABASE_AUTH_TOKEN`) for serverless deployments where the local file
 * system is not persistent.
 */

const SCHEMA: string[] = [
  `CREATE TABLE IF NOT EXISTS portfolios (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     name TEXT NOT NULL,
     url TEXT NOT NULL,
     url_key TEXT NOT NULL UNIQUE,
     tagline TEXT NOT NULL DEFAULT '',
     source TEXT NOT NULL DEFAULT 'seed',
     status TEXT NOT NULL DEFAULT 'approved',
     submitted_by TEXT,
     frameable INTEGER,
     frame_checked_at INTEGER,
     created_at INTEGER NOT NULL
   )`,
  `CREATE INDEX IF NOT EXISTS portfolios_status_idx ON portfolios(status)`,
  `CREATE INDEX IF NOT EXISTS portfolios_submitted_by_idx ON portfolios(submitted_by, created_at)`,
  `CREATE TABLE IF NOT EXISTS likes (
     portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
     voter_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (portfolio_id, voter_id)
   )`,
  `CREATE INDEX IF NOT EXISTS likes_created_idx ON likes(created_at, portfolio_id)`,
  `CREATE INDEX IF NOT EXISTS likes_voter_idx ON likes(voter_id)`,
  `CREATE TABLE IF NOT EXISTS meta (
     key TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
];

// Seed likes carried over from the old likes.json were cast before the
// migration; date them to the release that introduced likes.
const LEGACY_LIKES_AT = Date.parse("2026-07-30T15:00:00Z");

function resolveDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  // Serverless platforms only allow writes to /tmp. Data there does not
  // survive cold starts, so configure DATABASE_URL for production.
  if (process.env.VERCEL) return "file:/tmp/findyourportfolio.db";
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "app.db")}`;
}

type Seed = { name: string; url: string; tagline?: string };

function seedHash(): string {
  return createHash("sha1")
    .update(JSON.stringify(seedPortfolios))
    .update(JSON.stringify(legacyLikes))
    .digest("hex");
}

async function migrate(client: Client) {
  const isFile = resolveDatabaseUrl().startsWith("file:");
  if (isFile) {
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute("PRAGMA foreign_keys = ON");
  await client.batch(SCHEMA, "write");

  // Sync the bundled seed list into the database whenever it changes.
  // INSERT OR IGNORE keeps this idempotent and safe under concurrent boots.
  const hash = seedHash();
  const current = await client.execute({
    sql: "SELECT value FROM meta WHERE key = 'seed_hash'",
    args: [],
  });
  if (current.rows[0]?.value === hash) return;

  const now = Date.now();
  const stmts: InStatement[] = [];
  (seedPortfolios as Seed[]).forEach((p, i) => {
    stmts.push({
      sql: `INSERT OR IGNORE INTO portfolios (name, url, url_key, tagline, source, created_at)
            VALUES (?, ?, ?, ?, 'seed', ?)`,
      // Keep seed rows ordered and older than any community submission.
      args: [p.name.trim(), p.url.trim(), urlKey(p.url), (p.tagline ?? "").trim(), LEGACY_LIKES_AT - 1_000_000 + i],
    });
  });
  for (const [url, count] of Object.entries(legacyLikes as Record<string, number>)) {
    for (let n = 0; n < count; n++) {
      stmts.push({
        sql: `INSERT OR IGNORE INTO likes (portfolio_id, voter_id, created_at)
              SELECT id, ?, ? FROM portfolios WHERE url_key = ?`,
        args: [`legacy-${n}`, LEGACY_LIKES_AT, urlKey(url)],
      });
    }
  }
  stmts.push({
    sql: "INSERT INTO meta (key, value) VALUES ('seed_hash', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: [hash],
  });
  await client.batch(stmts, "write");
  console.log(`[db] synced ${seedPortfolios.length} seed portfolios in ${Date.now() - now}ms`);
}

const globalForDb = globalThis as unknown as { __fypDb?: Promise<Client> };

/** Returns a ready-to-use, migrated and seeded database client. */
export function getDb(): Promise<Client> {
  if (!globalForDb.__fypDb) {
    globalForDb.__fypDb = (async () => {
      const client = createClient({
        url: resolveDatabaseUrl(),
        authToken: process.env.DATABASE_AUTH_TOKEN,
      });
      await migrate(client);
      return client;
    })().catch((err) => {
      globalForDb.__fypDb = undefined;
      throw err;
    });
  }
  return globalForDb.__fypDb;
}
