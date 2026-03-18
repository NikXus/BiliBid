// ============================================================
//  BiliBid2.js  v5.0
//  Fixes: guest mode, photo collage, buy-now feed removal,
//  real suggested sellers, messaging usernames, logout reset
// ============================================================
"use strict";

/* ── 1. CONFIG ── */
const API_BASE = "https://bilibid-1.onrender.com";
const SOCKET_URL = "https://bilibid-1.onrender.com";
const IMAGE_BASE = "https://bilibid-1.onrender.com";

/* ── 2. AUTH HELPERS ── */
const getToken = () => localStorage.getItem("bbToken") || "";
const getUserId = () => localStorage.getItem("bbUserId") || "";
const getUsername = () => localStorage.getItem("bbUsername") || "";

function setAuth(token, id, username, avatar = "") {
  localStorage.setItem("bbToken", token);
  localStorage.setItem("bbUserId", id);
  localStorage.setItem("bbUsername", username);
  localStorage.setItem("bbAvatar", avatar);
}
function clearAuth() {
  ["bbToken", "bbUserId", "bbUsername", "bbAvatar"].forEach((k) =>
    localStorage.removeItem(k),
  );
}
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

/* ── 3. API FETCH ── */
async function apiFetch(path, opts = {}) {
  const url = `${API_BASE}/api${path}`;
  try {
    const headers = { ...authHeaders(), ...(opts.headers || {}) };
    if (opts.body instanceof FormData) delete headers["Content-Type"];
    const res = await fetch(url, { ...opts, headers });
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("application/json")) {
      if (res.status === 401) {
        toast("⚠️ Session expired. Please log in.", "error");
        return null;
      }
      return res.ok ? { ok: true } : null;
    }
    const data = await res.json();
    if (res.status === 401) {
      toast("⚠️ Session expired.", "error");
      return null;
    }
    return data;
  } catch (err) {
    console.error("[apiFetch]", url, err.message);
    toast("⚠️ Network error. Check your connection.", "error");
    return null;
  }
}

/* ── 4. SOCKET.IO ── */
let socket = null;
let onlineUsers = {};

function initSocket() {
  if (typeof io === "undefined") {
    console.warn("[Socket] Not loaded");
    return;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1500,
    reconnectionDelayMax: 10000,
    withCredentials: false,
  });

  socket.on("connect", () => {
    console.log("[Socket] Connected:", socket.id);
    const uid = getUserId();
    if (uid) socket.emit("join", uid);
  });
  socket.on("disconnect", (reason) => {
    if (reason === "io server disconnect")
      setTimeout(() => socket.connect(), 1000);
  });
  socket.on("connect_error", (err) =>
    console.error("[Socket] Error:", err.message),
  );

  socket.on("bidPlaced", ({ auctionId, currentBid, bidderName, bids }) => {
    const baEl = document.getElementById(`ba-${auctionId}`);
    const bcEl = document.getElementById(`bc-${auctionId}`);
    if (baEl) baEl.textContent = "₱" + Number(currentBid).toLocaleString();
    if (bcEl) bcEl.textContent = (bids || 0) + " bids";
    const post = cachedPosts.find((p) => p._id === auctionId);
    if (post) post.currentBid = currentBid;
    if (bidderName !== getUsername())
      toast(
        `🔥 ${bidderName} bid ₱${Number(currentBid).toLocaleString()}!`,
        "info",
      );
  });

  /* Remove bought auction from everyone's feed */
  socket.on("auctionEnded", ({ auctionId, reason, buyerName }) => {
    const idx = cachedPosts.findIndex((p) => p._id === auctionId);
    if (idx !== -1) {
      cachedPosts.splice(idx, 1);
      const el = document.getElementById(auctionId);
      if (el) {
        el.style.transition = "opacity .4s";
        el.style.opacity = "0";
        setTimeout(() => el.remove(), 400);
      }
    }
    if (reason === "buynow" && buyerName !== getUsername())
      toast(`⚡ ${buyerName} bought an item!`, "info");
  });

  socket.on("auctionCreated", (auction) => {
    if (auction.sellerId !== getUserId() && getToken()) {
      cachedPosts.unshift(auction);
      timers[auction._id] = Math.max(
        0,
        Math.floor((new Date(auction.endsAt) - Date.now()) / 1000),
      );
      const pg = document.getElementById("page-feed");
      if (pg?.classList.contains("active")) renderFeed();
    }
  });

  socket.on("newMessage", (msg) => {
    const myId = getUserId();
    const senderIdStr = msg.senderId?._id
      ? msg.senderId._id.toString()
      : String(msg.senderId || "");
    if (senderIdStr === myId) return;

    if (currentChatUserId === senderIdStr) {
      const content =
        msg.messageType === "image"
          ? `<img src="${IMAGE_BASE}${msg.imageUrl}" class="chat-img-preview" onclick="openImg('${IMAGE_BASE}${msg.imageUrl}')">`
          : escapeHtml(msg.message);
      appendChatMsg(
        "them",
        content,
        fmtTime(msg.createdAt),
        msg.senderName || "User",
      );
    } else {
      const win = chatWindows.find((w) => w.userId === senderIdStr);
      if (win) win.unread = (win.unread || 0) + 1;
      else
        chatWindows.push({
          userId: senderIdStr,
          username: msg.senderName || "User",
          unread: 1,
          color: rndColor(),
          avatar: msg.senderAvatar || "",
        });
      renderChatHeads();
      toast(
        `💬 ${msg.senderName || "Someone"}: ${msg.message || "[Image]"}`,
        "info",
      );
    }
    addNotifLocal(
      "💬",
      `New message from ${msg.senderName || "User"}`,
      `chat:${senderIdStr}`,
    );
    if (document.getElementById("page-messages")?.classList.contains("active"))
      loadConversations();
  });

  socket.on("messageSent", (msg) =>
    console.log("[Socket] Delivered:", msg._id),
  );
  socket.on("messageError", ({ error }) =>
    toast("⚠️ Message failed: " + error, "error"),
  );
  socket.on("typing", ({ from, username }) => {
    if (from === currentChatUserId) showTyping(username);
  });
  socket.on("stopTyping", ({ from }) => {
    if (from === currentChatUserId) hideTyping();
  });
  socket.on("userOnline", (uid) => {
    onlineUsers[uid] = true;
    updateOnlineIndicators();
    updateChatHeadStatus(uid, true);
  });
  socket.on("userOffline", (uid) => {
    delete onlineUsers[uid];
    updateOnlineIndicators();
    updateChatHeadStatus(uid, false);
  });
  socket.on("onlineUsers", (list) => {
    onlineUsers = {};
    (list || []).forEach((uid) => (onlineUsers[uid] = true));
    updateOnlineIndicators();
    renderChatHeads();
  });
}

function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  onlineUsers = {};
}

function updateOnlineIndicators() {
  document.querySelectorAll("[data-uid]").forEach((el) => {
    const uid = el.getAttribute("data-uid");
    const dot = el.querySelector(".online-dot");
    if (dot)
      dot.style.background = onlineUsers[uid]
        ? "var(--online)"
        : "var(--muted)";
  });
}

function updateChatHeadStatus(uid, online) {
  const win = chatWindows.find((w) => w.userId === uid);
  if (win) {
    win.isOnline = online;
    renderChatHeads();
  }
  const statEl = document.getElementById("chatStat");
  if (currentChatUserId === uid && statEl)
    statEl.innerHTML = online
      ? '<span style="color:var(--online)">● Online</span>'
      : "Last seen recently";
}

/* ── 5. GLOBAL STATE ── */
let walletBal = 0,
  confirmCb = null,
  walletType = "",
  feedFilter = "all";
let likedPosts = {},
  watchedPosts = {},
  notifCount = 0,
  notifs = [];
let cachedPosts = [],
  watchItems = [],
  wonItems = [],
  txList = [];
let myListings = { active: [], ended: [], sold: [] };
let currentChatUserId = "",
  currentChatUsername = "",
  myProfile = {};
let uploadedImageUrls = [],
  timers = {},
  stories = [],
  currentStoryIdx = 0;
let storyTimer = null,
  uploadedStoryUrl = "",
  chatWindows = [],
  followedUsers = {};
let isTyping = false,
  chatTypingTimer = null,
  uploadedAvatarUrl = "";

/* ── 6. HELPERS ── */
const pad = (n) => String(n).padStart(2, "0");
const fmtTime = (d) =>
  new Date(d).toLocaleTimeString("en-PH", {
    hour: "2-digit",
    minute: "2-digit",
  });

function timeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return Math.floor(diff / 60) + "m ago";
  if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
  return Math.floor(diff / 86400) + "d ago";
}

function rndColor() {
  const c = [
    "#7c3aed",
    "#2563eb",
    "#059669",
    "#dc2626",
    "#d97706",
    "#0891b2",
    "#db2777",
    "#065f46",
  ];
  return c[Math.floor(Math.random() * c.length)];
}

function hashColor(str) {
  const c = [
    "#7c3aed",
    "#2563eb",
    "#059669",
    "#b45309",
    "#dc2626",
    "#0891b2",
    "#db2777",
    "#1e40af",
  ];
  let h = 0;
  for (let i = 0; i < str.length; i++)
    h = (h * 31 + str.charCodeAt(i)) & 0xffffffff;
  return c[Math.abs(h) % c.length];
}

function escapeHtml(s) {
  return String(s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}

function openImg(src) {
  const w = window.open("", "_blank");
  if (w)
    w.document.write(
      `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh"><img src="${src}" style="max-width:100%;max-height:100vh"></body></html>`,
    );
}

/* ── 7. COUNTDOWN TIMERS ── */
setInterval(() => {
  cachedPosts.forEach((p) => {
    if (timers[p._id] === undefined) return;
    if (timers[p._id] > 0) timers[p._id]--;
    const el = document.getElementById("tmr-" + p._id);
    if (!el) return;
    const t = timers[p._id],
      h = Math.floor(t / 3600),
      m = Math.floor((t % 3600) / 60),
      s = t % 60;
    el.innerHTML =
      `<div class="time-unit"><div class="time-num">${pad(h)}</div><div class="time-label">hrs</div></div>` +
      `<div class="time-unit"><div class="time-num">${pad(m)}</div><div class="time-label">min</div></div>` +
      `<div class="time-unit"><div class="time-num">${pad(s)}</div><div class="time-label">sec</div></div>`;
  });
}, 1000);

/* ── 8. NAVIGATION ── */
function navigate(page) {
  document
    .querySelectorAll(".page")
    .forEach((p) => p.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((n) => n.classList.remove("active"));
  document.getElementById("page-" + page)?.classList.add("active");
  document.getElementById("nav-" + page)?.classList.add("active");
  const loaders = {
    feed: loadFeed,
    "my-auctions": () => loadMyAuctions("active"),
    watchlist: loadWatchlist,
    won: loadWon,
    notifications: loadNotifications,
    wallet: loadWallet,
    profile: loadProfile,
    messages: loadConversations,
  };
  if (loaders[page]) loaders[page]();
  window.scrollTo(0, 0);
}

/* ── 9. STORIES ── */
async function loadStories() {
  if (!getToken()) {
    stories = [];
    renderStoriesBar();
    return;
  }
  const data = await apiFetch("/stories");
  stories = Array.isArray(data) ? data : [];
  renderStoriesBar();
}

function renderStoriesBar() {
  const bar = document.getElementById("storiesBar");
  if (!bar) return;
  if (!getToken()) {
    bar.innerHTML = "";
    return;
  }

  const myStory = `<div class="story-item" onclick="openPostStory()">
    <div class="story-ring" style="background:var(--surface3);padding:2px">
      <div class="story-inner" style="background:linear-gradient(135deg,var(--blue),var(--accent));font-size:28px">＋</div>
    </div><div class="story-name">Your Story</div></div>`;

  const items = stories
    .map((s, i) => {
      const av = (s.username || "U").slice(0, 2).toUpperCase();
      const inner = s.imageUrl
        ? `<img src="${IMAGE_BASE}${s.imageUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
        : av;
      return `<div class="story-item" onclick="openStory(${i})">
      <div class="story-ring${s.isLive ? " live-ring" : ""}"><div class="story-inner">${inner}</div></div>
      <div class="story-name">${escapeHtml(s.username || "User")}</div>
      ${s.isLive ? '<div class="story-label">LIVE</div>' : ""}
    </div>`;
    })
    .join("");
  bar.innerHTML = myStory + items;
}

function openStory(i) {
  currentStoryIdx = i;
  const s = stories[i];
  if (!s) return;
  const viewer = document.getElementById("storyViewer");
  if (!viewer) return;
  document.getElementById("svUsername").textContent = s.username || "User";
  document.getElementById("svTime").textContent = timeAgo(s.createdAt);
  document.getElementById("svAvatar").textContent = (s.username || "U")
    .slice(0, 2)
    .toUpperCase();
  const cnt = document.getElementById("svContent");
  if (cnt) {
    if (s.imageUrl)
      cnt.innerHTML = `<img src="${IMAGE_BASE}${s.imageUrl}" style="max-width:100%;max-height:70vh;border-radius:16px;object-fit:contain">`;
    else
      cnt.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;min-height:300px;font-size:22px;color:var(--text);text-align:center;padding:40px;background:linear-gradient(135deg,rgba(37,99,235,.2),rgba(245,158,11,.1));border-radius:20px;border:1px solid var(--border)">${escapeHtml(s.text || "")}</div>`;
  }
  document.getElementById("svReplyInput").value = "";
  viewer.classList.add("open");
  startStoryProgress();
  if (getToken())
    apiFetch(`/stories/${s._id}/view`, { method: "POST" }).catch(() => {});
}

function startStoryProgress() {
  const fill = document.getElementById("svProgressFill");
  if (!fill) return;
  fill.style.transition = "none";
  fill.style.width = "0%";
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      fill.style.transition = "width 5s linear";
      fill.style.width = "100%";
    }),
  );
  if (storyTimer) clearTimeout(storyTimer);
  storyTimer = setTimeout(() => nextStory(), 5200);
}
function nextStory() {
  currentStoryIdx < stories.length - 1
    ? openStory(currentStoryIdx + 1)
    : closeStoryViewer();
}
function prevStory() {
  currentStoryIdx > 0 ? openStory(currentStoryIdx - 1) : null;
}
function closeStoryViewer() {
  document.getElementById("storyViewer")?.classList.remove("open");
  if (storyTimer) clearTimeout(storyTimer);
}

