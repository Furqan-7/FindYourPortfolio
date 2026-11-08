# FindYourPortfolio 🚀

A fast, responsive directory of **1,500+ real developer portfolio sites**, built with **Next.js 16 (App Router)**. It has
a built-in backend with SQLite locally and Neon Postgres in production, instant live previews, likes, weekly and yearly rankings, and community submissions.

---

## ✨ Features

- **Live previews in the cards.** Each card shows the real website running, shrunk to fit, instead of a static
  screenshot.
  - The saved screenshot shows instantly and fades into the live site once it has rendered.
  - To keep scrolling smooth, live sites load only for cards on screen and unload when you scroll away. At most 6 run
    at once on desktop and 2 on phones.
  - The **Live previews** switch turns this off. The choice is remembered, and it's off by default when the browser
    has data saver on.
  - Some sites refuse to be shown inside other pages (`X-Frame-Options` / CSP `frame-ancestors`). The server
    detects this, caches the result for a week, and those cards keep the screenshot instead of a broken frame.
- **Hover to scroll.** Rest the mouse on a card for 3 seconds (a progress bar fills along the bottom) and the
  preview scrolls smoothly down the whole page. Move the mouse away and it glides back to the live site.
  - Browsers don't let a page scroll another site embedded in it, so the scroll runs over a full-page screenshot
    (see [Generating preview screenshots](#generating-preview-screenshots)).
  - Sites without a full-page screenshot, and single-screen sites, stay live and don't scroll.
- **Click to visit.** Clicking anywhere on a card opens the portfolio in a new tab. The like button works on its own
  without opening the site.
- **Rankings.** *Best of the week* (rolling 7 days), *Best of the year* (rolling 365 days) and *All time*, on
  `/rankings`. The top of the week is also featured on the home page.
- **Add your portfolio.** Use the `/submit` form. It validates input, blocks duplicates and private or internal
  addresses, has a honeypot field, rate-limits submissions, and shows a live card preview as you type.
- **Reliable likes.** Each visitor gets an anonymous id in an httpOnly cookie. Likes are stored once per visitor per
  portfolio and update instantly, with rollback if the request fails (see below).
- **Fast browsing.** The page is server-rendered with pre-generated WebP screenshots. Search, sorting (A–Z, Most liked,
  Trending this week, Newest) and the A–Z filter all run instantly on the client. Cards load 24 at a time with infinite
  scroll, use `content-visibility`, and lazy-load their images.

### Like button fixes

The old like button had these problems:

| Problem | Fix |
| --- | --- |
| Likes didn't persist on serverless or static hosting. `likes.json` was written to the file system. | Likes live in the database. |
| Whether you had liked something was kept in `localStorage`, so clearing storage let you like again. Anyone could also send `unlike` and lower other people's counts. | The server tracks one like per visitor (cookie id), using a `(portfolio_id, voter_id)` primary key. |
| Rapid clicks could double count or get out of sync. | The client sends the **desired state** (`{ liked: true/false }`), which is idempotent. The server returns the real counts, and the UI reconciles or rolls back with a toast. |
| In "Most liked" mode every click rebuilt the whole grid and reset scrolling. | The sort order is fixed when you pick a sort. Liking only updates that card's counter. |
| A `<button>` nested inside the card's `<a>` (invalid HTML). | Cards are now an `<article>` with separate links and buttons. The grid, rankings and modal stay in sync through a shared store. |

---

## 🛠️ Project structure

```
app/
  layout.tsx, globals.css        # shell, fonts (next/font), design tokens
  page.tsx                       # home: hero, best of the week, directory
  rankings/page.tsx              # week / year / all-time leaderboards
  submit/page.tsx                # "Add your portfolio"
  api/
    portfolios/route.ts          # GET list · POST submit
    portfolios/[id]/like/route.ts   # GET state · POST { liked }
    embed/route.ts               # GET ?ids=1,2,3 → batched embed checks for the cards
    rankings/route.ts            # GET ?period=week|year|all
components/                      # client UI (cards, like store, forms)
  live/                          # live iframe layer, hover-scroll, slot limits, embed-check cache
lib/
  db.ts                          # SQLite / Neon / Postgres adapters, schema, automatic seeding
  portfolios.ts                  # queries (lists, rankings, likes, submissions)
  embed.ts                       # SSRF-safe iframe-ability check
  url.ts, previews.ts, voter.ts, rate-limit.ts, types.ts, format.ts
data/
  portfolios.json                # seed list (synced into the DB on boot)
  legacy-likes.json              # likes migrated from the old likes.json
  preview-manifest.json          # which screenshots exist in public/previews
  fullpage-manifest.json         # which full-page shots exist in public/previews/full
public/previews/                 # pre-generated WebP screenshots (1280x800)
public/previews/full/            # full-page WebP shots used for hover-to-scroll
scripts/generate-screenshots.mjs # screenshot pipeline (puppeteer-core)
```

---

## 🗄️ Database

The database layer runs the same SQL on two engines:

| Setup | `DATABASE_URL` | Driver |
| --- | --- | --- |
| **Local development** (default) | *unset* | SQLite file at `data/app.db` (libSQL) |
| **Production on Vercel** | Neon connection string | Neon serverless driver (HTTP, no connection pool to manage) |
| Other Postgres | `postgres://…` | `pg` |
| Turso | `libsql://…` plus `DATABASE_AUTH_TOKEN` | libSQL |

When the app starts, it creates the tables and seeds them from `data/portfolios.json`. On Postgres an advisory lock
makes sure several serverless instances starting at once don't collide. If the seed file changes, the new entries are
synced on the next start. You never need to run migrations by hand.

Tables:

- `portfolios`: seed and community entries, with a moderation `status` and the cached `frameable` result
- `likes`: one row per visitor per portfolio, with a timestamp for the weekly and yearly windows
- `meta`: internal settings, such as which version of the seed list has been loaded

### Deploying to Vercel with Neon

1. Create a Neon database, using either option:
   - In Vercel, open **Storage → Create → Neon** and connect it to this project. This sets `DATABASE_URL` for you.
   - In the Neon console, create a project and copy the **pooled** connection string (the host contains `-pooler`).
     Then add it in Vercel under **Settings → Environment Variables** as `DATABASE_URL`.
2. Redeploy. The first request creates the tables and loads all portfolios.

If no database URL is set on Vercel, the app falls back to a temporary SQLite file. It still works, but likes and
submissions are lost whenever the server restarts.

See `.env.example` for all options. For example, `SUBMISSIONS_REQUIRE_REVIEW=true` holds new submissions as `pending`
until you set their `status` to `approved`.

---

## 🚀 Getting started

```bash
npm install
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

For a production build:

```bash
npm run build && npm start
```

### Generating preview screenshots

The screenshot script captures two images for every portfolio that's missing them:

| Image | Size | Used for |
| --- | --- | --- |
| `public/previews/<hash>.webp` | 1280×800 | Instant placeholder while the live site loads |
| `public/previews/full/<hash>.webp` | 640 px wide, up to 6 screens tall | The hover-to-scroll effect |

Before taking the full-page shot, the script scrolls through each page so lazy images and scroll animations have
appeared.

Run it on a computer with internet access and Chrome or Chromium installed. Set `CHROME_PATH` if it isn't found
automatically.

```bash
npm run previews
```

A full run over all portfolios takes roughly an hour. Afterwards, commit `public/previews/` and the two manifest
files in `data/`, then redeploy.

To capture specific sites only, or to re-capture them:

```bash
ONLY=example.com FORCE=1 npm run previews
```

Portfolios without a saved screenshot (such as new submissions) use a remote screenshot service
(`NEXT_PUBLIC_SCREENSHOT_URL`) as the placeholder, and fall back to the person's initials.
---

## 📜 License

MIT License.
