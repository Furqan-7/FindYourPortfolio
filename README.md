# FindYourPortfolio 🚀

A fast, responsive directory of **1,500+ real developer portfolio sites**, built with **Next.js 16 (App Router)**. It has
an embedded database, instant live previews, likes, weekly and yearly rankings, and community submissions.

---

## ✨ Features

- **Live preview for every portfolio.** One click opens the real site in a scaled iframe with Desktop, Tablet and Mobile
  frames. You can step through portfolios with ← / →, and like or visit a site without leaving the modal.
  - The saved screenshot shows instantly while the live site loads, so the preview never starts as a blank box.
  - Hovering a card warms up the connection (`preconnect`) and runs the embed check before you click.
  - Sites that refuse embedding (`X-Frame-Options` / CSP `frame-ancestors`) are detected on the server and cached in
    the DB. For those you see the screenshot and an "Open in new tab" button instead of a broken frame.
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
    portfolios/[id]/embed/route.ts  # GET { frameable } (cached)
    rankings/route.ts            # GET ?period=week|year|all
components/                      # client UI (cards, like store, preview modal, forms)
lib/
  db.ts                          # libSQL client, schema, automatic seeding
  portfolios.ts                  # queries (lists, rankings, likes, submissions)
  embed.ts                       # SSRF-safe iframe-ability check
  url.ts, previews.ts, voter.ts, rate-limit.ts, types.ts, format.ts
data/
  portfolios.json                # seed list (synced into the DB on boot)
  legacy-likes.json              # likes migrated from the old likes.json
  preview-manifest.json          # which screenshots exist in public/previews
public/previews/                 # pre-generated WebP screenshots
scripts/generate-screenshots.mjs # screenshot pipeline (puppeteer-core)
```

---

## 🗄️ Database

The app uses **libSQL (SQLite)** through `@libsql/client`, so no separate database server is needed.

- **Local (default):** the database is a file at `data/app.db`, created automatically. On first boot it creates the
  tables and seeds them from `data/portfolios.json`. When the seed file changes, the new entries are synced on the
  next boot.
- **Production / serverless (e.g. Vercel):** the serverless file system doesn't keep data between requests, so point
  the app at a hosted libSQL database such as [Turso](https://turso.tech):

  ```bash
  DATABASE_URL=libsql://your-db.turso.io
  DATABASE_AUTH_TOKEN=...
  ```

  If `DATABASE_URL` isn't set on Vercel, the app falls back to `/tmp`. It still works, but data resets on cold starts.

Tables: `portfolios` (seed and community entries, moderation `status`, cached `frameable`), `likes` (one row per
visitor per portfolio, with a timestamp for the weekly and yearly windows), and `meta`.

See `.env.example` for all options, including `SUBMISSIONS_REQUIRE_REVIEW=true`, which holds new submissions as
`pending` until you set their status to `approved`.

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

Portfolios without a saved screenshot (including new submissions) use a remote screenshot service
(`NEXT_PUBLIC_SCREENSHOT_URL`), and fall back to the person's initials. To create local WebP previews for every
portfolio that's missing one:

```bash
npm run previews
```

This needs a local Chrome or Chromium. Set `CHROME_PATH` if it isn't found automatically. The script writes to
`public/previews/` and refreshes `data/preview-manifest.json`. Rebuild afterwards to serve the new screenshots.

---

## 📜 License

MIT License.
