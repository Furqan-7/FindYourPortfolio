/**
 * Screenshot generation pipeline.
 *
 * Captures a 1280x800 WebP preview for every portfolio that doesn't have a
 * valid one yet — seed portfolios from data/portfolios.json plus community
 * submissions stored in the database — writes them to public/previews/ and
 * refreshes data/preview-manifest.json so the app knows which exist.
 *
 *   npm run previews
 *
 * Uses puppeteer-core with a locally installed Chrome/Chromium. Set
 * CHROME_PATH if it isn't found automatically.
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const PREVIEWS_DIR = path.join(ROOT, "public", "previews");
const SEED_FILE = path.join(ROOT, "data", "portfolios.json");
const MANIFEST_FILE = path.join(ROOT, "data", "preview-manifest.json");
const CONCURRENCY = Number(process.env.CONCURRENCY) || 5;
const VIEWPORT = { width: 1280, height: 800 };
const MIN_FILE_SIZE = 5120;

fs.mkdirSync(PREVIEWS_DIR, { recursive: true });

const hashFor = (url) => crypto.createHash("md5").update(url.trim().toLowerCase()).digest("hex");

function webpSize(buf) {
  if (buf.length < 30 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buf.toString("ascii", 12, 16);
  if (chunk === "VP8 ") return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === "VP8X") return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  return null;
}

function isValid(file) {
  try {
    if (fs.statSync(file).size < MIN_FILE_SIZE) return false;
    const dims = webpSize(fs.readFileSync(file));
    return Boolean(dims && dims.width > 400 && dims.height > 250);
  } catch {
    return false;
  }
}

function writeManifest() {
  const hashes = fs
    .readdirSync(PREVIEWS_DIR)
    .filter((f) => f.endsWith(".webp") && isValid(path.join(PREVIEWS_DIR, f)))
    .map((f) => f.slice(0, -5))
    .sort();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(hashes) + "\n");
  return hashes.length;
}

async function communityUrls() {
  const query = "SELECT name, url FROM portfolios WHERE source = 'community' AND status = 'approved'";
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || `file:${path.join(ROOT, "data", "app.db")}`;
  try {
    let rows;
    if (/^postgres(ql)?:\/\//i.test(url)) {
      // Works for Neon too (direct TCP connection with sslmode=require).
      const { default: pg } = await import("pg");
      const client = new pg.Client({ connectionString: url });
      await client.connect();
      rows = (await client.query(query)).rows;
      await client.end();
    } else {
      if (url.startsWith("file:") && !fs.existsSync(url.slice(5))) return [];
      const { createClient } = await import("@libsql/client");
      const db = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
      rows = (await db.execute(query)).rows;
    }
    return rows.map((r) => ({ name: String(r.name), url: String(r.url) }));
  } catch (err) {
    console.warn(`⚠️  Could not read community submissions from the database: ${err.message}`);
    return [];
  }
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    "/opt/pw-browsers/chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
  ];
  return candidates.find((p) => p && fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}

async function main() {
  const start = Date.now();
  const seed = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  const all = [...seed, ...(await communityUrls())];
  const seen = new Set();
  const pending = [];
  for (const p of all) {
    const hash = hashFor(p.url);
    if (seen.has(hash)) continue;
    seen.add(hash);
    const target = path.join(PREVIEWS_DIR, `${hash}.webp`);
    if (!isValid(target)) pending.push({ ...p, target });
  }

  console.log(`📁 ${seen.size} portfolios, ${seen.size - pending.length} previews up to date, ${pending.length} to capture.`);
  if (pending.length === 0) {
    console.log(`🗂  Manifest: ${writeManifest()} previews.`);
    return;
  }

  const executablePath = findChrome();
  if (!executablePath) {
    console.error("❌ No Chrome/Chromium found. Set CHROME_PATH to your browser executable.");
    process.exit(1);
  }
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  let ok = 0;
  let failed = 0;
  async function capture(task, attempt = 0) {
    const page = await browser.newPage();
    try {
      await page.setViewport(VIEWPORT);
      await page.setRequestInterception(true);
      page.on("request", (req) => (["media", "font"].includes(req.resourceType()) ? req.abort() : req.continue()));
      await page.goto(task.url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1500));
      const tmp = `${task.target}.tmp`;
      await page.screenshot({ path: tmp, type: "webp", quality: 80, clip: { x: 0, y: 0, ...VIEWPORT } });
      if (!isValid(tmp)) {
        fs.rmSync(tmp, { force: true });
        throw new Error("screenshot failed validation");
      }
      fs.renameSync(tmp, task.target);
      ok++;
      console.log(`📷 [${ok + failed}/${pending.length}] ${task.name}`);
    } catch (err) {
      if (attempt < 1) return capture(task, attempt + 1);
      failed++;
      console.error(`❌ [${ok + failed}/${pending.length}] ${task.name} (${task.url}): ${err.message}`);
    } finally {
      await page.close().catch(() => {});
    }
  }

  const queue = [...pending];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await capture(queue.shift());
    }),
  );
  await browser.close();

  console.log(`\n✅ ${ok} captured, ❌ ${failed} failed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log(`🗂  Manifest: ${writeManifest()} previews. Rebuild/redeploy to serve the new screenshots.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
