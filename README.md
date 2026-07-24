# FindYourPortfolio 🚀

A high-performance, responsive directory of **1,578 real developer portfolio sites**, indexed from an open-source GitHub collection.

Built with **pure Vanilla HTML, CSS, and ES2022 JavaScript** with **zero external frameworks** and **pre-generated WebP preview screenshots**.

---

## ⚡ Performance Optimizations

- **Pre-generated WebP Screenshots (`./previews/`)**: Replaced live third-party screenshot generation with high-res, compressed `.webp` previews for instant loading.
- **Zero CLS & Instant Fallback**: Cards render without cumulative layout shifts. Offline or missing sites display a clean monogram initial fallback instead of broken images.
- **Virtual Windowing & Node Recycling**: Reuses a fixed DOM pool of 54 cards, keeping rendering lightning fast regardless of list size.
- **Lazy Loading with Concurrency Control**: Uses a single `IntersectionObserver` coupled with an image download queue (max 5-6 concurrent requests).
- **High-Priority Hero Loading**: Featured hero preview images are preloaded in `<head>` with `fetchpriority="high"`.
- **Debounced Search & Delegated Events**: Search input is debounced by 300ms, and alphabet filter navigation relies on delegated event listeners.

---

## 🛠️ Project Structure

```
.
├── index.html               # Semantic HTML markup shell
├── styles.css               # Vanilla CSS design tokens & layouts
├── script.js                # Core ES2022 performance & rendering engine
├── portfolios.json          # Index of 1,578 developer portfolio records
├── server.js                # Lightweight local testing HTTP server
├── generate-screenshots.js  # Headless Puppeteer screenshot generator pipeline
├── update-screenshots.js    # Incremental preview updater script
└── previews/                # Pre-generated WebP preview screenshots (~36 MB)
```

---

## 🚀 Getting Started

### 1. Local Development Server

Run the built-in HTTP server:

```bash
npm start
```

Open [http://localhost:8080](http://localhost:8080) in your browser.

### 2. Updating / Generating Preview Screenshots

To incrementally generate screenshots for new portfolio items:

```bash
npm run update-previews
```

---

## 📜 License

MIT License.
