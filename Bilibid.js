// ============================================================
// CONFIG — API Base URL
// ============================================================
const API_BASE = "https://bilibid-1.onrender.com/api";

// ============================================================
// DATA — Seed metadata (emoji, category, condition, duration)
// ============================================================
const seedItems = [
  {
    emoji: "📱",
    name: "iPhone 15 Pro Max 256GB",
    category: "Gadgets",
    condition: "Brand New",
    startingPrice: 28500,
    duration: 2 * 3600 + 14 * 60,
  },
  {
    emoji: "👟",
    name: "Nike Air Jordan 1 Retro High",
    category: "Footwear",
    condition: "Pre-loved",
    startingPrice: 4200,
    duration: 45 * 60,
  },
  {
    emoji: "🎮",
    name: "PS5 DualSense Controller",
    category: "Gaming",
    condition: "Brand New",
    startingPrice: 2800,
    duration: 27 * 3600,
  },
  {
    emoji: "👜",
    name: "Vintage LV Bag",
    category: "Bags",
    condition: "Pre-loved",
    startingPrice: 15000,
    duration: 5 * 3600 + 30 * 60,
  },
  {
    emoji: "💻",
    name: "MacBook Air M2",
    category: "Gadgets",
    condition: "Brand New",
    startingPrice: 62000,
    duration: 18 * 3600,
  },
  {
    emoji: "📷",
    name: "Sony A7 III Camera",
    category: "Gadgets",
    condition: "Pre-loved",
    startingPrice: 8900,
    duration: 3 * 3600,
  },
  {
    emoji: "💄",
    name: "Dior Beauty Set",
    category: "Beauty",
    condition: "Brand New",
    startingPrice: 3500,
    duration: 12 * 3600,
  },
  {
    emoji: "⭐",
    name: "Limited Edition Funko Pop",
    category: "Collectibles",
    condition: "Brand New",
    startingPrice: 1800,
    duration: 6 * 3600,
  },
  {
    emoji: "👗",
    name: "Vintage Denim Jacket",
    category: "Clothing",
    condition: "Pre-loved",
    startingPrice: 950,
    duration: 8 * 3600,
  },
  {
    emoji: "🏠",
    name: "Dyson Air Purifier",
    category: "Home",
    condition: "Brand New",
    startingPrice: 12500,
    duration: 33 * 3600,
  },
];

// Runtime auction list — populated from server
let auctionItems = [];
const categories = [
  "All",
  "Gadgets",
  "Footwear",
  "Gaming",
  "Bags",
  "Beauty",
  "Clothing",
  "Home",
  "Collectibles",
];
let activeCategory = "All";
let currentBidItem = null;

// ============================================================
// API HELPERS
// ============================================================
async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiCreateAuction(title, startingPrice, duration) {
  return apiFetch("/create-auction", {
    method: "POST",
    body: JSON.stringify({ title, startingPrice, duration }),
  });
}

async function apiPlaceBid(auctionId, bidderName, bidAmount) {
  return apiFetch(`/place-bid/${auctionId}`, {
    method: "POST",
    body: JSON.stringify({ bidderName, bidAmount }),
  });
}

async function apiFetchAuctions() {
  return apiFetch("/auctions");
}

// ============================================================
// SEED SERVER — create auctions on first load if server empty
// ============================================================
async function seedServerAuctions() {
  let serverAuctions = await apiFetchAuctions();

  if (serverAuctions.length === 0) {
    showToast("Setting up auctions...", "blue");
    for (const item of seedItems) {
      await apiCreateAuction(
        item.name,
        item.startingPrice,
        item.duration,
      ).catch(() => {});
    }
    serverAuctions = await apiFetchAuctions();
  }

  // Merge server data with local emoji/category/condition metadata
  auctionItems = serverAuctions.map((serverItem) => {
    const meta = seedItems.find((s) => s.name === serverItem.title) || {};
    return {
      id: serverItem.id,
      emoji: meta.emoji || "🏷️",
      name: serverItem.title,
      category: meta.category || "Other",
      condition: meta.condition || "Unknown",
      price: serverItem.currentBid,
      bids: serverItem.bids.length,
      endTime: Date.now() + (meta.duration || 3600) * 1000,
    };
  });
}

