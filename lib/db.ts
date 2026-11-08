import "server-only";
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";
import seedPortfolios from "@/data/portfolios.json";
import legacyLikes from "@/data/legacy-likes.json";
import { urlKey } from "./url";

/**
 * Database layer.
 *
 * - **Postgres / Neon** — when `DATABASE_URL` (or `POSTGRES_URL`) is a
 *   `postgres://` URL. Neon hosts use Neon's serverless HTTP driver (ideal on
 *   Vercel: no connection pool to manage); any other Postgres uses `pg`.
 * - **SQLite / libSQL** — the default. A local file at `data/app.db`, so the
 *   app runs with zero external services in development. A `libsql://` URL
 *   (Turso) also works.
 *
 * Queries are written once with `?` placeholders in SQL that both engines
 * understand; the Postgres adapter rewrites them to `$1, $2, …`.
 */

export type Dialect = "sqlite" | "postgres";
export type DbRow = Record<string, unknown>;
export type Statement = { sql: string; args?: unknown[] };

export interface Db {
  dialect: Dialect;
  query(sql: string, args?: unknown[]): Promise<DbRow[]>;
  /** Runs statements atomically (one transaction, one round trip where possible). */
  batch(statements: Statement[]): Promise<void>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function configuredUrl(): string | undefined {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || undefined;
}

function isPostgresUrl(url: string) {
  return /^postgres(ql)?:\/\//i.test(url);
}

function sqliteUrl(): string {
  const url = configuredUrl();
  if (url) return url;
  // Serverless platforms only allow writes to /tmp, and that data does not
  // survive cold starts — configure DATABASE_URL (e.g. Neon) in production.
  if (process.env.VERCEL) {
    console.warn("[db] DATABASE_URL is not set; using a temporary SQLite file. Data will not persist.");
    return "file:/tmp/findyourportfolio.db";
  }
  const dir = path.join(process.cwd(), "data");
  mkdirSync(dir, { recursive: true });
  return `file:${path.join(dir, "app.db")}`;
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/** Rewrites `?` placeholders to `$1, $2, …` (skipping quoted strings). */
export function toPostgresPlaceholders(sql: string): string {
  let out = "";
  let n = 0;
  let quote: string | null = null;
  for (const ch of sql) {
    if (quote) {
      if (ch === quote) quote = null;
      out += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      out += ch;
    } else if (ch === "?") {
      out += `$${++n}`;
    } else {
      out += ch;
    }
  }
  return out;
}

async function createSqliteDb(): Promise<Db> {
  const { createClient } = await import("@libsql/client");
  const url = sqliteUrl();
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  if (url.startsWith("file:")) {
    await client.execute("PRAGMA journal_mode = WAL");
    await client.execute("PRAGMA busy_timeout = 5000");
  }
  await client.execute("PRAGMA foreign_keys = ON");
  return {
    dialect: "sqlite",
    async query(sql, args = []) {
      const res = await client.execute({ sql, args: args as never });
      return res.rows as unknown as DbRow[];
    },
    async batch(statements) {
      await client.batch(
        statements.map((s) => ({ sql: s.sql, args: (s.args ?? []) as never })),
        "write",
      );
    },
  };
}

async function createNeonDb(url: string): Promise<Db> {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(url);
  return {
    dialect: "postgres",
    async query(text, args = []) {
      return (await sql.query(toPostgresPlaceholders(text), args)) as DbRow[];
    },
    async batch(statements) {
      await sql.transaction(statements.map((s) => sql.query(toPostgresPlaceholders(s.sql), s.args ?? [])));
    },
  };
}

async function createPgDb(url: string): Promise<Db> {
  const { Pool } = (await import("pg")).default;
  const pool = new Pool({ connectionString: url, max: 5 });
  return {
    dialect: "postgres",
    async query(text, args = []) {
      return (await pool.query(toPostgresPlaceholders(text), args)).rows as DbRow[];
    },
    async batch(statements) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const s of statements) await client.query(toPostgresPlaceholders(s.sql), s.args ?? []);
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
  };
}

async function connect(): Promise<Db> {
  const url = configuredUrl();
  if (url && isPostgresUrl(url)) {
    const host = new URL(url).hostname;
    const useNeon = process.env.DATABASE_DRIVER
      ? process.env.DATABASE_DRIVER === "neon"
      : host.endsWith(".neon.tech") || host.endsWith(".neon.build");
    return useNeon ? createNeonDb(url) : createPgDb(url);
  }
  return createSqliteDb();
}

// ---------------------------------------------------------------------------
// Schema & seed
// ---------------------------------------------------------------------------

const SQLITE_SCHEMA = [
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
  `CREATE TABLE IF NOT EXISTS likes (
     portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
     voter_id TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     PRIMARY KEY (portfolio_id, voter_id)
   )`,
];

const POSTGRES_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS portfolios (
     id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
     name TEXT NOT NULL,
     url TEXT NOT NULL,
     url_key TEXT NOT NULL UNIQUE,
     tagline TEXT NOT NULL DEFAULT '',
     source TEXT NOT NULL DEFAULT 'seed',
     status TEXT NOT NULL DEFAULT 'approved',
     submitted_by TEXT,
     frameable SMALLINT,
     frame_checked_at BIGINT,
     created_at BIGINT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS likes (
     portfolio_id INTEGER NOT NULL REFERENCES portfolios(id) ON DELETE CASCADE,
     voter_id TEXT NOT NULL,
     created_at BIGINT NOT NULL,
     PRIMARY KEY (portfolio_id, voter_id)
   )`,
];

const SHARED_SCHEMA = [
  `CREATE INDEX IF NOT EXISTS portfolios_status_idx ON portfolios(status)`,
  `CREATE INDEX IF NOT EXISTS portfolios_submitted_by_idx ON portfolios(submitted_by, created_at)`,
  `CREATE INDEX IF NOT EXISTS likes_created_idx ON likes(created_at, portfolio_id)`,
  `CREATE INDEX IF NOT EXISTS likes_voter_idx ON likes(voter_id)`,
  `CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
];

// Serialises concurrent cold starts on Postgres (several serverless
// instances may boot at once). Released automatically at commit.
const PG_MIGRATION_LOCK = "SELECT pg_advisory_xact_lock(727274001)";

// Likes carried over from the old likes.json; dated to the release that
// introduced likes so they count for "year" / "all time" but not "week".
const LEGACY_LIKES_AT = Date.parse("2026-07-30T15:00:00Z");

type Seed = { name: string; url: string; tagline?: string };

function seedHash(): string {
  return createHash("sha1").update(JSON.stringify(seedPortfolios)).update(JSON.stringify(legacyLikes)).digest("hex");
}

function seedRows() {
  return (seedPortfolios as Seed[]).map((p, i) => ({
    name: p.name.trim(),
    url: p.url.trim(),
    key: urlKey(p.url),
    tagline: (p.tagline ?? "").trim(),
    // Keep seed rows ordered and older than any community submission.
    createdAt: LEGACY_LIKES_AT - 1_000_000 + i,
  }));
}

async function migrate(db: Db) {
  const pg = db.dialect === "postgres";
  const schema = [...(pg ? POSTGRES_SCHEMA : SQLITE_SCHEMA), ...SHARED_SCHEMA].map((sql) => ({ sql }));
  await db.batch(pg ? [{ sql: PG_MIGRATION_LOCK }, ...schema] : schema);

  // Sync the bundled seed list into the database whenever it changes.
  // ON CONFLICT DO NOTHING keeps this idempotent and safe under concurrent boots.
  const hash = seedHash();
  const current = await db.query("SELECT value FROM meta WHERE key = 'seed_hash'");
  if (current[0]?.value === hash) return;

  const started = Date.now();
  const rows = seedRows();
  const stmts: Statement[] = [];
  if (pg) {
    stmts.push({ sql: PG_MIGRATION_LOCK });
    // One set-based insert instead of ~1,600 round trips.
    stmts.push({
      sql: `INSERT INTO portfolios (name, url, url_key, tagline, source, created_at)
            SELECT n, u, k, t, 'seed', c
              FROM unnest(?::text[], ?::text[], ?::text[], ?::text[], ?::bigint[]) AS s(n, u, k, t, c)
            ON CONFLICT (url_key) DO NOTHING`,
      args: [
        rows.map((r) => r.name),
        rows.map((r) => r.url),
        rows.map((r) => r.key),
        rows.map((r) => r.tagline),
        rows.map((r) => r.createdAt),
      ],
    });
  } else {
    for (const r of rows) {
      stmts.push({
        sql: `INSERT INTO portfolios (name, url, url_key, tagline, source, created_at)
              VALUES (?, ?, ?, ?, 'seed', ?) ON CONFLICT (url_key) DO NOTHING`,
        args: [r.name, r.url, r.key, r.tagline, r.createdAt],
      });
    }
  }
  for (const [url, count] of Object.entries(legacyLikes as Record<string, number>)) {
    for (let n = 0; n < count; n++) {
      stmts.push({
        sql: `INSERT INTO likes (portfolio_id, voter_id, created_at)
              SELECT id, CAST(? AS TEXT), CAST(? AS BIGINT) FROM portfolios WHERE url_key = ?
              ON CONFLICT DO NOTHING`,
        args: [`legacy-${n}`, LEGACY_LIKES_AT, urlKey(url)],
      });
    }
  }
  stmts.push({
    sql: "INSERT INTO meta (key, value) VALUES ('seed_hash', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value",
    args: [hash],
  });
  await db.batch(stmts);
  console.log(`[db] synced ${rows.length} seed portfolios (${db.dialect}) in ${Date.now() - started}ms`);
}

// ---------------------------------------------------------------------------

const globalForDb = globalThis as unknown as { __fypDb?: Promise<Db> };

/** Returns a connected, migrated and seeded database. */
export function getDb(): Promise<Db> {
  if (!globalForDb.__fypDb) {
    globalForDb.__fypDb = (async () => {
      const db = await connect();
      await migrate(db);
      return db;
    })().catch((err) => {
      globalForDb.__fypDb = undefined;
      throw err;
    });
  }
  return globalForDb.__fypDb;
}
