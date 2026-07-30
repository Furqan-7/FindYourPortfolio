/**
 * FindYourPortfolio — Local Screenshot Pipeline Engine with Real-Time Likes & Custom Branding
 */

(function () {
  "use strict";

  // Data State
  let DATA = [];
  let filtered = [];
  const presentLetters = {};
  const likesMap = {}; // { [url]: count }

  // Client-side liked portfolios persistence
  const LIKED_STORAGE_KEY = "liked_portfolios_v1";
  let userLikedSet = new Set();
  try {
    const stored = localStorage.getItem(LIKED_STORAGE_KEY);
    if (stored) {
      userLikedSet = new Set(JSON.parse(stored));
    }
  } catch (e) {
    userLikedSet = new Set();
  }

  function saveUserLikes() {
    try {
      localStorage.setItem(LIKED_STORAGE_KEY, JSON.stringify(Array.from(userLikedSet)));
    } catch (e) {}
  }

  const BATCH_SIZE = 30;
  const state = {
    query: "",
    letter: "All",
    sortMode: "alphabetical", // "alphabetical" | "most-liked"
    rendered: 0
  };

  // Caches
  const previewCache = new Map();
  const initialsCache = new Map();
  const cleanUrlCache = new Map();

  // DOM Elements
  const gridEl = document.getElementById("grid");
  const emptyEl = document.getElementById("emptyState");
  const countEl = document.getElementById("resultsCount");
  const navCountEl = document.getElementById("navCount");
  const alphaRowEl = document.getElementById("alphaRow");
  const mostLikedBtn = document.getElementById("mostLikedBtn");
  const searchInput = document.getElementById("searchInput");
  const sentinelEl = document.getElementById("sentinel");

  // Client-side MD5 Hash for Local Screenshot Filenames
  function md5(string) {
    function rotateLeft(lValue, iShiftBits) {
      return (lValue << iShiftBits) | (lValue >>> (32 - iShiftBits));
    }
    function addUnsigned(lX, lY) {
      var lX4, lY4, lX8, lY8, lResult;
      lX8 = lX & 0x80000000;
      lY8 = lY & 0x80000000;
      lX4 = lX & 0x40000000;
      lY4 = lY & 0x40000000;
      lResult = (lX & 0x3fffffff) + (lY & 0x3fffffff);
      if (lX4 & lY4) return lResult ^ 0x80000000 ^ lX8 ^ lY8;
      if (lX4 | lY4) {
        if (lResult & 0x40000000) return lResult ^ 0xc0000000 ^ lX8 ^ lY8;
        else return lResult ^ 0x40000000 ^ lX8 ^ lY8;
      } else return lResult ^ lX8 ^ lY8;
    }
    function F(x, y, z) { return (x & y) | (~x & z); }
    function G(x, y, z) { return (x & z) | (y & ~z); }
    function H(x, y, z) { return x ^ y ^ z; }
    function I(x, y, z) { return y ^ (x | ~z); }
    function FF(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(F(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function GG(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(G(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function HH(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(H(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function II(a, b, c, d, x, s, ac) {
      a = addUnsigned(a, addUnsigned(addUnsigned(I(b, c, d), x), ac));
      return addUnsigned(rotateLeft(a, s), b);
    }
    function convertToWordArray(str) {
      var lMessageLength = str.length;
      var lNumberOfWords_temp1 = lMessageLength + 8;
      var lNumberOfWords_temp2 = (lNumberOfWords_temp1 - (lNumberOfWords_temp1 % 64)) / 64;
      var lNumberOfWords = (lNumberOfWords_temp2 + 1) * 16;
      var lWordArray = Array(lNumberOfWords - 1);
      var lBytePosition = 0;
      var lByteCount = 0;
      while (lByteCount < lMessageLength) {
        var lWordIndex = (lByteCount - (lByteCount % 4)) / 4;
        lBytePosition = (lByteCount % 4) * 8;
        lWordArray[lWordIndex] = (lWordArray[lWordIndex] | (str.charCodeAt(lByteCount) << lBytePosition));
        lByteCount++;
      }
      lWordIndex = (lByteCount - (lByteCount % 4)) / 4;
      lBytePosition = (lByteCount % 4) * 8;
      lWordArray[lWordIndex] = lWordArray[lWordIndex] | (0x80 << lBytePosition);
      lWordArray[lNumberOfWords - 2] = lMessageLength << 3;
      lWordArray[lNumberOfWords - 1] = lMessageLength >>> 29;
      return lWordArray;
    }
    function wordToHex(lValue) {
      var WordToHexValue = "", WordToHexValue_temp = "", lByte, lCount;
      for (lCount = 0; lCount <= 3; lCount++) {
        lByte = (lValue >>> (lCount * 8)) & 255;
        WordToHexValue_temp = "0" + lByte.toString(16);
        WordToHexValue = WordToHexValue + WordToHexValue_temp.substr(WordToHexValue_temp.length - 2, 2);
      }
      return WordToHexValue;
    }

    var x = convertToWordArray(string.trim().toLowerCase());
    var k, AA, BB, CC, DD, a, b, c, d;
    var S11 = 7, S12 = 12, S13 = 17, S14 = 22;
    var S21 = 5, S22 = 9, S23 = 14, S24 = 20;
    var S31 = 4, S32 = 11, S33 = 16, S34 = 23;
    var S41 = 6, S42 = 10, S43 = 15, S44 = 21;

    a = 0x67452301; b = 0xefcdab89; c = 0x98badcfe; d = 0x10325476;

    for (k = 0; k < x.length; k += 16) {
      AA = a; BB = b; CC = c; DD = d;
      a = FF(a, b, c, d, x[k + 0], S11, 0xd76aa478);
      d = FF(d, a, b, c, x[k + 1], S12, 0xe8c7b756);
      c = FF(c, d, a, b, x[k + 2], S13, 0x242070db);
      b = FF(b, c, d, a, x[k + 3], S14, 0xc1bdceee);
      a = FF(a, b, c, d, x[k + 4], S11, 0xf57c0faf);
      d = FF(d, a, b, c, x[k + 5], S12, 0x4787c62a);
      c = FF(c, d, a, b, x[k + 6], S13, 0xa8304613);
      b = FF(b, c, d, a, x[k + 7], S14, 0xfd469501);
      a = FF(a, b, c, d, x[k + 8], S11, 0x698098d8);
      d = FF(d, a, b, c, x[k + 9], S12, 0x8b44f7af);
      c = FF(c, d, a, b, x[k + 10], S13, 0xffff5bb1);
      b = FF(b, c, d, a, x[k + 11], S14, 0x895cd7be);
      a = FF(a, b, c, d, x[k + 12], S11, 0x6b901122);
      d = FF(d, a, b, c, x[k + 13], S12, 0xfd987193);
      c = FF(c, d, a, b, x[k + 14], S13, 0xa679438e);
      b = FF(b, c, d, a, x[k + 15], S14, 0x49b40821);
      a = GG(a, b, c, d, x[k + 1], S21, 0xf61e2562);
      d = GG(d, a, b, c, x[k + 6], S22, 0xc040b340);
      c = GG(c, d, a, b, x[k + 11], S23, 0x265e5a51);
      b = GG(b, c, d, a, x[k + 0], S24, 0xe9b6c7aa);
      a = GG(a, b, c, d, x[k + 5], S21, 0xd62f105d);
      d = GG(d, a, b, c, x[k + 10], S22, 0x2441453);
      c = GG(c, d, a, b, x[k + 15], S23, 0xd8a1e681);
      b = GG(b, c, d, a, x[k + 4], S24, 0xe7d3fbc8);
      a = GG(a, b, c, d, x[k + 9], S21, 0x21e1cde6);
      d = GG(d, a, b, c, x[k + 14], S22, 0xc33707d6);
      c = GG(c, d, a, b, x[k + 3], S23, 0xf4d50d87);
      b = GG(b, c, d, a, x[k + 8], S24, 0x455a14ed);
      a = GG(a, b, c, d, x[k + 13], S21, 0xa9e3e905);
      d = GG(d, a, b, c, x[k + 2], S22, 0xfcefa3f8);
      c = GG(c, d, a, b, x[k + 7], S23, 0x676f02d9);
      b = GG(b, c, d, a, x[k + 12], S24, 0x8d2a4c8a);
      a = HH(a, b, c, d, x[k + 5], S31, 0xfffa3942);
      d = HH(d, a, b, c, x[k + 8], S32, 0x8771f681);
      c = HH(c, d, a, b, x[k + 11], S33, 0x6d9d6122);
      b = HH(b, c, d, a, x[k + 14], S34, 0xfde5380c);
      a = HH(a, b, c, d, x[k + 1], S31, 0xa4beea44);
      d = HH(d, a, b, c, x[k + 4], S32, 0x4bdecfa9);
      c = HH(c, d, a, b, x[k + 7], S33, 0xf6bb4b60);
      b = HH(b, c, d, a, x[k + 10], S34, 0xbebfbc70);
      a = HH(a, b, c, d, x[k + 13], S31, 0x289b7ec6);
      d = HH(d, a, b, c, x[k + 0], S32, 0xeaa127fa);
      c = HH(c, d, a, b, x[k + 3], S33, 0xd4ef3085);
      b = HH(b, c, d, a, x[k + 6], S34, 0x4881d05);
      a = HH(a, b, c, d, x[k + 9], S31, 0xd9d4d039);
      d = HH(d, a, b, c, x[k + 12], S32, 0xe6db99e5);
      c = HH(c, d, a, b, x[k + 15], S33, 0x1fa27cf8);
      b = HH(b, c, d, a, x[k + 2], S34, 0xc4ac5665);
      a = II(a, b, c, d, x[k + 0], S41, 0xf4292244);
      d = II(d, a, b, c, x[k + 7], S42, 0x432aff97);
      c = II(c, d, a, b, x[k + 14], S43, 0xab9423a7);
      b = II(b, c, d, a, x[k + 5], S44, 0xfc93a039);
      a = II(a, b, c, d, x[k + 12], S41, 0x655b59c3);
      d = II(d, a, b, c, x[k + 3], S42, 0x8f0ccc92);
      c = II(c, d, a, b, x[k + 10], S43, 0xffeff47d);
      b = II(b, c, d, a, x[k + 1], S44, 0x85845dd1);
      a = II(a, b, c, d, x[k + 8], S41, 0x6fa87e4f);
      d = II(d, a, b, c, x[k + 15], S42, 0xfe2ce6e0);
      c = II(c, d, a, b, x[k + 6], S43, 0xa3014314);
      b = II(b, c, d, a, x[k + 13], S44, 0x4e0811a1);
      a = II(a, b, c, d, x[k + 4], S41, 0xf7537e82);
      d = II(d, a, b, c, x[k + 11], S42, 0xbd3af235);
      c = II(c, d, a, b, x[k + 2], S43, 0x2ad7d2bb);
      b = II(b, c, d, a, x[k + 9], S44, 0xeb86d391);
      a = addUnsigned(a, AA);
      b = addUnsigned(b, BB);
      c = addUnsigned(c, CC);
      d = addUnsigned(d, DD);
    }

    return (wordToHex(a) + wordToHex(b) + wordToHex(c) + wordToHex(d)).toLowerCase();
  }

  // Local Pre-generated Screenshot URL mapper
  function previewFor(url) {
    if (!url) return "";
    if (previewCache.has(url)) return previewCache.get(url);
    const hash = md5(url);
    const res = `previews/${hash}.webp`;
    previewCache.set(url, res);
    return res;
  }

  // Image Download Queue Concurrency Control
  const MAX_CONCURRENT_IMAGES = 6;
  let activeImageRequests = 0;
  const imageQueue = [];

  const imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target;
        imageObserver.unobserve(img);

        const url = img.dataset.url;
        if (url) {
          imageQueue.push({ url, imgNode: img });
          pumpImageQueue();
        }
      });
    },
    { rootMargin: "400px 0px" }
  );

  function pumpImageQueue() {
    while (activeImageRequests < MAX_CONCURRENT_IMAGES && imageQueue.length > 0) {
      const task = imageQueue.shift();
      const { url, imgNode } = task;

      if (!imgNode || !imgNode.isConnected) continue;
      if (imgNode.dataset.loaded === "1") continue;

      activeImageRequests++;
      imgNode.dataset.loading = "1";

      const localPreviewUrl = previewFor(url);
      imgNode.src = localPreviewUrl;

      const cleanup = () => {
        activeImageRequests--;
        delete imgNode.dataset.loading;
        pumpImageQueue();
      };

      imgNode.onload = () => {
        imgNode.dataset.loaded = "1";
        imgNode.classList.add("loaded");
        if (imgNode.parentElement) {
          imgNode.parentElement.classList.remove("skeleton");
        }
        cleanup();
      };

      imgNode.onerror = () => {
        imgNode.style.display = "none";
        if (imgNode.parentElement) {
          imgNode.parentElement.classList.remove("skeleton");
        }
        cleanup();
      };
    }
  }

  // Helpers
  function firstLetter(name) {
    const c = (name || "#").trim().charAt(0).toUpperCase();
    return /[A-Z]/.test(c) ? c : "#";
  }

  function initialsFor(name) {
    if (!name) return "";
    if (initialsCache.has(name)) return initialsCache.get(name);
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const a = parts[0] ? parts[0].charAt(0) : "";
    const b = parts[1] ? parts[1].charAt(0) : "";
    const res = (a + b).toUpperCase();
    initialsCache.set(name, res);
    return res;
  }

  function cleanUrl(url) {
    if (!url) return "";
    if (cleanUrlCache.has(url)) return cleanUrlCache.get(url);
    const res = url.replace(/^https?:\/\//, "");
    cleanUrlCache.set(url, res);
    return res;
  }

  function toggleLike(url, btnEl) {
    const hasLiked = userLikedSet.has(url);
    let count = likesMap[url] || 0;

    if (hasLiked) {
      userLikedSet.delete(url);
      count = Math.max(0, count - 1);
      likesMap[url] = count;
    } else {
      userLikedSet.add(url);
      count += 1;
      likesMap[url] = count;
    }

    saveUserLikes();

    // Update Card UI
    const isNowLiked = userLikedSet.has(url);
    if (btnEl) {
      if (isNowLiked) {
        btnEl.classList.add("liked");
      } else {
        btnEl.classList.remove("liked");
      }
      const heartSvg = btnEl.querySelector(".heart-icon");
      if (heartSvg) {
        heartSvg.setAttribute("fill", isNowLiked ? "currentColor" : "none");
      }
      const countSpan = btnEl.querySelector(".like-count");
      if (countSpan) {
        countSpan.textContent = count.toLocaleString();
      }
    }

    // Call API Endpoint asynchronously
    fetch("/api/like", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, action: isNowLiked ? "like" : "unlike" })
    }).catch(err => console.error("Error updating like on server:", err));

    // If "Most Liked" sort mode is active, update grid layout order
    if (state.sortMode === "most-liked") {
      applyFilters();
    }
  }

  function createCard(d) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = d.url;
    a.target = "_blank";
    a.rel = "noopener";

    const preview = document.createElement("div");
    preview.className = "card-preview";

    const chrome = document.createElement("div");
    chrome.className = "preview-chrome";
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "ide-dot";
      chrome.appendChild(dot);
    }

    const imgWrap = document.createElement("div");
    imgWrap.className = "preview-img-wrap skeleton";

    const fallback = document.createElement("div");
    fallback.className = "preview-fallback";
    fallback.textContent = initialsFor(d.name);

    const img = document.createElement("img");
    img.alt = d.name;
    img.decoding = "async";
    img.dataset.url = d.url;

    imageObserver.observe(img);

    imgWrap.appendChild(fallback);
    imgWrap.appendChild(img);

    preview.appendChild(chrome);
    preview.appendChild(imgWrap);

    const body = document.createElement("div");
    body.className = "card-body";

    const name = document.createElement("p");
    name.className = "card-name";
    name.textContent = d.name;

    const tagline = document.createElement("p");
    tagline.className = "card-tagline";
    tagline.textContent = d.tagline || " ";

    const footerRow = document.createElement("div");
    footerRow.className = "card-footer-row";

    const url = document.createElement("span");
    url.className = "card-url";
    url.textContent = cleanUrl(d.url);

    const isLiked = userLikedSet.has(d.url);
    const likesCount = likesMap[d.url] || 0;

    const likeBtn = document.createElement("button");
    likeBtn.type = "button";
    likeBtn.className = "like-btn" + (isLiked ? " liked" : "");
    likeBtn.setAttribute("aria-label", "Like portfolio");
    likeBtn.innerHTML = `
      <svg class="heart-icon" viewBox="0 0 24 24" fill="${isLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
      </svg>
      <span class="like-count">${likesCount.toLocaleString()}</span>
    `;

    likeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleLike(d.url, likeBtn);
    });

    footerRow.appendChild(url);
    footerRow.appendChild(likeBtn);

    body.appendChild(name);
    body.appendChild(tagline);
    body.appendChild(footerRow);

    a.appendChild(preview);
    a.appendChild(body);

    return a;
  }

  function renderNextBatch() {
    if (state.rendered >= filtered.length) return;

    const nextBatch = filtered.slice(state.rendered, state.rendered + BATCH_SIZE);
    const frag = document.createDocumentFragment();

    nextBatch.forEach((d) => {
      frag.appendChild(createCard(d));
    });

    gridEl.appendChild(frag);
    state.rendered += nextBatch.length;

    countEl.textContent = `Showing ${state.rendered.toLocaleString()} of ${filtered.length.toLocaleString()}`;
  }

  function buildAlphaRow() {
    const letters = ["All", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
    let html = "";
    letters.forEach((L) => {
      const isActive = state.sortMode === "alphabetical" && L === state.letter;
      const isDisabled = L !== "All" && !presentLetters[L];
      html += `<button type="button" class="alpha-btn${isActive ? " active" : ""}" data-letter="${L}"${isDisabled ? " disabled" : ""}>${L}</button>`;
    });
    alphaRowEl.innerHTML = html;
  }

  // Alpha Filter Buttons Handler
  alphaRowEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".alpha-btn");
    if (!btn || btn.disabled) return;
    const letter = btn.dataset.letter;
    if (letter) {
      state.sortMode = "alphabetical";
      state.letter = letter;
      if (mostLikedBtn) mostLikedBtn.classList.remove("active");
      applyFilters();
    }
  });

  // Most Liked Sort Button Handler
  if (mostLikedBtn) {
    mostLikedBtn.addEventListener("click", () => {
      if (state.sortMode === "most-liked") {
        state.sortMode = "alphabetical";
        mostLikedBtn.classList.remove("active");
      } else {
        state.sortMode = "most-liked";
        mostLikedBtn.classList.add("active");
      }
      applyFilters();
    });
  }

  function applyFilters() {
    const q = state.query.trim().toLowerCase();
    
    // Filter by query and letter
    filtered = DATA.filter((d) => {
      if (state.sortMode === "alphabetical" && state.letter !== "All" && firstLetter(d.name) !== state.letter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.tagline && d.tagline.toLowerCase().includes(q))
      );
    });

    // Apply Most Liked Sort if active
    if (state.sortMode === "most-liked") {
      filtered.sort((a, b) => {
        const likesA = likesMap[a.url] || 0;
        const likesB = likesMap[b.url] || 0;
        if (likesB !== likesA) return likesB - likesA;
        return a.name.localeCompare(b.name);
      });
    }

    state.rendered = 0;
    gridEl.innerHTML = "";
    imageQueue.length = 0;

    buildAlphaRow();
    emptyEl.style.display = filtered.length === 0 ? "block" : "none";

    renderNextBatch();
  }

  let searchTimer = null;
  searchInput.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const val = e.target.value;
    searchTimer = setTimeout(() => {
      state.query = val;
      applyFilters();
    }, 300);
  });

  const sentinelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && state.rendered < filtered.length) {
          requestAnimationFrame(() => {
            renderNextBatch();
          });
        }
      });
    },
    { rootMargin: "600px 0px" }
  );
  sentinelObserver.observe(sentinelEl);

  window.addEventListener("scroll", () => {}, { passive: true });

  function scheduleIdleTasks() {
    const idleCallback = window.requestIdleCallback || ((cb) => setTimeout(cb, 50));
    idleCallback(() => {
      const limit = Math.min(filtered.length, 100);
      for (let i = 0; i < limit; i++) {
        const item = filtered[i];
        if (item) {
          initialsFor(item.name);
          cleanUrl(item.url);
        }
      }
    });
  }

  async function loadData() {
    try {
      // 1. Fetch persistent Likes data
      try {
        const likesResp = await fetch("/api/likes");
        if (likesResp.ok) {
          const remoteLikes = await likesResp.json();
          Object.assign(likesMap, remoteLikes);
        }
      } catch (e) {
        console.warn("Could not fetch remote likes map, using local fallback");
      }

      // 2. Fetch Portfolios data
      const resp = await fetch("portfolios.json");
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      DATA = await resp.json();

      navCountEl.textContent = `${DATA.length.toLocaleString()} portfolios`;

      DATA.forEach((d) => {
        presentLetters[firstLetter(d.name)] = true;
      });

      applyFilters();
      scheduleIdleTasks();
    } catch (err) {
      console.error("Failed to load portfolios data:", err);
      countEl.textContent = "Error loading portfolios data.";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData);
  } else {
    loadData();
  }
})();