async function replyToStory() {
  const text = document.getElementById("svReplyInput")?.value?.trim();
  if (!text) return;
  if (!getToken()) {
    toast("⚠️ Please log in", "error");
    return;
  }
  const s = stories[currentStoryIdx];
  if (s?.userId) {
    closeStoryViewer();
    openChatPopup(String(s.userId), s.username || "User");
    setTimeout(async () => {
      const inp = document.getElementById("chatIn");
      if (inp) {
        inp.value = `↩️ Replied to your story: ${text}`;
        await sendMsg();
      }
    }, 400);
  } else {
    toast("💬 Reply sent!", "success");
    closeStoryViewer();
  }
}

function openPostStory() {
  if (!getToken()) {
    toast("⚠️ Please log in to post a story", "error");
    return;
  }
  document.getElementById("postStoryModal")?.classList.add("open");
}
function closePostStory() {
  document.getElementById("postStoryModal")?.classList.remove("open");
  const el = document.getElementById("storyText");
  if (el) el.value = "";
  uploadedStoryUrl = "";
  const pi = document.getElementById("storyImgPreview");
  if (pi) pi.innerHTML = "";
}
async function handleStoryImgUpload(input) {
  if (!input.files?.length) return;
  const fd = new FormData();
  fd.append("images", input.files[0]);
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json();
    if (data.urls?.length) {
      uploadedStoryUrl = data.urls[0];
      const pi = document.getElementById("storyImgPreview");
      if (pi)
        pi.innerHTML = `<img src="${IMAGE_BASE}${uploadedStoryUrl}" style="max-width:200px;border-radius:12px;margin-top:10px">`;
    }
  } catch {
    toast("⚠️ Image upload failed", "error");
  }
}
async function submitStory() {
  const text = document.getElementById("storyText")?.value?.trim() || "";
  if (!text && !uploadedStoryUrl) {
    toast("⚠️ Add text or an image", "error");
    return;
  }
  const body = { text };
  if (uploadedStoryUrl) body.imageUrl = uploadedStoryUrl;
  const res = await apiFetch("/stories", {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (res?._id || res?.ok) {
    toast("✅ Story posted!", "success");
    closePostStory();
    await loadStories();
  } else {
    stories.unshift({
      _id: Date.now() + "",
      username: getUsername(),
      text,
      imageUrl: uploadedStoryUrl,
      createdAt: new Date(),
    });
    renderStoriesBar();
    toast("✅ Story posted!", "success");
    closePostStory();
  }
}

/* ── 10. FEED ── */
async function loadFeed() {
  const c = document.getElementById("postsContainer");

  /* Guest mode: show login prompt, no auctions */
  if (!getToken()) {
    cachedPosts = [];
    if (c)
      c.innerHTML = `<div class="card" style="text-align:center;padding:48px 24px;color:var(--muted2)">
      <div style="font-size:52px;margin-bottom:16px">🏷️</div>
      <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:20px;color:var(--text);margin-bottom:8px">Discover Live Auctions</div>
      <div style="font-size:14px;margin-bottom:24px;max-width:320px;margin-left:auto;margin-right:auto">Log in to browse deals, place bids, and buy items from sellers across the Philippines.</div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="btn-auth" onclick="openAuthModal('login')">🔑 Log In</button>
        <button class="btn-auth primary" onclick="openAuthModal('register')">🚀 Sign Up Free</button>
      </div>
    </div>`;
    await loadStories();
    return;
  }

  if (c) c.innerHTML = '<div class="loading-state">Loading auctions…</div>';
  let path = "/auctions?status=active";
  if (
    feedFilter !== "all" &&
    feedFilter !== "following" &&
    feedFilter !== "ending"
  )
    path += `&category=${encodeURIComponent(feedFilter)}`;

  const data = await apiFetch(path);
  let posts = Array.isArray(data) ? data : [];

  if (feedFilter === "ending")
    posts.sort((a, b) => new Date(a.endsAt) - new Date(b.endsAt));
  if (feedFilter === "following") {
    const followed = Object.keys(followedUsers).filter((k) => followedUsers[k]);
    posts = posts.filter((p) => followed.includes(String(p.sellerId)));
  }

  cachedPosts = posts.filter((p) => p.status === "active");
  cachedPosts.forEach((p) => {
    timers[p._id] = Math.max(
      0,
      Math.floor((new Date(p.endsAt) - Date.now()) / 1000),
    );
    likedPosts[p._id] =
      Array.isArray(p.likes) &&
      p.likes.some(
        (l) => String(l) === getUserId() || String(l?._id) === getUserId(),
      );
  });

  const wl = await apiFetch("/watchlist");
  if (Array.isArray(wl)) wl.forEach((w) => (watchedPosts[w._id] = true));

  renderFeed();
  await loadStories();
}

function renderFeed() {
  const c = document.getElementById("postsContainer");
  if (!c) return;
  if (!cachedPosts.length) {
    c.innerHTML = `<div class="card" style="text-align:center;color:var(--muted2);padding:40px">
      <div style="font-size:48px;margin-bottom:12px">🔍</div>
      <div>No auctions found. Be the first to post!</div>
      <button class="btn-submit" style="margin-top:16px" onclick="openModal()">＋ Post Auction</button>
    </div>`;
    return;
  }
  c.innerHTML = cachedPosts.map(buildPost).join("");
}

/* ── Photo collage builder ── */
function buildPhotoCollage(images, auctionId) {
  if (!images?.length)
    return `<span style="font-size:64px;line-height:240px">🏷️</span>`;

  const srcs = images
    .slice(0, 5)
    .map((s) => (s.startsWith("http") ? s : `${IMAGE_BASE}${s}`));
  const n = srcs.length;
  const extra = images.length - 5;
  const openFn = (src) => `onclick="openImg('${src}')"`;
  const img = (src, style = "") =>
    `<img src="${src}" ${openFn(src)} style="width:100%;height:100%;object-fit:cover;cursor:zoom-in;${style}" onerror="this.style.display='none'">`;

  if (n === 1) return img(srcs[0]);

  if (n === 2)
    return `<div style="display:grid;grid-template-columns:1fr 1fr;height:240px;gap:2px">
    ${srcs.map((s) => `<div style="overflow:hidden">${img(s)}</div>`).join("")}
  </div>`;

  if (n === 3)
    return `<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:240px;gap:2px">
    <div style="grid-row:span 2;overflow:hidden">${img(srcs[0])}</div>
    <div style="overflow:hidden">${img(srcs[1])}</div>
    <div style="overflow:hidden">${img(srcs[2])}</div>
  </div>`;

  if (n === 4)
    return `<div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;height:240px;gap:2px">
    ${srcs.map((s) => `<div style="overflow:hidden">${img(s)}</div>`).join("")}
  </div>`;

  // 5+
  return `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:140px 100px;height:240px;gap:2px">
    <div style="grid-column:span 2;overflow:hidden">${img(srcs[0])}</div>
    <div style="overflow:hidden">${img(srcs[1])}</div>
    <div style="overflow:hidden">${img(srcs[2])}</div>
    <div style="overflow:hidden">${img(srcs[3])}</div>
    <div style="overflow:hidden;position:relative">${img(srcs[4])}${extra > 0 ? `<div ${openFn(srcs[4])} style="position:absolute;inset:0;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:800;cursor:zoom-in">+${extra}</div>` : ""}</div>
  </div>`;
}

function buildPost(p) {
  const bid = p.currentBid || p.startingPrice || 0;
  const bids = p.bids?.length || 0;
  const liked = likedPosts[p._id] || false;
  const watched = watchedPosts[p._id] || false;
  const secs = timers[p._id] || 0;
  const ending = secs > 0 && secs < 3600;
  const avColor = hashColor(p.sellerId || p.sellerName || "");
  const progPct =
    p.startingPrice > 0
      ? Math.min(
          100,
          Math.round(((bid - p.startingPrice) / Math.max(1, bid)) * 100),
        )
      : 0;
  const comments = p.comments || [];

  const collage = buildPhotoCollage(p.images, p._id);
  const avContent = p.sellerAvatar
    ? `<img src="${IMAGE_BASE}${p.sellerAvatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : (p.sellerName || "S").slice(0, 2).toUpperCase();

  return `<div class="auction-post" id="${p._id}">
    <div class="post-header">
      <div class="post-avatar" style="background:${avColor}" onclick="openUserProfile('${p.sellerId || ""}','${escapeHtml(p.sellerName || "Seller")}')" data-uid="${p.sellerId}">
        ${avContent}
        <span class="online-dot" style="position:absolute;bottom:0;right:0;width:10px;height:10px;border-radius:50%;background:${onlineUsers[p.sellerId] ? "var(--online)" : "var(--muted)"};border:2px solid var(--bg)"></span>
      </div>
      <div class="post-meta">
        <div class="post-author">
          <span class="clickable-name" onclick="openUserProfile('${p.sellerId || ""}','${escapeHtml(p.sellerName || "Seller")}')">${escapeHtml(p.sellerName || "Seller")}</span>
          <span class="seller-badge">Seller</span>
        </div>
        <div class="post-time">${escapeHtml(p.category || "")} · ${timeAgo(p.createdAt)}</div>
      </div>
      <div class="post-menu-wrap">
        <div class="post-menu" onclick="toggleMenu('${p._id}')">···</div>
        <div class="post-menu-dropdown" id="menu-${p._id}">
          <div class="menu-opt" onclick="closeMenus();openUserProfile('${p.sellerId || ""}','${escapeHtml(p.sellerName || "Seller")}')">👤 View Profile</div>
          <div class="menu-opt" onclick="closeMenus();openChatPopup('${p.sellerId || ""}','${escapeHtml(p.sellerName || "Seller")}')">💬 Message Seller</div>
          <div class="menu-opt" onclick="closeMenus();doWatch('${p._id}')">👁️ ${watched ? "Unwatch" : "Watch Item"}</div>
          <div class="menu-opt" onclick="closeMenus();doShare('${p._id}')">🔗 Share Listing</div>
          <div class="menu-opt danger" onclick="closeMenus();reportItem('${p._id}')">🚩 Report</div>
        </div>
      </div>
    </div>

    <div class="post-product-img" style="height:auto;min-height:${p.images?.length > 1 ? "auto" : "240px"}">
      ${collage}
      ${ending ? '<div class="img-overlay" style="position:absolute;top:12px;right:12px"><div class="live-dot"></div>Ending Soon!</div>' : ""}
    </div>

    <div class="post-body">
      <div class="post-title">${escapeHtml(p.title)}</div>
      <div class="post-desc">${escapeHtml(p.description || "")}</div>
      <div class="post-tags">
        ${[p.category, p.condition]
          .filter(Boolean)
          .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
          .join("")}
        ${p.shipping ? `<span class="tag">🚚 ${escapeHtml(p.shipping)}</span>` : ""}
      </div>
      <div class="bid-section">
        <div class="bid-row">
          <div>
            <div class="bid-label">Current Bid</div>
            <div class="bid-amount" id="ba-${p._id}">₱${bid.toLocaleString()}</div>
            <div class="bid-count" id="bc-${p._id}">${bids} bids${watched ? " · 👁️ Watching" : ""}</div>
          </div>
          <div>
            <div class="bid-label">Time Left</div>
            <div class="timer" id="tmr-${p._id}">
              <div class="time-unit"><div class="time-num">${pad(Math.floor(secs / 3600))}</div><div class="time-label">hrs</div></div>
              <div class="time-unit"><div class="time-num">${pad(Math.floor((secs % 3600) / 60))}</div><div class="time-label">min</div></div>
              <div class="time-unit"><div class="time-num">${pad(secs % 60)}</div><div class="time-label">sec</div></div>
            </div>
          </div>
        </div>
        <div class="bid-progress"><div class="bid-progress-fill" style="width:${progPct}%;${ending ? "background:linear-gradient(90deg,var(--red),var(--gold))" : ""}"></div></div>
        <div style="font-size:11px;color:${ending ? "var(--red)" : "var(--muted2)"};margin-top:6px;font-weight:${ending ? 700 : 400}">
          ${ending ? "⚠️ Ending very soon!" : "Starting: ₱" + (p.startingPrice || 0).toLocaleString()}
        </div>
      </div>
      <div class="bid-input-row" style="margin-top:14px">
        <input class="bid-input" type="number" id="bi-${p._id}" placeholder="Min ₱${(bid + 100).toLocaleString()}">
        <button class="bid-btn${ending ? " gold-btn" : ""}" onclick="placeBid('${p._id}')">🔥 ${ending ? "⚡ Bid NOW!" : "Place Bid"}</button>
        ${p.buyNowPrice ? `<button class="bid-btn gold-btn" onclick="buyNow('${p._id}',${p.buyNowPrice})" style="white-space:nowrap">⚡ Buy ₱${p.buyNowPrice.toLocaleString()}</button>` : ""}
      </div>
    </div>

    <div class="post-actions">
      <button class="post-action${liked ? " liked" : ""}" id="like-${p._id}" onclick="doLike('${p._id}')">❤️ <span id="lc-${p._id}">${p.likes?.length || 0}</span></button>
      <button class="post-action" onclick="toggleComments('${p._id}')">💬 <span id="cc-${p._id}">${comments.length}</span> Comments</button>
      <button class="post-action${watched ? " watching" : ""}" id="wbtn-${p._id}" onclick="doWatch('${p._id}')">👁️ ${watched ? "Watching" : "Watch"}</button>
      <button class="post-action" onclick="doShare('${p._id}')">↗️ Share</button>
    </div>

    <div class="comments-section" id="cmts-${p._id}">
      <div class="comment-input-row">
        <div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--gold));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;flex-shrink:0">
          ${getUsername().slice(0, 2).toUpperCase() || "ME"}
        </div>
        <input class="comment-input" id="cin-${p._id}" placeholder="Write a comment…" onkeydown="if(event.key==='Enter')addComment('${p._id}')">
        <button class="comment-send" onclick="addComment('${p._id}')">➤</button>
      </div>
      <div id="clist-${p._id}">${comments.map(buildCommentHtml).join("")}</div>
    </div>
  </div>`;
}

function buildCommentHtml(c) {
  return `<div class="comment-item">
    <div class="comment-av" style="background:${hashColor(c.username || "")}">${escapeHtml((c.username || "U").slice(0, 2).toUpperCase())}</div>
    <div class="comment-bubble">
      <div class="comment-author">${escapeHtml(c.username || "User")}</div>
      <div class="comment-text">${escapeHtml(c.text)}</div>
      <div class="comment-actions">
        <button class="comment-action" onclick="toast('👍 Liked!','info')">👍 Like</button>
        <span style="font-size:11px;color:var(--muted)">${timeAgo(c.createdAt)}</span>
      </div>
    </div>
  </div>`;
}

function setFilter(el, f) {
  document
    .querySelectorAll(".filter-tab")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  feedFilter = f;
  loadFeed();
}
function filterCat(cat) {
  navigate("feed");
  feedFilter = cat;
  document
    .querySelectorAll(".filter-tab")
    .forEach((t) => t.classList.remove("active"));
  loadFeed();
  toast(`🔍 Showing ${cat}`, "info");
}
function reportItem(id) {
  toast("✅ Reported. We'll review this listing.", "info");
}

/* ── 11. BID / LIKE / WATCH ── */
async function placeBid(pid) {
  if (!getToken()) {
    toast("⚠️ Please log in to bid.", "error");
    return;
  }
  const el = document.getElementById("bi-" + pid);
  const val = parseInt(el?.value || "");
  const post = cachedPosts.find((p) => p._id === pid);
  if (!post) return;
  if (!val || isNaN(val)) {
    toast("⚠️ Enter a bid amount!", "error");
    return;
  }
  if (val <= (post.currentBid || post.startingPrice || 0)) {
    toast(
      `⚠️ Bid must be higher than ₱${(post.currentBid || post.startingPrice).toLocaleString()}`,
      "error",
    );
    return;
  }
  showConfirm(
    "🔥",
    "Place Bid",
    `Bid <strong>₱${val.toLocaleString()}</strong> on this item?`,
    "Place Bid",
    false,
    async () => {
      toast("⏳ Placing bid…", "info");
      const res = await apiFetch(`/auctions/${pid}/bid`, {
        method: "POST",
        body: JSON.stringify({ bidAmount: val }),
      });
      if (!res) return;
      if (res.message && !res.auction) {
        toast("⚠️ " + res.message, "error");
        if (res.message.toLowerCase().includes("insufficient"))
          navigate("wallet");
        return;
      }
      post.currentBid = val;
      if (res.auction?.bids) post.bids = res.auction.bids;
      const baEl = document.getElementById("ba-" + pid);
      if (baEl) baEl.textContent = "₱" + val.toLocaleString();
      const bcEl = document.getElementById("bc-" + pid);
      if (bcEl)
        bcEl.textContent =
          (post.bids?.length || 0) +
          " bids" +
          (watchedPosts[pid] ? " · 👁️ Watching" : "");
      if (el) {
        el.value = "";
        el.placeholder = "Min ₱" + (val + 100).toLocaleString();
      }
      walletBal = Math.max(0, walletBal - val);
      syncWalletDisplay();
      toast("🔥 Bid of ₱" + val.toLocaleString() + " placed!", "success");
      addNotifLocal(
        "🔥",
        `You placed a bid of ₱${val.toLocaleString()}!`,
        "won",
      );
    },
  );
}

async function buyNow(pid, price) {
  if (!getToken()) {
    toast("⚠️ Please log in.", "error");
    return;
  }
  showConfirm(
    "⚡",
    "Buy Now!",
    `Buy this item for <strong>₱${price.toLocaleString()}</strong>?`,
    "Buy Now!",
    false,
    async () => {
      const res = await apiFetch(`/auctions/${pid}/buynow`, {
        method: "POST",
        body: JSON.stringify({ price }),
      });
      if (!res) return;
      if (res.message && !res.auction) {
        toast("⚠️ " + res.message, "error");
        return;
      }

      /* Remove from local feed immediately */
      const idx = cachedPosts.findIndex((p) => p._id === pid);
      if (idx !== -1) {
        cachedPosts.splice(idx, 1);
        renderFeed();
      }

      toast("🎉 Purchased! Check Won Auctions.", "success");
      walletBal = Math.max(0, walletBal - price);
      syncWalletDisplay();
      navigate("won");
    },
  );
}

async function doLike(pid) {
  if (!getToken()) {
    toast("⚠️ Please log in to like.", "error");
    return;
  }
  const res = await apiFetch(`/auctions/${pid}/like`, { method: "POST" });
  if (!res) return;
  likedPosts[pid] = res.liked;
  const lcEl = document.getElementById("lc-" + pid);
  if (lcEl) lcEl.textContent = res.likeCount;
  document.getElementById("like-" + pid)?.classList.toggle("liked", res.liked);
  toast(res.liked ? "❤️ Liked!" : "💔 Unliked", "info");
}

async function doWatch(pid) {
  if (!getToken()) {
    toast("⚠️ Please log in to watch.", "error");
    return;
  }
  const res = await apiFetch(`/auctions/${pid}/watch`, { method: "POST" });
  if (!res) return;
  watchedPosts[pid] = res.watching;
  const btn = document.getElementById("wbtn-" + pid);
  if (btn) {
    btn.className = "post-action" + (res.watching ? " watching" : "");
    btn.innerHTML = "👁️ " + (res.watching ? "Watching" : "Watch");
  }
  const bcEl = document.getElementById("bc-" + pid);
  const post = cachedPosts.find((p) => p._id === pid);
  if (bcEl && post)
    bcEl.textContent =
      (post.bids?.length || 0) +
      " bids" +
      (res.watching ? " · 👁️ Watching" : "");
  toast(
    res.watching ? "👁️ Added to Watchlist!" : "Removed from Watchlist",
    "info",
  );
  updateWatchBadge();
}

function doShare(pid) {
  const url = pid ? `${window.location.href}#${pid}` : window.location.href;
  if (navigator.clipboard?.writeText)
    navigator.clipboard.writeText(url).catch(() => {});
  toast("🔗 Link copied to clipboard!", "success");
}