// ============================================================
// SCROLL REVEAL
// ============================================================
const reveals = document.querySelectorAll(".reveal");
const obs = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  },
  { threshold: 0.1 },
);
reveals.forEach((r) => obs.observe(r));
document
  .querySelectorAll(
    ".how-grid .step-card, .feature-list .feature-item, .cat-grid .cat-card",
  )
  .forEach((el, i) => {
    el.style.transitionDelay = i * 0.08 + "s";
  });

// ============================================================
// TOAST
// ============================================================
function showToast(msg, type = "blue") {
  const t = document.getElementById("toast");
  const colors = {
    blue: "linear-gradient(135deg,#1a7fd4,#0e5fa8)",
    orange: "linear-gradient(135deg,#f5a623,#e8920d)",
    green: "linear-gradient(135deg,#27ae60,#1e8449)",
    red: "linear-gradient(135deg,#e74c3c,#c0392b)",
  };
  t.style.background = colors[type] || colors.blue;
  t.textContent = msg;
  t.style.transform = "translateY(0)";
  t.style.opacity = "1";
  setTimeout(() => {
    t.style.transform = "translateY(80px)";
    t.style.opacity = "0";
  }, 3500);
}

// ============================================================
// AUTH MODAL
// ============================================================
function openAuth(tab = "login") {
  document.getElementById("authModal").classList.add("open");
  switchTab(tab);
  document.body.style.overflow = "hidden";
}
function closeAuth() {
  document.getElementById("authModal").classList.remove("open");
  document.body.style.overflow = "";
}
function switchTab(tab) {
  document.getElementById("form-login").style.display =
    tab === "login" ? "block" : "none";
  document.getElementById("form-signup").style.display =
    tab === "signup" ? "block" : "none";
  document.getElementById("tab-login").style.color =
    tab === "login" ? "#1a7fd4" : "#7a9bb5";
  document.getElementById("tab-login").style.borderBottom =
    tab === "login" ? "2px solid #1a7fd4" : "2px solid transparent";
  document.getElementById("tab-signup").style.color =
    tab === "signup" ? "#1a7fd4" : "#7a9bb5";
  document.getElementById("tab-signup").style.borderBottom =
    tab === "signup" ? "2px solid #1a7fd4" : "2px solid transparent";
}
async function handleLogin() {
  const email = document.getElementById("loginEmail").value.trim();
  const pass = document.getElementById("loginPass").value;
  const msg = document.getElementById("loginMsg");

  if (!email || !pass) {
    msg.style.color = "#ff4757";
    msg.textContent = "Please fill in all fields.";
    return;
  }

  msg.style.color = "#1a7fd4";
  msg.textContent = "Signing in...";

  try {
    const res = await fetch(API_BASE + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: email,
        password: pass,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message);
    }

    msg.style.color = "#27ae60";
    msg.textContent = "Login successful!";

    showToast(`Welcome back ${data.user.username}!`, "green");

    // ✅ Redirect to BiliBid2.html
    setTimeout(() => {
      window.location.href = "BiliBid2.html";
    }, 1000);
  } catch (err) {
    msg.style.color = "#ff4757";
    msg.textContent = err.message || "Login failed.";
  }
}

async function handleSignup() {
  const name = document.getElementById("signupName").value.trim();
  const email = document.getElementById("signupEmail").value.trim();
  const pass = document.getElementById("signupPass").value;
  const msg = document.getElementById("signupMsg");

  if (!name || !email || !pass) {
    msg.style.color = "#ff4757";
    msg.textContent = "Please fill in all fields.";
    return;
  }

  if (pass.length < 8) {
    msg.style.color = "#ff4757";
    msg.textContent = "Password must be at least 8 characters.";
    return;
  }

  msg.style.color = "#1a7fd4";
  msg.textContent = "Creating account...";

  try {
    const res = await fetch(API_BASE + "/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: name,
        email: email,
        password: pass,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.message);
    }

    msg.style.color = "#27ae60";
    msg.textContent = "Account created successfully!";

    showToast("Account created!", "green");

    setTimeout(() => {
      closeAuth();
    }, 1000);
  } catch (err) {
    msg.style.color = "#ff4757";
    msg.textContent = err.message || "Signup failed.";
  }
}

