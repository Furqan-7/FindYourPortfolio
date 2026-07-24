/**
 * High-Performance & Verified Screenshot Generation Pipeline
 *
 * Features & Verification:
 * 1. Strict Validation: Files skipped ONLY if size > 5KB and width > 400px & height > 250px.
 * 2. Hero Section Priority: The first 20 hero portfolios are generated first.
 * 3. Concurrency Control: 5 concurrent browser tabs using Puppeteer / System Chrome.
 * 4. Automatic Retries: Retries failed page loads once.
 * 5. Failure Safety: Leaves missing previews uncreated on failure so frontend shows clean initials fallback.
 * 6. Detailed Performance Report: Logs total portfolios, generated, failed, skipped, and total elapsed time.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CONCURRENCY_LIMIT = 5;
const PREVIEWS_DIR = path.join(__dirname, 'previews');
const DATA_FILE = path.join(__dirname, 'portfolios.json');
const VIEWPORT = { width: 1280, height: 800 };
const WEBP_QUALITY = 80;
const MIN_FILE_SIZE = 5120; // 5 KB
const MIN_WIDTH = 400;
const MIN_HEIGHT = 250;
const HERO_COUNT = 20;

if (!fs.existsSync(PREVIEWS_DIR)) {
  fs.mkdirSync(PREVIEWS_DIR, { recursive: true });
}

function getFilenameForUrl(url) {
  const hash = crypto.createHash('md5').update(url.trim().toLowerCase()).digest('hex');
  return `${hash}.webp`;
}

function getSystemChromePath() {
  const candidatePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  return candidatePaths.find(p => p && fs.existsSync(p)) || null;
}

function getWebPDimensions(buffer) {
  if (!buffer || buffer.length < 30) return null;
  if (buffer.toString('utf8', 0, 4) !== 'RIFF' || buffer.toString('utf8', 8, 12) !== 'WEBP') {
    return null;
  }
  const chunkType = buffer.toString('utf8', 12, 16);
  if (chunkType === 'VP8 ') {
    const width = ((buffer[27] & 0x3f) << 8) | buffer[26];
    const height = ((buffer[29] & 0x3f) << 8) | buffer[28];
    return { width, height };
  } else if (chunkType === 'VP8L') {
    const b1 = buffer[21], b2 = buffer[22], b3 = buffer[23], b4 = buffer[24];
    const width = 1 + (((b2 & 0x3f) << 8) | b1);
    const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
    return { width, height };
  } else if (chunkType === 'VP8X') {
    const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
    const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
    return { width, height };
  }
  return null;
}

function isScreenshotValid(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stats = fs.statSync(filePath);
  if (stats.size < MIN_FILE_SIZE) return false;

  try {
    const buffer = fs.readFileSync(filePath);
    const dims = getWebPDimensions(buffer);
    if (!dims) return false;
    return dims.width > MIN_WIDTH && dims.height > MIN_HEIGHT;
  } catch (err) {
    return false;
  }
}

async function runPipeline() {
  const startTime = Date.now();
  console.log('🚀 Starting Robust Screenshot Pipeline...\n');

  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌ Error: portfolios.json not found.');
    process.exit(1);
  }

  let puppeteer;
  try {
    puppeteer = require('puppeteer-core');
  } catch (e1) {
    try {
      puppeteer = require('puppeteer');
    } catch (e2) {
      console.error('❌ Neither puppeteer-core nor puppeteer module found.');
      process.exit(1);
    }
  }

  const portfolios = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  const totalPortfolios = portfolios.length;
  console.log(`📁 Loaded ${totalPortfolios} portfolio records.`);

  // Clean out any invalid stub WebP files
  let deletedStubs = 0;
  portfolios.forEach((item) => {
    const filename = getFilenameForUrl(item.url);
    const targetPath = path.join(PREVIEWS_DIR, filename);
    if (fs.existsSync(targetPath) && !isScreenshotValid(targetPath)) {
      fs.unlinkSync(targetPath);
      deletedStubs++;
    }
  });

  if (deletedStubs > 0) {
    console.log(`🧹 Cleaned up ${deletedStubs} invalid/stub WebP files.`);
  }

  const tasks = portfolios.map((item, index) => {
    const filename = getFilenameForUrl(item.url);
    const targetPath = path.join(PREVIEWS_DIR, filename);
    const valid = isScreenshotValid(targetPath);
    return {
      index,
      name: item.name,
      url: item.url,
      filename,
      targetPath,
      isHero: index < HERO_COUNT,
      valid
    };
  });

  const skippedCount = tasks.filter(t => t.valid).length;
  const pendingTasks = tasks.filter(t => !t.valid);

  console.log(`✅ ${skippedCount} valid screenshots already exist (Skipped).`);
  console.log(`📸 ${pendingTasks.length} screenshots to generate.`);

  if (pendingTasks.length === 0) {
    console.log('\n🎉 All portfolio screenshots are already valid and up to date!');
    printReport(totalPortfolios, 0, 0, skippedCount, startTime);
    return;
  }

  const systemChrome = getSystemChromePath();
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  };

  if (systemChrome) {
    launchOptions.executablePath = systemChrome;
    console.log(`🌐 Using system browser: ${systemChrome}`);
  }

  const browser = await puppeteer.launch(launchOptions);

  let generatedCount = 0;
  let failedCount = 0;

  async function captureScreenshot(task, retry = 0) {
    let page;
    try {
      page = await browser.newPage();
      await page.setViewport(VIEWPORT);
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const resourceType = req.resourceType();
        if (['media', 'font', 'other'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(task.url, {
        waitUntil: 'domcontentloaded',
        timeout: 12000
      });

      await new Promise(r => setTimeout(r, 1000));

      const tempPath = task.targetPath + '.tmp';
      await page.screenshot({
        path: tempPath,
        type: 'webp',
        quality: WEBP_QUALITY,
        clip: { x: 0, y: 0, width: 1280, height: 800 }
      });

      if (isScreenshotValid(tempPath)) {
        fs.renameSync(tempPath, task.targetPath);
        generatedCount++;
        console.log(`[${generatedCount + failedCount}/${pendingTasks.length}] ${task.isHero ? '⭐ [HERO]' : '📷'} Generated: ${task.name} -> previews/${task.filename}`);
      } else {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        throw new Error('Screenshot failed validation check');
      }
    } catch (error) {
      if (retry < 1) {
        console.warn(`⚠️ Retrying ${task.name} (${task.url}): ${error.message}`);
        if (page) await page.close().catch(() => {});
        return captureScreenshot(task, retry + 1);
      } else {
        failedCount++;
        console.error(`❌ Failed ${task.name} (${task.url}): ${error.message}`);
        if (fs.existsSync(task.targetPath)) fs.unlinkSync(task.targetPath);
      }
    } finally {
      if (page) await page.close().catch(() => {});
    }
  }

  // 1. Process Hero Section Screenshots First
  const heroPending = pendingTasks.filter(t => t.isHero);
  if (heroPending.length > 0) {
    console.log(`\n⭐ Prioritizing first ${heroPending.length} Hero Section screenshots...`);
    for (const heroTask of heroPending) {
      await captureScreenshot(heroTask);
    }
    console.log(`✨ Hero section screenshots completed!\n`);
  }

  // 2. Process Remaining Grid Screenshots in Parallel Batches
  const gridPending = pendingTasks.filter(t => !t.isHero);
  if (gridPending.length > 0) {
    console.log(`📷 Generating remaining ${gridPending.length} grid screenshots (Concurrency: ${CONCURRENCY_LIMIT})...`);
    const queue = [...gridPending];
    const workers = Array(CONCURRENCY_LIMIT).fill(0).map(async () => {
      while (queue.length > 0) {
        const task = queue.shift();
        if (task) {
          await captureScreenshot(task);
        }
      }
    });

    await Promise.all(workers);
  }

  await browser.close();
  printReport(totalPortfolios, generatedCount, failedCount, skippedCount, startTime);
}

function printReport(total, generated, failed, skipped, startTime) {
  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n========================================');
  console.log('📊 SCREENSHOT GENERATION REPORT');
  console.log('========================================');
  console.log(`Total portfolios:       ${total}`);
  console.log(`Successfully generated: ${generated}`);
  console.log(`Failed:                 ${failed}`);
  console.log(`Skipped (already valid): ${skipped}`);
  console.log(`Total generation time:  ${elapsedSec}s (${(elapsedSec / 60).toFixed(1)} mins)`);
  console.log('========================================\n');
}

runPipeline().catch(err => {
  console.error('Fatal Pipeline Error:', err);
  process.exit(1);
});