function toggleMenu(pid) {
  closeMenus();
  document.getElementById("menu-" + pid)?.classList.toggle("open");
}
function closeMenus() {
  document
    .querySelectorAll(".post-menu-dropdown")
    .forEach((m) => m.classList.remove("open"));
}
document.addEventListener("click", (e) => {
  if (!e.target.closest(".post-menu-wrap")) closeMenus();
});

function updateWatchBadge() {
  const count = Object.values(watchedPosts).filter(Boolean).length;
  const wb = document.getElementById("watchBadge");
  if (wb) {
    wb.textContent = count;
    wb.style.display = count > 0 ? "" : "none";
  }
}

/* ── 12. COMMENTS ── */
function toggleComments(pid) {
  const el = document.getElementById("cmts-" + pid);
  if (!el) return;
  el.classList.toggle("open");
  if (el.classList.contains("open"))
    document.getElementById("cin-" + pid)?.focus();
}

async function addComment(pid) {
  if (!getToken()) {
    toast("⚠️ Please log in to comment.", "error");
    return;
  }
  const input = document.getElementById("cin-" + pid);
  const text = input?.value?.trim();
  if (!text) return;
  const res = await apiFetch(`/auctions/${pid}/comment`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  if (!res?.comments) return;
  const list = document.getElementById("clist-" + pid);
  if (list) list.innerHTML = res.comments.map(buildCommentHtml).join("");
  const ccEl = document.getElementById("cc-" + pid);
  if (ccEl) ccEl.textContent = res.comments.length;
  const post = cachedPosts.find((p) => p._id === pid);
  if (post) post.comments = res.comments;
  input.value = "";
  toast("💬 Comment posted!", "success");
}

/* ── 13. FOLLOW ── */
async function followUser(userId, username) {
  if (!getToken()) {
    toast("⚠️ Please log in", "error");
    return false;
  }
  if (userId === getUserId()) {
    toast("⚠️ You cannot follow yourself", "error");
    return false;
  }
  const res = await apiFetch(`/users/${userId}/follow`, { method: "POST" });
  if (res === null) return followedUsers[userId];
  followedUsers[userId] = res.following;
  toast(
    res.following ? `✅ Now following ${username}!` : `Unfollowed ${username}`,
    res.following ? "success" : "info",
  );
  return res.following;
}

/* ── 14. USER PROFILE MODAL ── */
async function openUserProfile(userId, username) {
  if (!userId) {
    toast("⚠️ User not found", "error");
    return;
  }
  const modal = document.getElementById("userProfileModal");
  if (!modal) return;

  document.getElementById("upUsername").textContent = username || "Loading...";
  document.getElementById("upHandle").textContent =
    "@" + (username || "user").toLowerCase();
  document.getElementById("upBio").textContent = "Loading profile…";
  document.getElementById("upAvatar").textContent = (username || "U")
    .slice(0, 2)
    .toUpperCase();
  document.getElementById("upListings").innerHTML =
    '<div class="loading-state">Loading…</div>';
  document.getElementById("upReviews").innerHTML = "";

  const followBtn = document.getElementById("upFollowBtn");
  if (followBtn) {
    const alreadyFollowing = followedUsers[userId];
    followBtn.textContent = alreadyFollowing ? "✓ Following" : "+ Follow";
    followBtn.style.background = alreadyFollowing ? "var(--surface3)" : "";
    followBtn.onclick = async () => {
      const nowFollowing = await followUser(userId, username);
      followBtn.textContent = nowFollowing ? "✓ Following" : "+ Follow";
      followBtn.style.background = nowFollowing ? "var(--surface3)" : "";
    };
  }
  const msgBtn = document.getElementById("upMsgBtn");
  if (msgBtn)
    msgBtn.onclick = () => {
      closeUserProfile();
      openChatPopup(userId, username);
    };

  modal.classList.add("open");

  const [userData, listings, revData] = await Promise.all([
    apiFetch(`/users/${userId}`),
    apiFetch(`/auctions?sellerId=${userId}&status=active`),
    apiFetch(`/reviews/${userId}`),
  ]);

  if (userData) {
    document.getElementById("upUsername").textContent =
      userData.username || username;
    document.getElementById("upHandle").textContent =
      "@" + (userData.username || "").toLowerCase();
    document.getElementById("upBio").textContent =
      userData.bio || "No bio yet.";
    document.getElementById("upAvatar").textContent = (userData.username || "U")
      .slice(0, 2)
      .toUpperCase();
    document.getElementById("upFollowers").textContent =
      userData.followersCount || 0;
    document.getElementById("upFollowing").textContent =
      userData.followingCount || 0;
    document.getElementById("upListingCount").textContent =
      userData.listingsCount || 0;
    if (userData.avatar) {
      const avEl = document.getElementById("upAvatar");
      if (avEl)
        avEl.innerHTML = `<img src="${IMAGE_BASE}${userData.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    }
    if (userData.isFollowing !== undefined) {
      followedUsers[userId] = userData.isFollowing;
      if (followBtn) {
        followBtn.textContent = userData.isFollowing
          ? "✓ Following"
          : "+ Follow";
        followBtn.style.background = userData.isFollowing
          ? "var(--surface3)"
          : "";
      }
    }
  }

  const listEl = document.getElementById("upListings");
  if (listEl) {
    const items = Array.isArray(listings) ? listings.slice(0, 4) : [];
    listEl.innerHTML = items.length
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">${items
          .map(
            (item) => `
          <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;cursor:pointer" onclick="closeUserProfile()">
            <div style="font-size:11px;font-weight:700;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(item.title)}</div>
            <div style="color:var(--gold);font-weight:700;font-size:14px">₱${(item.currentBid || item.startingPrice || 0).toLocaleString()}</div>
            <div style="font-size:10px;color:var(--muted2);margin-top:4px">${item.bids?.length || 0} bids</div>
          </div>`,
          )
          .join("")}</div>`
      : '<div style="color:var(--muted2);font-size:13px;text-align:center;padding:16px">No active listings.</div>';
  }

  const reviews = revData?.reviews || [];
  renderUserProfileReviews(
    userId,
    reviews,
    parseFloat(revData?.averageRating) || 0,
  );
}

function renderUserProfileReviews(targetUserId, reviews, avg) {
  const c = document.getElementById("upReviews");
  if (!c) return;
  const stars = (n) =>
    "⭐".repeat(Math.round(n)) + "☆".repeat(Math.max(0, 5 - Math.round(n)));
  let html = "";
  if (avg > 0)
    html += `<div style="background:var(--surface2);border-radius:12px;padding:12px;margin-bottom:14px;border:1px solid var(--border);text-align:center">
    <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:32px;color:var(--gold)">${avg.toFixed(1)}</div>
    <div style="font-size:14px">${stars(avg)}</div><div style="font-size:11px;color:var(--muted2)">${reviews.length} reviews</div></div>`;

  if (!reviews.length)
    html +=
      '<div style="color:var(--muted2);font-size:13px;text-align:center;padding:16px">No reviews yet.</div>';
  else
    html += reviews
      .slice(0, 3)
      .map(
        (r) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:8px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <div style="width:32px;height:32px;border-radius:50%;background:${hashColor(r.reviewerName || "")};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff">${(r.reviewerName || "U").slice(0, 2).toUpperCase()}</div>
        <div><div style="font-weight:700;font-size:12px">${escapeHtml(r.reviewerName || "User")}</div><div style="font-size:10px;color:var(--muted2)">${timeAgo(r.createdAt)}</div></div>
        <div style="margin-left:auto;font-size:12px">${stars(r.rating)}</div>
      </div>
      <div style="font-size:12px;color:var(--muted2)">${escapeHtml(r.comment || "")}</div>
    </div>`,
      )
      .join("");

  if (getToken() && targetUserId !== getUserId()) {
    html += `<div style="margin-top:14px;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:14px">
      <div style="font-weight:700;font-size:13px;margin-bottom:10px">Leave a Review</div>
      <div id="reviewStars" style="display:flex;gap:6px;margin-bottom:10px">
        ${[1, 2, 3, 4, 5].map((n) => `<span onclick="setReviewRating(${n},'${targetUserId}')" style="font-size:24px;cursor:pointer" id="rstar-${n}">☆</span>`).join("")}
      </div>
      <textarea id="reviewComment" class="form-textarea" style="min-height:60px;margin-bottom:10px" placeholder="Share your experience with this seller…"></textarea>
      <button class="btn-submit" style="width:100%;padding:10px" onclick="submitReview('${targetUserId}')">Submit Review</button>
    </div>`;
  }
  c.innerHTML = html;
}

let reviewRating = 0;
function setReviewRating(n) {
  reviewRating = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById("rstar-" + i);
    if (el) el.textContent = i <= n ? "⭐" : "☆";
  }
}

async function submitReview(userId) {
  if (!reviewRating) {
    toast("⚠️ Select a star rating", "error");
    return;
  }
  const comment = document.getElementById("reviewComment")?.value?.trim() || "";
  if (!comment) {
    toast("⚠️ Add a comment", "error");
    return;
  }
  const res = await apiFetch(`/reviews/${userId}`, {
    method: "POST",
    body: JSON.stringify({ rating: reviewRating, comment }),
  });
  if (res) {
    toast("⭐ Review submitted!", "success");
    reviewRating = 0;
    openUserProfile(
      userId,
      document.getElementById("upUsername")?.textContent || "",
    );
  }
}

function closeUserProfile() {
  document.getElementById("userProfileModal")?.classList.remove("open");
}

/* ── 15. MY AUCTIONS ── */
async function loadMyAuctions(tab) {
  const c = document.getElementById("myAuctContent");
  if (c) c.innerHTML = '<div class="loading-state">Loading…</div>';
  if (!getToken()) {
    renderMyAuct(tab);
    return;
  }
  const data = await apiFetch("/auctions/user/mine");
  if (!Array.isArray(data)) {
    if (c)
      c.innerHTML = '<div class="loading-state">Could not load auctions.</div>';
    return;
  }
  const now = Date.now();
  myListings.active = data.filter(
    (a) => a.status === "active" && new Date(a.endsAt) > now,
  );
  myListings.ended = data.filter((a) => a.status === "ended" && !a.winnerId);
  myListings.sold = data.filter((a) => a.status === "ended" && a.winnerId);
  renderMyAuct(tab);
  renderSidebarListings();
}

function renderSidebarListings() {
  const c = document.getElementById("sidebarListings");
  if (!c) return;
  if (!myListings.active.length) {
    c.innerHTML =
      '<div style="font-size:12px;color:var(--muted2);padding:8px">No active listings.</div>';
    return;
  }
  c.innerHTML = myListings.active
    .slice(0, 3)
    .map((item) => {
      const bid = item.currentBid || item.startingPrice || 0;
      return `<div class="my-auction-item" onclick="navigate('my-auctions')">
      <div class="auction-thumb">🏷️</div>
      <div style="flex:1;min-width:0">
        <div class="auction-name">${escapeHtml(item.title)}</div>
        <div class="auction-price">₱${bid.toLocaleString()}</div>
        <div class="auction-status status-live">● Live · ${item.bids?.length || 0} bids</div>
      </div>
    </div>`;
    })
    .join("");
}

function renderMyAuct(tab) {
  const items = myListings[tab] || [];
  const c = document.getElementById("myAuctContent");
  if (!c) return;
  if (!items.length) {
    c.innerHTML = `<div class="card" style="text-align:center;color:var(--muted2)">
      <div style="font-size:48px;margin-bottom:12px">📦</div><div>No ${tab} listings yet.</div>
      <button class="btn-submit" style="margin-top:16px" onclick="openModal()">＋ Post Auction</button>
    </div>`;
    return;
  }
  c.innerHTML = items
    .map((item, i) => {
      const price =
        "₱" + (item.currentBid || item.startingPrice || 0).toLocaleString();
      const bidCnt = item.bids?.length || 0;
      let actions = "";
      if (tab === "active")
        actions = `<button class="listing-action-btn" onclick="editAuction('${item._id}')">✏️ Edit</button>
      <button class="listing-action-btn" onclick="toast('📊 ${bidCnt} bids on this item','info')">📊 ${bidCnt} Bids</button>
      <button class="listing-action-btn danger" onclick="deleteAuction('${item._id}',${i})">🗑️ Delete</button>`;
      else if (tab === "ended")
        actions = `<button class="listing-action-btn" onclick="openModal()">🔄 Relist</button>`;
      else
        actions = `<button class="listing-action-btn" onclick="openTracking('${item._id}')">📦 Track</button>
      <button class="listing-action-btn" onclick="openUserProfile('${item.winnerId || ""}','${escapeHtml(item.winnerName || "Winner")}')">⭐ Review Buyer</button>`;
      return `<div class="card" style="display:flex;gap:14px;align-items:center;padding:14px">
      <div style="width:56px;height:56px;border-radius:12px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden">
        ${item.images?.length ? `<img src="${item.images[0].startsWith("http") ? item.images[0] : IMAGE_BASE + item.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : "🏷️"}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px">${escapeHtml(item.title)}</div>
        <div style="color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:15px">${price}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">${bidCnt} bids · ${escapeHtml(item.category || "")}</div>
        <div class="listing-actions">${actions}</div>
      </div>
    </div>`;
    })
    .join("");
}

async function deleteAuction(id, idx) {
  showConfirm(
    "🗑️",
    "Delete Listing",
    "Delete this auction? This cannot be undone.",
    "Delete",
    true,
    async () => {
      const res = await apiFetch(`/auctions/${id}`, { method: "DELETE" });
      if (!res) return;
      myListings.active.splice(idx, 1);
      renderMyAuct("active");
      renderSidebarListings();
      toast("🗑️ Listing deleted", "error");
    },
  );
}

async function editAuction(id) {
  const title = prompt("New title (leave blank to keep):");
  const desc = prompt("New description (leave blank to keep):");
  if (!title && !desc) return;
  const body = {};
  if (title) body.title = title;
  if (desc) body.description = desc;
  const res = await apiFetch(`/auctions/${id}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  if (res?.auction) {
    toast("✏️ Listing updated!", "success");
    loadMyAuctions("active");
  } else toast("⚠️ " + (res?.message || "Edit failed"), "error");
}

function myAuctTab(el, tab) {
  document
    .querySelectorAll(".tab-sw")
    .forEach((t) => t.classList.remove("active"));
  el.classList.add("active");
  loadMyAuctions(tab);
}

/* ── 16. WATCHLIST ── */
async function loadWatchlist() {
  const c = document.getElementById("watchlistContent");
  if (c) c.innerHTML = '<div class="loading-state">Loading…</div>';
  if (!getToken()) {
    watchItems = [];
    renderWatchlist();
    return;
  }
  const data = await apiFetch("/watchlist");
  watchItems = Array.isArray(data)
    ? data.filter((a) => a?.status === "active")
    : [];
  renderWatchlist();
}

function renderWatchlist() {
  const c = document.getElementById("watchlistContent");
  if (!c) return;
  if (!watchItems.length) {
    c.innerHTML = `<div class="card" style="text-align:center;color:var(--muted2)">
      <div style="font-size:48px;margin-bottom:12px">👁️</div><div>No items in watchlist.</div>
      <button class="btn-submit" style="margin-top:16px" onclick="navigate('feed')">Browse Auctions</button>
    </div>`;
    return;
  }
  c.innerHTML = watchItems
    .map((item, i) => {
      const bid = item.currentBid || item.startingPrice || 0;
      const secs = Math.max(
        0,
        Math.floor((new Date(item.endsAt) - Date.now()) / 1000),
      );
      const h = Math.floor(secs / 3600),
        m = Math.floor((secs % 3600) / 60);
      return `<div class="watchlist-item">
      <div style="width:60px;height:60px;border-radius:12px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">
        ${item.images?.length ? `<img src="${item.images[0].startsWith("http") ? item.images[0] : IMAGE_BASE + item.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : "🏷️"}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px">${escapeHtml(item.title)}</div>
        <div style="color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:15px">₱${bid.toLocaleString()}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">by ${escapeHtml(item.sellerName || "")} · ${item.bids?.length || 0} bids · ⏰ ${h}h ${m}m left</div>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
          <input style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;width:120px;outline:none" type="number" placeholder="₱ Your bid" id="wb-${i}">
          <button class="bid-btn" style="padding:6px 14px;font-size:12px" onclick="wBid('${item._id}',${i})">Bid Now 🔥</button>
          <button class="remove-watch" onclick="removeWatch('${item._id}',${i})">✕ Remove</button>
        </div>
      </div>
    </div>`;
    })
    .join("");
}

async function wBid(auctionId, i) {
  const v = document.getElementById("wb-" + i)?.value;
  if (!v) {
    toast("⚠️ Enter a bid", "error");
    return;
  }
  showConfirm(
    "🔥",
    "Place Bid",
    `Bid <strong>₱${parseInt(v).toLocaleString()}</strong>?`,
    "Bid!",
    false,
    async () => {
      const res = await apiFetch(`/auctions/${auctionId}/bid`, {
        method: "POST",
        body: JSON.stringify({ bidAmount: parseInt(v) }),
      });
      if (res?.auction) toast("🔥 Bid placed!", "success");
      else toast("⚠️ " + (res?.message || "Bid failed"), "error");
    },
  );
}

async function removeWatch(auctionId, i) {
  showConfirm(
    "👁️",
    "Remove",
    "Remove from watchlist?",
    "Remove",
    true,
    async () => {
      await apiFetch(`/auctions/${auctionId}/watch`, { method: "POST" });
      watchItems.splice(i, 1);
      watchedPosts[auctionId] = false;
      renderWatchlist();
      toast("Removed from watchlist", "info");
      updateWatchBadge();
    },
  );
}

/* ── 17. WON AUCTIONS ── */
async function loadWon() {
  const c = document.getElementById("wonContent");
  if (c) c.innerHTML = '<div class="loading-state">Loading…</div>';
  if (!getToken()) {
    wonItems = [];
    renderWon();
    return;
  }
  const data = await apiFetch("/auctions/user/won");
  wonItems = Array.isArray(data) ? data : [];
  renderWon();
}

function renderWon() {
  const c = document.getElementById("wonContent");
  if (!c) return;
  if (!wonItems.length) {
    c.innerHTML = `<div class="card" style="text-align:center;color:var(--muted2)"><div style="font-size:48px;margin-bottom:12px">🏆</div><div>No won auctions yet. Keep bidding!</div></div>`;
    return;
  }
  c.innerHTML = wonItems
    .map(
      (item) => `
    <div class="won-item">
      <div style="width:60px;height:60px;border-radius:12px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">
        ${item.images?.length ? `<img src="${item.images[0].startsWith("http") ? item.images[0] : IMAGE_BASE + item.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:12px">` : "🏆"}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px;margin-bottom:2px">${escapeHtml(item.title)}</div>
        <div style="color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:15px">₱${(item.currentBid || 0).toLocaleString()}</div>
        <div style="font-size:11px;color:var(--muted2);margin-top:2px">from ${escapeHtml(item.sellerName || "")} · ${timeAgo(item.updatedAt || item.createdAt)}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;flex-shrink:0">
        <button class="bid-btn" style="padding:7px 14px;font-size:12px" onclick="openTracking('${item._id}')">📦 Track</button>
        <button class="bid-btn" style="padding:7px 14px;font-size:12px;background:var(--surface2);color:var(--muted2);border:1px solid var(--border)" onclick="openUserProfile('${item.sellerId || ""}','${escapeHtml(item.sellerName || "Seller")}')">⭐ Review</button>
      </div>
    </div>`,
    )
    .join("");
}

/* ── 18. NOTIFICATIONS ── */
async function loadNotifications() {
  if (!getToken()) return;
  const data = await apiFetch("/notifications");
  if (!Array.isArray(data)) return;
  notifs = data;
  notifCount = notifs.filter((n) => !n.read).length;
  updateNB();
  renderNotifs();
  renderSidebarNotifs();
}

const NOTIF_ICONS = {
  bid: "💰",
  won: "🎉",
  message: "💬",
  review: "⭐",
  created: "✅",
  follow: "👥",
  story: "📸",
  outbid: "⚠️",
};

function handleNotifClick(n) {
  markRead(n._id || n.id);
  const link = n.link || "";
  if (link.startsWith("chat:"))
    openChatPopup(link.replace("chat:", ""), n.senderName || "User");
  else if (link.startsWith("http")) window.location.href = link;
  else if (link) navigate(link);
}

function renderNotifs() {
  const c = document.getElementById("notifContent");
  if (!c) return;
  if (!notifs.length) {
    c.innerHTML =
      '<div style="text-align:center;padding:30px;color:var(--muted2)">No notifications yet.</div>';
    return;
  }
  c.innerHTML = notifs
    .map(
      (n) => `
    <div class="notif-item${n.read ? "" : " unread"}" onclick='handleNotifClick(${JSON.stringify(n).replace(/'/g, "&#39;")})' style="cursor:pointer">
      <div style="font-size:24px;flex-shrink:0;width:40px;text-align:center">${NOTIF_ICONS[n.type] || "🔔"}</div>
      <div style="flex:1"><div class="notif-text">${escapeHtml(n.message)}</div><div class="notif-time">${timeAgo(n.createdAt)}</div></div>
      ${n.read ? "" : '<div class="notif-dot" style="flex-shrink:0;margin:0"></div>'}
    </div>`,
    )
    .join("");
}

function renderSidebarNotifs() {
  const c = document.getElementById("sidebarNotifs");
  if (!c) return;
  if (!notifs.length) {
    c.innerHTML =
      '<div style="font-size:12px;color:var(--muted2);padding:8px">No notifications yet.</div>';
    return;
  }
  c.innerHTML = notifs
    .slice(0, 4)
    .map(
      (n) => `
    <div class="notif-item${n.read ? "" : " unread"}" onclick='handleNotifClick(${JSON.stringify(n).replace(/'/g, "&#39;")})' style="cursor:pointer">
      <div style="font-size:18px;flex-shrink:0">${NOTIF_ICONS[n.type] || "🔔"}</div>
      <div style="flex:1;min-width:0"><div class="notif-text" style="font-size:11px">${escapeHtml(n.message)}</div><div class="notif-time">${timeAgo(n.createdAt)}</div></div>
      ${n.read ? "" : '<div class="notif-dot" style="flex-shrink:0;margin:0;width:6px;height:6px"></div>'}
    </div>`,
    )
    .join("");
}

function markRead(id) {
  const n = notifs.find((x) => x._id === id || x.id === id);
  if (n && !n.read) {
    n.read = true;
    notifCount = Math.max(0, notifCount - 1);
    updateNB();
    renderSidebarNotifs();
    if (
      document
        .getElementById("page-notifications")
        ?.classList.contains("active")
    )
      renderNotifs();
    apiFetch(`/notifications/${id}/read`, { method: "PUT" }).catch(() => {});
  }
}

async function markAllRead() {
  if (getToken()) await apiFetch("/notifications/read-all", { method: "PUT" });
  notifs.forEach((n) => (n.read = true));
  notifCount = 0;
  updateNB();
  renderSidebarNotifs();
  renderNotifs();
  toast("✅ All notifications marked as read", "success");
}

function updateNB() {
  const b1 = document.getElementById("notifBadge"),
    b2 = document.getElementById("notifNavBadge");
  if (b1) {
    b1.textContent = notifCount;
    b1.style.display = notifCount ? "flex" : "none";
  }
  if (b2) {
    b2.textContent = notifCount;
    b2.style.display = notifCount ? "" : "none";
  }
}

function addNotifLocal(icon, text, link) {
  notifs.unshift({
    id: Date.now(),
    read: false,
    type: "info",
    message: text,
    link: link || "",
    createdAt: new Date(),
    icon,
  });
  notifCount++;
  updateNB();
  renderSidebarNotifs();
}

/* ── 19. WALLET ── */
async function loadTransactions() {
  const txEl = document.getElementById("txContent");
  if (!txEl || !getToken()) return;
  const data = await apiFetch("/wallet/transactions");
  if (!Array.isArray(data)) return;
  txList = data.map((t) => ({
    icon: getTxIcon(t.category),
    name: t.description || t.category,
    date: timeAgo(t.createdAt),
    amt: t.amount,
    type: t.type,
    balanceAfter: t.balanceAfter,
  }));
  renderWallet();
}

function getTxIcon(category) {
  return (
    {
      add_funds: "💳",
      bid_placed: "🔥",
      bid_refund: "↩️",
      bid_won: "🏆",
      sent: "↗️",
      received: "💸",
      withdrawal: "↓",
      buy_now: "⚡",
    }[category] || "💰"
  );
}

async function loadWallet() {
  if (!getToken()) return;
  const data = await apiFetch("/me");
  if (!data) return;
  walletBal = data.walletBalance || 0;
  myProfile = data;
  syncWalletDisplay();
  await loadTransactions();
}

function syncWalletDisplay() {
  ["walletBal", "profileWalletBal", "sidebarWalletBal"].forEach((id) => {
    const el = document.getElementById(id);
    if (el)
      el.textContent =
        "₱" + walletBal.toLocaleString() + (id === "walletBal" ? ".00" : "");
  });
}

function renderWallet() {
  syncWalletDisplay();
  const txEl = document.getElementById("txContent");
  if (txEl) {
    txEl.innerHTML = txList.length
      ? txList
          .map(
            (t) => `<div class="tx-item">
          <div class="tx-icon" style="background:${t.type === "credit" ? "rgba(16,185,129,.15)" : "rgba(239,68,68,.15)"}">${t.icon}</div>
          <div style="flex:1"><div class="tx-name">${escapeHtml(t.name)}</div><div class="tx-date">${t.date}</div></div>
          <div style="text-align:right">
            <div class="tx-amount ${t.type}">${t.type === "credit" ? "+" : "-"}₱${Math.abs(t.amt).toLocaleString()}</div>
            ${t.balanceAfter !== undefined ? `<div style="font-size:10px;color:var(--muted2)">Bal: ₱${Number(t.balanceAfter).toLocaleString()}</div>` : ""}
          </div>
        </div>`,
          )
          .join("")
      : '<div style="text-align:center;padding:20px;color:var(--muted2)">No transactions yet.</div>';
  }
}

function walletAction(type) {
  walletType = type;
  const titles = {
    add: "💳 Add Funds",
    send: "↗️ Send Money",
    withdraw: "↓ Withdraw",
  };
  const subs = {
    add: "Add money to your BiliBid wallet",
    send: "Send money to another user",
    withdraw: "Withdraw to bank or e-wallet",
  };
  const g = (id) => document.getElementById(id);
  if (g("wmTitle")) g("wmTitle").textContent = titles[type];
  if (g("wmSub")) g("wmSub").textContent = subs[type];
  if (g("wmBtn"))
    g("wmBtn").textContent =
      type === "add" ? "Add Funds" : type === "send" ? "Send" : "Withdraw";
  if (g("wmAmt")) g("wmAmt").value = "";
  renderPaymentMethodSelect(type);
  g("walletModal")?.classList.add("open");
}

function renderPaymentMethodSelect(type) {
  const wrap = document.getElementById("wmMethodWrap");
  if (!wrap) return;
  const options =
    type === "add"
      ? '<option value="GCash">GCash</option><option value="Maya">Maya</option><option value="BDO ATM">BDO ATM/Debit</option><option value="BPI ATM">BPI ATM/Debit</option><option value="Credit Card">Credit/Debit Card</option>'
      : type === "send"
        ? '<option value="BiliBid Wallet">BiliBid Wallet</option><option value="GCash">GCash</option><option value="Maya">Maya</option>'
        : '<option value="GCash">GCash</option><option value="Maya">Maya</option><option value="BDO Bank">BDO Bank</option><option value="BPI Bank">BPI Bank</option>';
  wrap.innerHTML = `<div class="form-group"><label class="form-label">Payment Method</label>
    <select class="form-select" id="wmMethod" onchange="updateWalletExtraFields('${type}',this.value)">${options}</select></div>`;
  updateWalletExtraFields(type, type === "send" ? "BiliBid Wallet" : "GCash");
}

function updateWalletExtraFields(type, method) {
  const extra = document.getElementById("wmExtra");
  if (!extra) return;
  let html = "";
  if (type === "add") {
    if (method === "GCash" || method === "Maya")
      html = `<div class="form-group"><label class="form-label">${method} Number</label><input class="form-input" id="wmPhone" placeholder="09XX XXX XXXX" maxlength="11"></div>`;
    else if (method === "Credit Card")
      html = `<div class="form-group"><label class="form-label">Card Number</label><input class="form-input" id="wmCardNum" placeholder="XXXX XXXX XXXX XXXX" maxlength="19" oninput="formatCardNum(this)"></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group"><label class="form-label">Expiry</label><input class="form-input" id="wmExpiry" placeholder="MM/YY" maxlength="5" oninput="formatExpiry(this)"></div>
        <div class="form-group"><label class="form-label">CVV</label><input class="form-input" id="wmCvv" placeholder="XXX" maxlength="4" type="password"></div>
      </div>`;
    else
      html = `<div class="form-group"><label class="form-label">Account Number</label><input class="form-input" id="wmBankNum" placeholder="Account number"></div>`;
  } else if (type === "send") {
    html = `<div class="form-group"><label class="form-label">${method === "BiliBid Wallet" ? "Recipient Username" : method + " Number"}</label><input class="form-input" id="wmRecip" placeholder="${method === "BiliBid Wallet" ? "@username" : "09XX XXX XXXX"}"></div>`;
  } else {
    html = `<div class="form-group"><label class="form-label">${method.includes("Bank") ? "Account Number" : method + " Number"}</label><input class="form-input" id="wmPhone" placeholder="${method.includes("Bank") ? "Account number" : "09XX XXX XXXX"}"></div>
      <div class="form-group"><label class="form-label">Account Name</label><input class="form-input" id="wmAcctName" placeholder="Full name"></div>`;
  }
  extra.innerHTML = html;
}

function formatCardNum(input) {
  const v = input.value.replace(/\D/g, "").substring(0, 16);
  input.value = v.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(input) {
  let v = input.value.replace(/\D/g, "").substring(0, 4);
  if (v.length >= 2) v = v.substring(0, 2) + "/" + v.substring(2);
  input.value = v;
}

async function processWallet() {
  const amt = parseInt(document.getElementById("wmAmt")?.value || "");
  const method = document.getElementById("wmMethod")?.value || "GCash";
  if (!amt || isNaN(amt) || amt <= 0) {
    toast("⚠️ Enter a valid amount", "error");
    return;
  }
  if ((walletType === "withdraw" || walletType === "send") && amt > walletBal) {
    toast("⚠️ Insufficient balance", "error");
    return;
  }
  closeWM();

  if (walletType === "add") {
    const res = await apiFetch("/wallet/add", {
      method: "POST",
      body: JSON.stringify({ amount: amt, method }),
    });
    if (!res) return;
    walletBal = res.walletBalance ?? walletBal + amt;
    toast("✅ ₱" + amt.toLocaleString() + " added!", "success");
  } else if (walletType === "send") {
    const recipient = document
      .getElementById("wmRecip")
      ?.value?.trim()
      .replace("@", "");
    if (!recipient) {
      toast("⚠️ Enter recipient username", "error");
      return;
    }
    const res = await apiFetch("/wallet/send", {
      method: "POST",
      body: JSON.stringify({
        amount: amt,
        recipientUsername: recipient,
        method,
      }),
    });
    if (!res) return;
    if (res.message && res.walletBalance === undefined) {
      toast("⚠️ " + res.message, "error");
      return;
    }
    walletBal = res.walletBalance ?? walletBal - amt;
    toast(res.message || "↗️ ₱" + amt.toLocaleString() + " sent!", "success");
  } else {
    const accountNumber =
      document.getElementById("wmPhone")?.value?.trim() ||
      document.getElementById("wmBankNum")?.value?.trim() ||
      "";
    const accountName =
      document.getElementById("wmAcctName")?.value?.trim() || "";
    const res = await apiFetch("/wallet/withdraw", {
      method: "POST",
      body: JSON.stringify({ amount: amt, method, accountNumber, accountName }),
    });
    if (!res) return;
    if (res.message && res.walletBalance === undefined) {
      toast("⚠️ " + res.message, "error");
      return;
    }
    walletBal = res.walletBalance ?? walletBal - amt;
    toast(
      "↓ Withdrawal of ₱" + amt.toLocaleString() + " requested!",
      "success",
    );
  }
  syncWalletDisplay();
  await loadTransactions();
}

function closeWM() {
  document.getElementById("walletModal")?.classList.remove("open");
}

/* ── 20. SUGGESTED SELLERS ── */
async function loadSuggestedSellers() {
  const c = document.getElementById("suggestedSellersContent");
  if (!c) return;
  const data = await apiFetch("/users/suggested");
  if (!Array.isArray(data) || !data.length) {
    c.innerHTML = `<div style="background:var(--surface2);border-radius:14px;padding:14px;border:1px solid var(--border)">
      <div style="font-size:12px;color:var(--muted2)">No sellers yet — post the first auction!</div>
    </div>`;
    return;
  }
  c.innerHTML = data
    .slice(0, 3)
    .map(
      (u) => `
    <div style="background:var(--surface2);border-radius:14px;padding:14px;border:1px solid var(--border);margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <div style="width:38px;height:38px;border-radius:50%;background:${hashColor(u.username || "")};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:#fff;overflow:hidden;flex-shrink:0;cursor:pointer" onclick="openUserProfile('${u._id}','${escapeHtml(u.username)}')">
          ${u.avatar ? `<img src="${IMAGE_BASE}${u.avatar}" style="width:100%;height:100%;object-fit:cover">` : u.username.slice(0, 2).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--gold);font-weight:700;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" onclick="openUserProfile('${u._id}','${escapeHtml(u.username)}')">${escapeHtml(u.username)}</div>
          <div style="font-size:11px;color:var(--muted2)">${u.listingsCount || 0} listings · ${u.followersCount || 0} followers</div>
        </div>
      </div>
      <button class="bid-btn" style="width:100%;padding:7px;font-size:12px" onclick="handleSuggestedFollow('${u._id}','${escapeHtml(u.username)}',this)">
        ${followedUsers[u._id] ? "✓ Following" : "+ Follow"}
      </button>
    </div>`,
    )
    .join("");
}

async function handleSuggestedFollow(userId, username, btn) {
  if (!getToken()) {
    toast("⚠️ Please log in to follow sellers.", "error");
    return;
  }
  const nowFollowing = await followUser(userId, username);
  if (btn) btn.textContent = nowFollowing ? "✓ Following" : "+ Follow";
}

/* ── 21. PROFILE ── */
async function loadProfile() {
  if (!getToken()) return;
  const data = await apiFetch("/me");
  if (!data) return;
  myProfile = data;
  walletBal = data.walletBalance || 0;

  const set = (id, val) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") el.value = val;
    else if (!el.querySelector("img")) el.textContent = val;
  };
  set("dispName", data.username || "");
  set("editName", data.username || "");
  set("editBio", data.bio || "");
  set("editLocation", data.location || "");

  const ph = document.getElementById("profileHandle");
  if (ph)
    ph.textContent =
      "@" +
      (data.username || "") +
      (data.location ? " · " + data.location : "");

  if (data.avatar) {
    [
      "profileAvatarLarge",
      "sidebarAvatarText",
      "topbarAvatar",
      "composerAvatar",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (el)
        el.innerHTML = `<img src="${IMAGE_BASE}${data.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    });
  }
  syncWalletDisplay();

  const stats = await apiFetch("/analytics");
  if (stats) {
    ["listedCount", "profileListedCount"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = stats.totalListings || 0;
    });
    ["soldCount", "profileSoldCount"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = stats.endedListings || 0;
    });
  }

  const revData = await apiFetch(`/reviews/${data._id}`);
  if (revData)
    renderReviews(
      revData.reviews || [],
      parseFloat(revData.averageRating) || 0,
    );
}

function renderReviews(reviews, avg) {
  const c = document.getElementById("reviewsContent");
  if (!c) return;
  if (!reviews.length) {
    c.innerHTML =
      '<div style="text-align:center;padding:20px;color:var(--muted2)">No reviews yet.</div>';
    return;
  }
  const stars = (n) => "⭐".repeat(n) + "☆".repeat(5 - n);
  c.innerHTML =
    `<div style="background:var(--surface2);border-radius:12px;padding:14px;margin-bottom:14px;border:1px solid var(--border);text-align:center">
    <div style="font-family:'Syne',sans-serif;font-weight:800;font-size:42px;color:var(--gold)">${avg.toFixed(1)}</div>
    <div style="font-size:20px">${stars(Math.round(avg))}</div>
    <div style="font-size:12px;color:var(--muted2);margin-top:4px">${reviews.length} reviews</div>
  </div>` +
    reviews
      .map(
        (r) => `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="width:38px;height:38px;border-radius:50%;background:${hashColor(r.reviewerName || "")};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff">${(r.reviewerName || "U").slice(0, 2).toUpperCase()}</div>
        <div style="flex:1"><div style="font-weight:700;font-size:13px">${escapeHtml(r.reviewerName || "User")}</div><div style="font-size:11px;color:var(--muted2)">${timeAgo(r.createdAt)}</div></div>
        <div style="font-size:14px">${stars(r.rating)}</div>
      </div>
      <div style="font-size:13px;color:var(--muted2);line-height:1.6">${escapeHtml(r.comment || "")}</div>
    </div>`,
      )
      .join("");
}

async function saveProfile() {
  const bio = document.getElementById("editBio")?.value || "",
    location = document.getElementById("editLocation")?.value || "",
    username = document.getElementById("editName")?.value || "";
  const res = await apiFetch("/me", {
    method: "PUT",
    body: JSON.stringify({ bio, location, username }),
  });
  if (res) {
    toast("✅ Profile saved!", "success");
    if (username) {
      localStorage.setItem("bbUsername", username);
      syncUIToAuthState();
    }
  }
}

async function uploadAvatar(input) {
  if (!input.files?.length) return;
  const fd = new FormData();
  fd.append("avatar", input.files[0]);
  toast("⏳ Uploading avatar…", "info");
  try {
    const res = await fetch(`${API_BASE}/api/users/upload-avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json();
    if (data.avatarUrl || data.url) {
      uploadedAvatarUrl = data.avatarUrl || data.url;
      const url = `${IMAGE_BASE}${uploadedAvatarUrl}`;
      const imgs = `<img src="${url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      ["profileAvatarLarge", "sidebarAvatarText", "topbarAvatar"].forEach(
        (id) => {
          const el = document.getElementById(id);
          if (el) el.innerHTML = imgs;
        },
      );
      localStorage.setItem("bbAvatar", uploadedAvatarUrl);
      toast("✅ Avatar updated!", "success");
    } else throw new Error("No URL");
  } catch (err) {
    toast("⚠️ Avatar upload failed", "error");
  }
}

async function savePassword() {
  const currentPw =
    document.getElementById("currentPassword")?.value?.trim() || "";
  const newPw = document.getElementById("newPassword")?.value?.trim() || "";
  const confirmPw =
    document.getElementById("confirmPassword")?.value?.trim() || "";
  if (!currentPw || !newPw) {
    toast("⚠️ Fill in all password fields", "error");
    return;
  }
  if (newPw.length < 6) {
    toast("⚠️ New password must be at least 6 characters", "error");
    return;
  }
  if (newPw !== confirmPw) {
    toast("⚠️ Passwords do not match", "error");
    return;
  }
  const btn = document.getElementById("savePasswordBtn");
  if (btn) {
    btn.textContent = "⏳ Saving…";
    btn.disabled = true;
  }
  const res = await apiFetch("/me/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
  });
  if (btn) {
    btn.textContent = "🔒 Update Password";
    btn.disabled = false;
  }
  if (res?.message === "Password updated successfully") {
    toast("🔒 Password updated!", "success");
    ["currentPassword", "newPassword", "confirmPassword"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
  } else toast("⚠️ " + (res?.message || "Failed to update password"), "error");
}

/* ── 22. CONVERSATIONS ── */
async function loadConversations() {
  const c = document.getElementById("conversationsContent");
  if (!c) return;
  if (!getToken()) {
    c.innerHTML =
      '<div style="text-align:center;padding:30px;color:var(--muted2)">Log in to see messages.</div>';
    return;
  }
  c.innerHTML = '<div class="loading-state">Loading conversations…</div>';
  const threads = await apiFetch("/messages");
  if (!Array.isArray(threads) || !threads.length) {
    c.innerHTML = `<div style="text-align:center;padding:40px;color:var(--muted2)"><div style="font-size:48px;margin-bottom:12px">💬</div><div>No conversations yet.</div></div>`;
    return;
  }
  c.innerHTML = threads
    .map(
      (t) => `
    <div class="conversation-item" onclick="openChatPopup('${t.userId || t.partnerId}','${escapeHtml(t.username || t.partnerName)}')" data-uid="${t.userId || t.partnerId}">
      <div style="position:relative;flex-shrink:0">
        <div style="width:48px;height:48px;border-radius:50%;background:${hashColor(t.username || t.partnerName || "")};display:flex;align-items:center;justify-content:center;font-weight:700;font-size:16px;color:#fff;overflow:hidden">
          ${t.avatar || t.partnerPic ? `<img src="${IMAGE_BASE}${t.avatar || t.partnerPic}" style="width:100%;height:100%;object-fit:cover">` : (t.username || t.partnerName || "U").slice(0, 2).toUpperCase()}
        </div>
        <span class="online-dot" style="position:absolute;bottom:0;right:0;width:12px;height:12px;border-radius:50%;background:${onlineUsers[t.userId || t.partnerId] ? "var(--online)" : "var(--muted)"};border:2px solid var(--surface2)"></span>
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:14px">${escapeHtml(t.username || t.partnerName || "User")}</div>
        <div style="font-size:12px;color:var(--muted2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(t.lastMessage || "")}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${timeAgo(t.lastMsgTime || t.lastTime)}</div>
      </div>
      ${t.unread ? `<div style="min-width:20px;height:20px;border-radius:50%;background:var(--blue);color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${t.unread}</div>` : ""}
    </div>`,
    )
    .join("");
}

/* ── 23. CHAT POPUP ── */
async function openChatPopup(userId, username) {
  if (!userId || userId === getUserId()) return;
  currentChatUserId = userId;
  currentChatUsername = username || "User";

  let win = chatWindows.find((w) => w.userId === userId);
  if (!win) {
    win = {
      userId,
      username: currentChatUsername,
      unread: 0,
      color: rndColor(),
      isOnline: !!onlineUsers[userId],
    };
    chatWindows.push(win);
    if (chatWindows.length > 5) chatWindows.shift();
  }
  win.unread = 0;
  renderChatHeads();

  const popup = document.getElementById("chatPopup"),
    msgsEl = document.getElementById("chatMsgs");
  const cn = document.getElementById("chatName"),
    cs = document.getElementById("chatStat"),
    ca = document.getElementById("chatAv");
  if (cn) cn.textContent = currentChatUsername;
  if (cs)
    cs.innerHTML = onlineUsers[userId]
      ? '<span style="color:var(--online)">● Online</span>'
      : "Last seen recently";
  if (ca) {
    ca.textContent = currentChatUsername.slice(0, 2).toUpperCase();
    ca.style.background = hashColor(currentChatUsername);
  }
  if (msgsEl)
    msgsEl.innerHTML =
      '<div class="loading-state" style="padding:20px">Loading…</div>';
  popup?.classList.add("open");

  if (!getToken()) {
    if (msgsEl)
      msgsEl.innerHTML =
        '<div style="text-align:center;padding:20px;color:var(--muted2)">Log in to send messages.</div>';
    return;
  }

  const msgs = await apiFetch(`/messages/${userId}`);
  if (!msgsEl) return;
  if (!Array.isArray(msgs) || !msgs.length) {
    msgsEl.innerHTML = `<div style="text-align:center;padding:30px;color:var(--muted2)"><div style="font-size:32px;margin-bottom:8px">💬</div><div style="font-size:13px">Start a conversation with ${escapeHtml(currentChatUsername)}</div></div>`;
  } else {
    msgsEl.innerHTML = msgs
      .map((m) => {
        const senderStr = m.senderId?._id
          ? m.senderId._id.toString()
          : String(m.senderId || "");
        const isMe = senderStr === getUserId();
        const name = isMe ? "" : m.senderName || currentChatUsername;
        const content =
          m.messageType === "image"
            ? `<img src="${IMAGE_BASE}${m.imageUrl}" class="chat-img-preview" onclick="openImg('${IMAGE_BASE}${m.imageUrl}')">`
            : escapeHtml(m.message);
        return buildMsgHtml(
          isMe ? "me" : "them",
          content,
          fmtTime(m.createdAt),
          name,
        );
      })
      .join("");
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}

function buildMsgHtml(side, content, time, name) {
  return `<div class="msg ${side}">
    ${name && side === "them" ? `<div style="font-size:10px;color:var(--muted2);margin-bottom:3px;font-weight:600">${escapeHtml(name)}</div>` : ""}
    ${content}<div class="msg-time">${time}</div>
  </div>`;
}

function appendChatMsg(side, content, time, name) {
  const msgsEl = document.getElementById("chatMsgs");
  if (!msgsEl) return;
  const empty = msgsEl.querySelector(
    ".loading-state, [style*='text-align:center']",
  );
  if (empty && msgsEl.children.length === 1) empty.remove();
  msgsEl.insertAdjacentHTML(
    "beforeend",
    buildMsgHtml(side, content, time, side === "them" ? name : ""),
  );
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function showTyping(username) {
  if (document.getElementById("typingIndicator")) return;
  const msgsEl = document.getElementById("chatMsgs");
  if (msgsEl) {
    msgsEl.insertAdjacentHTML(
      "beforeend",
      `<div id="typingIndicator" class="msg them" style="font-size:12px;color:var(--muted2);opacity:0.8"><span>●●● ${escapeHtml(username)} is typing…</span></div>`,
    );
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }
}
function hideTyping() {
  document.getElementById("typingIndicator")?.remove();
}
function closeChat() {
  document.getElementById("chatPopup")?.classList.remove("open");
  currentChatUserId = "";
}

async function sendMsg() {
  const input = document.getElementById("chatIn");
  const text = input?.value?.trim();
  const hasPendingImg = !!window._pendingChatImg;
  if (!text && !hasPendingImg) return;
  if (!getToken()) {
    toast("⚠️ Please log in to send messages.", "error");
    return;
  }
  const time = fmtTime(Date.now());

  if (hasPendingImg) {
    const imgSrc = `${IMAGE_BASE}${window._pendingChatImg}`;
    appendChatMsg(
      "me",
      `<img src="${imgSrc}" class="chat-img-preview" onclick="openImg('${imgSrc}')">`,
      time,
    );
    if (socket?.connected && currentChatUserId)
      socket.emit("sendMessage", {
        to: currentChatUserId,
        from: getUserId(),
        message: "[Image]",
        imageUrl: window._pendingChatImg,
        messageType: "image",
      });
    else
      await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({
          receiverId: currentChatUserId,
          message: "[Image]",
          imageUrl: window._pendingChatImg,
          messageType: "image",
        }),
      });
    window._pendingChatImg = null;
    const prev = document.getElementById("chatImgPreview");
    if (prev) prev.innerHTML = "";
  } else {
    appendChatMsg("me", escapeHtml(text), time);
    if (input) input.value = "";
    if (socket?.connected && currentChatUserId) {
      socket.emit("sendMessage", {
        to: currentChatUserId,
        from: getUserId(),
        message: text,
        messageType: "text",
      });
      socket.emit("stopTyping", { to: currentChatUserId, from: getUserId() });
    } else
      await apiFetch("/messages", {
        method: "POST",
        body: JSON.stringify({ receiverId: currentChatUserId, message: text }),
      });
    isTyping = false;
  }
}

function handleChatTyping() {
  if (!socket?.connected || !currentChatUserId) return;
  if (!isTyping) {
    isTyping = true;
    socket.emit("typing", {
      to: currentChatUserId,
      from: getUserId(),
      username: getUsername(),
    });
  }
  clearTimeout(chatTypingTimer);
  chatTypingTimer = setTimeout(() => {
    isTyping = false;
    socket.emit("stopTyping", { to: currentChatUserId, from: getUserId() });
  }, 1500);
}

async function handleChatImageUpload(input) {
  if (!input.files?.length) return;
  const fd = new FormData();
  fd.append("images", input.files[0]);
  toast("⏳ Uploading image…", "info");
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd,
    });
    const data = await res.json();
    if (data.urls?.length) {
      window._pendingChatImg = data.urls[0];
      const preview = document.getElementById("chatImgPreview");
      if (preview)
        preview.innerHTML = `<div style="display:flex;align-items:center;gap:8px;padding:4px 0">
        <img src="${IMAGE_BASE}${data.urls[0]}" style="max-height:60px;border-radius:8px">
        <span onclick="window._pendingChatImg=null;this.parentElement.parentElement.innerHTML=''" style="cursor:pointer;color:var(--red);font-size:18px">✕</span>
      </div>`;
      toast("✅ Image ready to send", "success");
    }
  } catch {
    toast("⚠️ Image upload failed", "error");
  }
}

/* ── 24. CHAT HEADS ── */
function renderChatHeads() {
  const container = document.getElementById("chatHeads");
  if (!container) return;
  const chatOpen = document
    .getElementById("chatPopup")
    ?.classList.contains("open");
  container.innerHTML = chatWindows
    .filter((w) => !(chatOpen && w.userId === currentChatUserId))
    .slice(-4)
    .map(
      (w) => `
    <div class="chat-bubble" style="background:${w.color}" onclick="openChatPopup('${w.userId}','${escapeHtml(w.username)}')" title="${escapeHtml(w.username)}">
      ${w.avatar ? `<img src="${IMAGE_BASE}${w.avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : w.username.slice(0, 2).toUpperCase()}
      ${w.unread ? `<div class="unread-dot">${w.unread}</div>` : ""}
      <div style="position:absolute;bottom:2px;right:2px;width:10px;height:10px;border-radius:50%;background:${onlineUsers[w.userId] ? "var(--online)" : "var(--muted)"};border:2px solid var(--bg)"></div>
    </div>`,
    )
    .join("");
}

/* ── 25. SEARCH ── */
let searchTimer = null;
function showSR() {
  const sr = document.getElementById("searchResults");
  if (sr) sr.style.display = "block";
}
function hideSR() {
  setTimeout(() => {
    const sr = document.getElementById("searchResults");
    if (sr) sr.style.display = "none";
  }, 200);
}

function handleSearch(q) {
  clearTimeout(searchTimer);
  const box = document.getElementById("searchResults");
  if (!box) return;
  const v = (q || "").trim();
  if (!v || v.length < 2) {
    box.style.display = "none";
    return;
  }
  box.innerHTML =
    '<div style="padding:12px;color:var(--muted2);font-size:13px">Searching…</div>';
  box.style.display = "block";
  searchTimer = setTimeout(() => doSearch(v), 300);
}

async function doSearch(q) {
  const box = document.getElementById("searchResults");
  if (!box) return;
  const [auctionsData, usersData] = await Promise.all([
    apiFetch(`/auctions?search=${encodeURIComponent(q)}&status=active`).catch(
      () => null,
    ),
    apiFetch(`/users?search=${encodeURIComponent(q)}`).catch(() => null),
  ]);
  const auctions = Array.isArray(auctionsData) ? auctionsData.slice(0, 4) : [];
  const users = Array.isArray(usersData) ? usersData.slice(0, 4) : [];

  if (!auctions.length && !users.length) {
    box.innerHTML = `<div style="padding:16px;color:var(--muted2);font-size:13px;text-align:center">No results for "<strong>${escapeHtml(q)}</strong>"</div>`;
    return;
  }

  let html = "";
  if (users.length) {
    html +=
      '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;padding:8px 14px 4px">People</div>';
    html += users
      .map(
        (u) => `
      <div class="search-result-item" onclick="document.getElementById('searchResults').style.display='none';openUserProfile('${u._id}','${escapeHtml(u.username)}')">
        <div style="width:40px;height:40px;border-radius:50%;background:${hashColor(u.username || "")};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:14px;flex-shrink:0;overflow:hidden">
          ${u.avatar ? `<img src="${IMAGE_BASE}${u.avatar}" style="width:100%;height:100%;object-fit:cover">` : (u.username || "U").slice(0, 2).toUpperCase()}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${escapeHtml(u.username || "User")}</div>
          <div style="font-size:12px;color:var(--muted2)">${u.followersCount || 0} followers</div>
        </div>
        <button class="bid-btn" style="padding:5px 12px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();followUser('${u._id}','${escapeHtml(u.username)}')">
          ${followedUsers[u._id] ? "✓ Following" : "+ Follow"}
        </button>
      </div>`,
      )
      .join("");
  }
  if (auctions.length) {
    html +=
      '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;padding:8px 14px 4px">Auctions</div>';
    html += auctions
      .map(
        (m) => `
      <div class="search-result-item" onclick="navigate('feed')">
        <div style="width:40px;height:40px;border-radius:8px;background:${hashColor(m.sellerName || "")};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0;overflow:hidden">
          ${m.images?.length ? `<img src="${m.images[0].startsWith("http") ? m.images[0] : IMAGE_BASE + m.images[0]}" style="width:100%;height:100%;object-fit:cover;border-radius:8px">` : "🏷️"}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${escapeHtml(m.title)}</div>
          <div style="font-size:12px;color:var(--muted2)">${escapeHtml(m.sellerName || "")} · ₱${(m.currentBid || m.startingPrice || 0).toLocaleString()}</div>
        </div>
      </div>`,
      )
      .join("");
  }
  box.innerHTML = html;
  box.style.display = "block";
}

/* ── 26. TRACKING ── */
async function openTracking(auctionId) {
  window.open(
    `trackorder.html?auctionId=${auctionId}&token=${getToken()}`,
    "_blank",
  );
}

/* ── 27. POST AUCTION ── */
function openModal() {
  if (!getToken()) {
    toast("⚠️ Please log in to post an auction.", "error");
    return;
  }
  document.getElementById("postModal")?.classList.add("open");
}
function closeModal() {
  document.getElementById("postModal")?.classList.remove("open");
  ["pTitle", "pDesc", "pBid", "pBuyNow"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  uploadedImageUrls = [];
  const ui = document.getElementById("upIcon");
  if (ui) ui.textContent = "📸";
  const ut = document.getElementById("upText");
  if (ut)
    ut.innerHTML =
      'Click to upload photos (up to 5 images)<br><span style="color:var(--muted);font-size:12px">JPG, PNG, WebP · Max 5MB each</span>';
}

async function handleUpload(input) {
  if (!input.files?.length) return;
  const ui = document.getElementById("upIcon"),
    ut = document.getElementById("upText");
  if (ui) ui.textContent = "⏳";
  if (ut) ut.textContent = "Uploading…";
  const formData = new FormData();
  Array.from(input.files).forEach((f) => formData.append("images", f));
  try {
    const res = await fetch(`${API_BASE}/api/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${getToken()}` },
      body: formData,
    });
    const data = await res.json();
    if (data.urls) {
      uploadedImageUrls = data.urls;
      if (ui) ui.textContent = "✅";
      if (ut) {
        // Show mini previews
        const thumbs = data.urls
          .map(
            (u) =>
              `<img src="${IMAGE_BASE}${u}" style="width:50px;height:50px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">`,
          )
          .join("");
        ut.innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;justify-content:center;margin-top:6px">${thumbs}</div><div style="margin-top:6px;color:var(--green)">${input.files.length} photo(s) ready</div>`;
      }
      toast("✅ Photos uploaded!", "success");
    } else throw new Error(data.message || "Upload failed");
  } catch (err) {
    if (ui) ui.textContent = "⚠️";
    if (ut) ut.textContent = "Upload failed — images skipped.";
    uploadedImageUrls = [];
    toast("⚠️ " + err.message, "error");
  }
}

async function submitPost() {
  if (!getToken()) {
    toast("⚠️ Please log in first.", "error");
    return;
  }
  const title = document.getElementById("pTitle")?.value?.trim() || "";
  const bid = parseInt(document.getElementById("pBid")?.value || "");
  const desc = document.getElementById("pDesc")?.value || "";
  const cat = document.getElementById("pCat")?.value || "Other";
  const cond = document.getElementById("pCond")?.value || "Pre-loved (Good)";
  const dur =
    parseInt(document.getElementById("pDuration")?.value || "") || 86400;
  const buyNow =
    parseInt(document.getElementById("pBuyNow")?.value || "") || undefined;
  const ship = document.getElementById("pShip")?.value || "Buyer Pays Shipping";

  if (!title) {
    toast("⚠️ Add a title", "error");
    return;
  }
  if (!bid || isNaN(bid) || bid < 1) {
    toast("⚠️ Set a valid starting bid (min ₱1)", "error");
    return;
  }
  if (buyNow && buyNow <= bid) {
    toast("⚠️ Buy Now price must be higher than starting bid", "error");
    return;
  }

  const btn = document.querySelector("#postModal .btn-submit");
  if (btn) {
    btn.textContent = "⏳ Posting…";
    btn.disabled = true;
  }

  const res = await apiFetch("/auctions", {
    method: "POST",
    body: JSON.stringify({
      title,
      description: desc,
      category: cat,
      condition: cond,
      startingPrice: bid,
      duration: dur,
      images: uploadedImageUrls,
      buyNowPrice: buyNow,
      shipping: ship,
    }),
  });
  if (btn) {
    btn.textContent = "🚀 Post Auction";
    btn.disabled = false;
  }
  if (!res?.auction) {
    toast("⚠️ " + (res?.message || "Failed to post auction"), "error");
    return;
  }

  uploadedImageUrls = [];
  closeModal();
  toast("🚀 Auction posted and now live!", "success");
  addNotifLocal("🚀", `Your auction "${title}" is now live!`, "my-auctions");
  await loadFeed();
}

/* ── 28. AUTH ── */
async function login(email, password) {
  const btn = document.querySelector("#loginForm .btn-submit");
  if (btn) {
    btn.textContent = "⏳ Logging in…";
    btn.disabled = true;
  }
  const res = await apiFetch("/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  if (btn) {
    btn.textContent = "🔑 Log In";
    btn.disabled = false;
  }
  if (!res?.token) {
    toast(
      "⚠️ " + (res?.message || "Login failed. Check your credentials."),
      "error",
    );
    return false;
  }
  setAuth(res.token, res.user.id, res.user.username, res.user.avatar || "");
  walletBal = res.user.walletBalance || 0;
  myProfile = res.user;
  initSocket();
  toast("✅ Welcome back, " + res.user.username + "! 👋", "success");
  navigate("feed");
  await Promise.all([
    loadNotifications(),
    loadMyAuctions("active"),
    loadSuggestedSellers(),
  ]);
  return true;
}

async function register(username, email, password) {
  const btn = document.querySelector("#registerForm .btn-submit");
  if (btn) {
    btn.textContent = "⏳ Creating account…";
    btn.disabled = true;
  }
  const res = await apiFetch("/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  if (btn) {
    btn.textContent = "🚀 Create Account";
    btn.disabled = false;
  }
  if (!res?.token) {
    toast("⚠️ " + (res?.message || "Registration failed"), "error");
    return false;
  }
  setAuth(res.token, res.user.id, res.user.username, "");
  walletBal = 0;
  initSocket();
  toast("🎉 Welcome to BiliBid, " + res.user.username + "!", "success");
  navigate("feed");
  return true;
}

function logout() {
  showConfirm(
    "🚪",
    "Log Out",
    "Are you sure you want to log out?",
    "Log Out",
    false,
    () => {
      clearAuth();
      disconnectSocket();

      /* Reset all state */
      walletBal = 0;
      notifs = [];
      cachedPosts = [];
      watchItems = [];
      wonItems = [];
      txList = [];
      likedPosts = {};
      watchedPosts = {};
      notifCount = 0;
      myProfile = {};
      uploadedImageUrls = [];
      timers = {};
      myListings = { active: [], ended: [], sold: [] };
      currentChatUserId = "";
      currentChatUsername = "";
      stories = [];
      chatWindows = [];
      followedUsers = {};
      onlineUsers = {};

      updateNB();
      renderChatHeads();
      closeChat();

      [
        "topbarAvatar",
        "sidebarAvatarText",
        "composerAvatar",
        "profileAvatarLarge",
      ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = "??";
      });
      const sn = document.getElementById("sidebarName");
      if (sn) sn.textContent = "Guest";
      const sh = document.getElementById("sidebarHandle");
      if (sh) sh.textContent = "Browse & bid on auctions";
      const sl = document.getElementById("sidebarListings");
      if (sl)
        sl.innerHTML =
          '<div style="font-size:12px;color:var(--muted2);padding:8px">Log in to see your listings.</div>';
      const sno = document.getElementById("sidebarNotifs");
      if (sno)
        sno.innerHTML =
          '<div style="font-size:12px;color:var(--muted2);padding:8px">No notifications yet.</div>';

      syncUIToAuthState();
      navigate("feed"); // will show guest prompt since token is cleared
      toast("👋 Logged out. See you soon!", "info");
    },
  );
}

/* ── 29. UI SYNC ── */
function syncUIToAuthState() {
  const token = getToken(),
    username = getUsername() || "",
    avatar = localStorage.getItem("bbAvatar") || "";
  const initials = username.slice(0, 2).toUpperCase() || "??";

  const loggedIn = document.getElementById("loggedInActions"),
    loggedOut = document.getElementById("loggedOutActions");
  if (loggedIn) loggedIn.style.display = token ? "flex" : "none";
  if (loggedOut) loggedOut.style.display = token ? "none" : "flex";
  const gb = document.getElementById("guestBanner");
  if (gb) gb.style.display = token ? "none" : "flex";

  [
    "topbarAvatar",
    "sidebarAvatarText",
    "composerAvatar",
    "profileAvatarLarge",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (avatar && !el.querySelector("img"))
      el.innerHTML = `<img src="${IMAGE_BASE}${avatar}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    else if (!avatar && !el.querySelector("img")) el.textContent = initials;
  });

  const sn = document.getElementById("sidebarName");
  if (sn) sn.textContent = username || "Guest";
  const sh = document.getElementById("sidebarHandle");
  if (sh)
    sh.textContent = username ? "@" + username : "Browse & bid on auctions";
  const dn = document.getElementById("dispName");
  if (dn && !dn.querySelector("img")) dn.textContent = username || "—";
  const ph = document.getElementById("profileHandle");
  if (ph) ph.textContent = username ? "@" + username : "@—";
}

/* ── 30. UTILITIES ── */
function toast(msg, type) {
  const t = document.getElementById("toast");
  if (!t) return;
  t.className = "toast show";
  if (type) t.classList.add(type);
  t.innerHTML = msg;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => {
    t.className = "toast";
  }, 3000);
}

function showConfirm(icon, title, msg, okText, danger, cb) {
  confirmCb = cb;
  const set = (id, val, html) => {
    const el = document.getElementById(id);
    if (el) html ? (el.innerHTML = val) : (el.textContent = val);
  };
  set("cfIcon", icon);
  set("cfTitle", title);
  set("cfMsg", msg, true);
  const co = document.getElementById("cfOk");
  if (co) {
    co.textContent = okText || "Confirm";
    co.classList.toggle("danger", !!danger);
  }
  document.getElementById("confirmOverlay")?.classList.add("open");
}
function runConfirm() {
  if (confirmCb) {
    try {
      confirmCb();
    } catch (e) {
      console.error(e);
    }
  }
  closeConfirm();
}
function closeConfirm() {
  confirmCb = null;
  document.getElementById("confirmOverlay")?.classList.remove("open");
}

/* ── 31. INIT ── */
async function appInit() {
  syncUIToAuthState();
  updateNB();
  renderChatHeads();

  if (getToken()) {
    initSocket();
    const me = await apiFetch("/me");
    if (me) {
      walletBal = me.walletBalance || 0;
      myProfile = me;
      syncWalletDisplay();
    } else clearAuth();
    await Promise.all([
      loadNotifications(),
      loadMyAuctions("active"),
      loadSuggestedSellers(),
    ]);
    syncUIToAuthState();
  }

  await loadFeed();
}

window.addEventListener("load", appInit);
if (document.readyState === "complete" || document.readyState === "interactive")
  appInit();

/* ── 32. EXPOSE GLOBALS ── */
Object.assign(window, {
  navigate,
  toast,
  openModal,
  closeModal,
  openChatPopup,
  closeChat,
  sendMsg,
  openUserProfile,
  closeUserProfile,
  followUser,
  submitReview,
  setReviewRating,
  openStory,
  nextStory,
  prevStory,
  closeStoryViewer,
  openPostStory,
  closePostStory,
  submitStory,
  handleStoryImgUpload,
  replyToStory,
  placeBid,
  buyNow,
  doLike,
  doWatch,
  doShare,
  toggleComments,
  addComment,
  toggleMenu,
  closeMenus,
  setFilter,
  filterCat,
  myAuctTab,
  renderMyAuct,
  deleteAuction,
  editAuction,
  wBid,
  removeWatch,
  markRead,
  markAllRead,
  handleNotifClick,
  walletAction,
  processWallet,
  closeWM,
  updateWalletExtraFields,
  renderPaymentMethodSelect,
  formatCardNum,
  formatExpiry,
  saveProfile,
  savePassword,
  uploadAvatar,
  submitPost,
  handleUpload,
  handleChatImageUpload,
  handleChatTyping,
  showConfirm,
  runConfirm,
  closeConfirm,
  handleSearch,
  showSR,
  hideSR,
  login,
  register,
  logout,
  loadFeed,
  loadMyAuctions,
  loadWallet,
  loadProfile,
  loadConversations,
  openTracking,
  syncUIToAuthState,
  reportItem,
  openImg,
  loadTransactions,
  getTxIcon,
  handleSuggestedFollow,
  loadSuggestedSellers,
});