const authModal = document.getElementById("authModal");
if (authModal) {
  authModal.addEventListener("click", function (e) {
    if (e.target === this) closeAuth();
  });
}

const bidModal = document.getElementById("bidModal");
if (bidModal) {
  bidModal.addEventListener("click", function (e) {
    if (e.target === this) closeBid();
  });
}

// ============================================================
// NAV INJECTION — search bar + auth buttons
// ============================================================
function injectNav() {
  const navCta = document.querySelector(".nav-cta");
  if (!navCta) return;

  const searchWrap = document.createElement("div");
  searchWrap.style.cssText =
    "position:relative;display:flex;align-items:center;";
  searchWrap.innerHTML = `
    <div class="search-bar">
      <svg width="16" height="16" fill="none" stroke="#7a9bb5" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <input id="globalSearch" placeholder="Search auctions..." oninput="handleSearch(this.value)" autocomplete="off">
    </div>
    <div id="searchResults" class="search-results" style="display:none;"></div>
  `;
  navCta.parentNode.insertBefore(searchWrap, navCta);

  const loginBtn = document.createElement("button");
  loginBtn.className = "nav-auth-btn";
  loginBtn.textContent = "Login";
  loginBtn.onclick = () => openAuth("login");
  navCta.parentNode.insertBefore(loginBtn, navCta);

  navCta.textContent = "Sign Up";
  navCta.href = "#";
  navCta.onclick = (e) => {
    e.preventDefault();
    openAuth("signup");
  };
}

// ============================================================
// SEARCH & FILTER
// ============================================================
function handleSearch(query) {
  const box = document.getElementById("searchResults");
  if (!query.trim()) {
    box.style.display = "none";
    return;
  }
  const q = query.toLowerCase();
  const results = auctionItems.filter(
    (item) =>
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q),
  );
  if (!results.length) {
    box.style.display = "none";
    return;
  }
  box.innerHTML = results
    .slice(0, 5)
    .map(
      (item) => `
    <div class="search-result-item" onclick="openBidModal(${item.id}); document.getElementById('globalSearch').value=''; document.getElementById('searchResults').style.display='none';">
      <span class="s-emoji">${item.emoji}</span>
      <div class="s-info">
        <div class="s-name">${item.name}</div>
        <div class="s-meta">${item.category} · ${item.bids} bids · ${item.condition}</div>
      </div>
      <span class="s-price">P${item.price.toLocaleString()}</span>
    </div>
  `,
    )
    .join("");
  box.style.display = "block";
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".search-bar") && !e.target.closest("#searchResults")) {
    const box = document.getElementById("searchResults");
    if (box) box.style.display = "none";
  }
});

document.querySelectorAll(".cat-card").forEach((card) => {
  const nameEl = card.querySelector(".cat-name");
  if (!nameEl) return;
  const catName = nameEl.textContent;
  card.addEventListener("click", () => filterByCategory(catName));
});

function filterByCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll(".cat-card").forEach((card) => {
    card.classList.toggle(
      "active",
      card.querySelector(".cat-name").textContent === cat,
    );
  });
  renderAuctions();
  document
    .getElementById("liveAuctions")
    .scrollIntoView({ behavior: "smooth" });
  showToast(`Showing ${cat} auctions`, "blue");
}

