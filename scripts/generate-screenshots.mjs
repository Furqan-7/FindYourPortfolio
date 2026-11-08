/**
 * Screenshot generation pipeline.
 *
 * For every portfolio (seed list in data/portfolios.json plus community
 * submissions in the database) it captures what's missing:
 *
 *   - public/previews/<hash>.webp       1280x800 first-screen preview
 *   - public/previews/full/<hash>.webp  full-page shot (640px wide, up to
 *                                       4800 CSS px tall) used for the
 *                                       hover-to-scroll effect on the cards
 *
 * and refreshes data/preview-manifest.json + data/fullpage-manifest.json so
 * the app knows which files exist.
 *
 *   npm run previews                       # everything that's missing
 *   ONLY=example.com npm run previews      # just URLs containing "example.com"
 *   FORCE=1 ONLY=example.com npm run previews   # re-capture those
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
const FULL_DIR = path.join(PREVIEWS_DIR, "full");
const SEED_FILE = path.join(ROOT, "data", "portfolios.json");
const MANIFEST_FILE = path.join(ROOT, "data", "preview-manifest.json");
const FULL_MANIFEST_FILE = path.join(ROOT, "data", "fullpage-manifest.json");
const CONCURRENCY = Number(process.env.CONCURRENCY) || 4;
const VIEWPORT = { width: 1280, height: 800 };
const FULL_MAX_HEIGHT = 4800; // CSS px (6 screens)
const FULL_SCALE = 0.5; // 1280 CSS px → 640 px wide image
const MIN_FILE_SIZE = 5120;
const ONLY = process.env.ONLY?.toLowerCase();
const FORCE = process.env.FORCE === "1";

fs.mkdirSync(FULL_DIR, { recursive: true });

const hashFor = (url) => crypto.createHash("md5").update(url.trim().toLowerCase()).digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

/** Viewport shots must be > 400x250; full-page shots must be at least ~1.3 screens tall. */
function isValid(file, kind = "viewport") {
  try {
    if (fs.statSync(file).size < MIN_FILE_SIZE) return false;
    const dims = webpSize(fs.readFileSync(file));
    if (!dims) return false;
    return kind === "full" ? dims.width >= 600 && dims.height >= 520 : dims.width > 400 && dims.height > 250;
  } catch {
    return false;
  }
}

function writeManifest(dir, file, kind) {
  const hashes = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".webp") && isValid(path.join(dir, f), kind))
    .map((f) => f.slice(0, -5))
    .sort();
  fs.writeFileSync(file, JSON.stringify(hashes) + "\n");
  return hashes.length;
}

function writeManifests() {
  const a = writeManifest(PREVIEWS_DIR, MANIFEST_FILE, "viewport");
  const b = writeManifest(FULL_DIR, FULL_MANIFEST_FILE, "full");
  console.log(`🗂  Manifests: ${a} previews, ${b} full-page. Rebuild/redeploy to serve the new screenshots.`);
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
    if (ONLY && !p.url.toLowerCase().includes(ONLY)) continue;
    const target = path.join(PREVIEWS_DIR, `${hash}.webp`);
    const fullTarget = path.join(FULL_DIR, `${hash}.webp`);
    const needViewport = FORCE || !isValid(target);
    const needFull = FORCE || !isValid(fullTarget, "full");
    if (needViewport || needFull) pending.push({ ...p, target, fullTarget, needViewport, needFull });
  }

  console.log(`📁 ${seen.size} portfolios, ${pending.length} need screenshots.`);
  if (pending.length === 0) return writeManifests();

  const executablePath = findChrome();
  if (!executablePath) {
    console.error("❌ No Chrome/Chromium found. Set CHROME_PATH to your browser executable.");
    process.exit(1);
  }
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars"],
  });

  let done = 0;
  let failed = 0;
  async function capture(task, attempt = 0) {
    const page = await browser.newPage();
    try {
      await page.setViewport(VIEWPORT);
      await page.setRequestInterception(true);
      page.on("request", (req) => (req.resourceType() === "media" ? req.abort() : req.continue()));
      await page.goto(task.url, { waitUntil: "networkidle2", timeout: 25000 }).catch(async (err) => {
        // Sites with long-polling never go idle; continue if the page rendered.
        if (!(await page.evaluate(() => document.readyState).catch(() => null))) throw err;
      });
      await sleep(1200);

      if (task.needViewport) {
        const tmp = `${task.target}.tmp`;
        await page.screenshot({ path: tmp, type: "webp", quality: 80, clip: { x: 0, y: 0, ...VIEWPORT } });
        if (!isValid(tmp)) {
          fs.rmSync(tmp, { force: true });
          throw new Error("preview failed validation");
        }
        fs.renameSync(tmp, task.target);
      }

      if (task.needFull) {
        // Scroll through the page so lazy images and scroll-triggered
        // animations render, then return to the top.
        const height = await page.evaluate(async (max) => {
          const step = Math.round(window.innerHeight * 0.7);
          for (let y = 0; y < Math.min(document.documentElement.scrollHeight, max); y += step) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 160));
          }
          window.scrollTo(0, 0);
          return document.documentElement.scrollHeight;
        }, FULL_MAX_HEIGHT);
        await sleep(800);
        if (height >= VIEWPORT.height * 1.3) {
          await page.setViewport({ ...VIEWPORT, deviceScaleFactor: FULL_SCALE });
          await sleep(300);
          const tmp = `${task.fullTarget}.tmp`;
          await page.screenshot({
            path: tmp,
            type: "webp",
            quality: 60,
            captureBeyondViewport: true,
            clip: { x: 0, y: 0, width: VIEWPORT.width, height: Math.min(height, FULL_MAX_HEIGHT) },
          });
          if (isValid(tmp, "full")) fs.renameSync(tmp, task.fullTarget);
          else fs.rmSync(tmp, { force: true });
        }
        // Single-screen sites (or ones scrolling inside their own container)
        // simply get no hover-scroll.
      }
      done++;
      console.log(`📷 [${done + failed}/${pending.length}] ${task.name}`);
    } catch (err) {
      await page.close().catch(() => {});
      if (attempt < 1) return capture(task, attempt + 1);
      failed++;
      console.error(`❌ [${done + failed}/${pending.length}] ${task.name} (${task.url}): ${err.message}`);
      return;
    }
    await page.close().catch(() => {});
  }

  const queue = [...pending];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await capture(queue.shift());
    }),
  );
  await browser.close();

  console.log(`\n✅ ${done} done, ❌ ${failed} failed in ${((Date.now() - start) / 1000).toFixed(1)}s`);
  writeManifests();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