// ============================================================
// LIVE AUCTIONS SECTION BUILDER
// ============================================================
function buildAuctionsSection() {
  const footer = document.querySelector("footer");
  const section = document.createElement("section");
  section.id = "liveAuctions";
  section.innerHTML = `
    <div class="reveal" style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;margin-bottom:8px;">
      <div>
        <div class="section-label">🔴 Live Now</div>
        <h2 class="section-title">Active Auctions</h2>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;" id="categoryFilters">
        ${categories
          .map(
            (c) => `
          <button onclick="filterByCategory('${c}')" class="cat-filter-btn" data-cat="${c}"
            style="background:${c === "All" ? "rgba(26,127,212,0.2)" : "rgba(26,127,212,0.06)"};
                   border:1px solid ${c === "All" ? "rgba(26,127,212,0.5)" : "rgba(26,127,212,0.2)"};
                   color:${c === "All" ? "#1a7fd4" : "#7a9bb5"};
                   padding:6px 14px;border-radius:50px;font-family:'Sora',sans-serif;
                   font-size:0.78rem;font-weight:600;cursor:pointer;transition:all 0.2s;">${c}
          </button>`,
          )
          .join("")}
      </div>
    </div>
    <div class="auction-grid reveal" id="auctionGrid">
      <div style="color:#7a9bb5;padding:40px;text-align:center;grid-column:1/-1;">Connecting to server...</div>
    </div>
  `;
  footer.parentNode.insertBefore(section, footer);
}

function renderAuctions() {
  const grid = document.getElementById("auctionGrid");
  if (!grid) return;

  if (auctionItems.length === 0) {
    grid.innerHTML =
      '<div style="color:#7a9bb5;padding:40px;text-align:center;grid-column:1/-1;">No auctions available.</div>';
    return;
  }

  const filtered =
    activeCategory === "All"
      ? auctionItems
      : auctionItems.filter((i) => i.category === activeCategory);
  grid.innerHTML = filtered
    .map((item) => {
      const timeStr = formatTime(item.endTime - Date.now());
      const isUrgent = item.endTime - Date.now() < 60 * 60 * 1000;
      return `
      <div class="auction-card reveal" id="acard-${item.id}">
        <div class="ac-live-badge"><span class="ac-live-dot"></span>LIVE</div>
        <div class="ac-emoji">${item.emoji}</div>
        <div class="ac-name">${item.name}</div>
        <div class="ac-category">${item.category} · ${item.condition}</div>
        <div class="ac-bids">🔨 ${item.bids} bids</div>
        <div class="ac-price" id="price-${item.id}">P${item.price.toLocaleString()}</div>
        <div class="ac-timer ${isUrgent ? "countdown-timer urgent" : "countdown-timer"}" id="timer-${item.id}">⏳ ${timeStr}</div>
        <button class="ac-bid-btn" onclick="openBidModal(${item.id})">Place Bid</button>
      </div>
    `;
    })
    .join("");

  document.querySelectorAll(".cat-filter-btn").forEach((btn) => {
    const active = btn.dataset.cat === activeCategory;
    btn.style.background = active
      ? "rgba(26,127,212,0.2)"
      : "rgba(26,127,212,0.06)";
    btn.style.borderColor = active
      ? "rgba(26,127,212,0.5)"
      : "rgba(26,127,212,0.2)";
    btn.style.color = active ? "#1a7fd4" : "#7a9bb5";
  });
}

// ============================================================
// COUNTDOWN TIMERS
// ============================================================
function formatTime(ms) {
  if (ms <= 0) return "Ended";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function startAllTimers() {
  setInterval(() => {
    auctionItems.forEach((item) => {
      const el = document.getElementById(`timer-${item.id}`);
      if (!el) return;
      const remaining = item.endTime - Date.now();
      const str = formatTime(remaining);
      el.textContent = `⏳ ${str}`;
      const isUrgent = remaining < 60 * 60 * 1000 && remaining > 0;
      el.className = `ac-timer ${isUrgent ? "countdown-timer urgent" : "countdown-timer"}`;
      if (remaining <= 0) {
        el.textContent = "🏁 Ended";
        const btn = el.parentElement.querySelector(".ac-bid-btn");
        if (btn) {
          btn.disabled = true;
          btn.style.opacity = "0.4";
          btn.textContent = "Auction Ended";
        }
      }
      if (currentBidItem && currentBidItem.id === item.id) {
        const tl = document.getElementById("bidTimeLeft");
        if (tl) tl.textContent = str;
      }
    });
    updateMockTimers();
  }, 1000);
}

function updateMockTimers() {
  const timers = document.querySelectorAll(".timer");
  const items = auctionItems.slice(0, 3);
  timers.forEach((el, i) => {
    if (items[i])
      el.textContent = "⏳ " + formatTime(items[i].endTime - Date.now());
  });
}

// ============================================================
// BID MODAL — connected to POST /api/place-bid/:id
// ============================================================
function openBidModal(id) {
  const item = auctionItems.find((i) => i.id === id);
  if (!item) return;
  currentBidItem = item;
  document.getElementById("bidItemEmoji").textContent = item.emoji;
  document.getElementById("bidItemName").textContent = item.name;
  document.getElementById("bidCurrentAmt").textContent =
    "P" + item.price.toLocaleString();
  document.getElementById("bidTimeLeft").textContent = formatTime(
    item.endTime - Date.now(),
  );
  document.getElementById("bidInput").value = item.price + 100;
  document.getElementById("bidMsg").textContent = "";
  document.getElementById("bidModal").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeBid() {
  document.getElementById("bidModal").classList.remove("open");
  document.body.style.overflow = "";
  currentBidItem = null;
}
function quickBid(amt) {
  const input = document.getElementById("bidInput");
  input.value = (parseInt(input.value) || 0) + amt;
}
async function placeBid() {
  if (!currentBidItem) return;
  const input = document.getElementById("bidInput");
  const bidAmt = parseInt(input.value);
  const msg = document.getElementById("bidMsg");

  if (!bidAmt || bidAmt <= currentBidItem.price) {
    msg.style.color = "#ff4757";
    msg.textContent = `Bid must be higher than P${currentBidItem.price.toLocaleString()}`;
    return;
  }

  msg.style.color = "#27ae60";
  msg.textContent = "Placing bid...";

  try {
    const data = await apiPlaceBid(currentBidItem.id, "Guest", bidAmt);
    const serverAuction = data.auction;

    // Update local state from server response
    currentBidItem.price = serverAuction.currentBid;
    currentBidItem.bids = serverAuction.bids.length;

    // Update the auction card
    const priceEl = document.getElementById(`price-${currentBidItem.id}`);
    if (priceEl) {
      priceEl.textContent = "P" + serverAuction.currentBid.toLocaleString();
      priceEl.style.transform = "scale(1.2)";
      setTimeout(() => (priceEl.style.transform = "scale(1)"), 300);
    }
    document.getElementById("bidCurrentAmt").textContent =
      "P" + serverAuction.currentBid.toLocaleString();

    const fee = Math.round((bidAmt / 100) * 5);
    msg.textContent = `Bid placed! Fee: P${fee.toLocaleString()} upon winning.`;
    showToast(
      `Bid of P${bidAmt.toLocaleString()} placed on ${currentBidItem.name}!`,
      "orange",
    );
  } catch (e) {
    msg.style.color = "#ff4757";
    msg.textContent = e.message || "Failed to place bid. Try again.";
    showToast(e.message || "Bid failed", "red");
  }
}

// Wire up mock screen "Place Bid" buttons
document.querySelectorAll(".bid-bar").forEach((btn, i) => {
  btn.style.cursor = "pointer";
  btn.addEventListener("click", () => openBidModal(i + 1));
});

// ============================================================
// INIT
// ============================================================
window.addEventListener("DOMContentLoaded", async () => {
  injectNav();
  buildAuctionsSection();
  startAllTimers();

  try {
    await seedServerAuctions();
    renderAuctions();
    showToast("Connected to BiliBid server", "green");
  } catch (e) {
    console.error("Server connection failed:", e);
    document.getElementById("auctionGrid").innerHTML =
      '<div style="color:#ff4757;padding:40px;text-align:center;grid-column:1/-1;">Could not connect to server.</div>';
    showToast("Server offline - start node server.js", "red");
  }
});
