// ===== STATE =====
let walletBal = 12500;
let confirmCb = null;
let walletType = "";
let feedFilter = "all";
let likedPosts = {},
  watchedPosts = {},
  postComments = {};
let idVerified = false;
let idSubmitted = false;
let followers = 48;
let following = 31;

let notifs = [
  {
    id: 1,
    read: false,
    icon: "⚡",
    text: "<strong>KarlSneakers</strong> outbid you on Jordan 1 Retro! Current: <strong>₱4,200</strong>",
    time: "2 min ago",
  },
  {
    id: 2,
    read: false,
    icon: "⏰",
    text: "<strong>Your auction</strong> for PS5 Controller ends in <strong>1 hour!</strong>",
    time: "1 hour ago",
  },
  {
    id: 3,
    read: false,
    icon: "🎉",
    text: "<strong>Ana N.</strong> won your MacBook Pro for <strong>₱72,000</strong> 🎉",
    time: "Yesterday",
  },
  {
    id: 4,
    read: true,
    icon: "💬",
    text: "<strong>MariaSells</strong> sent you a message about the iPhone",
    time: "2 hours ago",
  },
  {
    id: 5,
    read: true,
    icon: "👍",
    text: "<strong>TechHub PH</strong> liked your MacBook Air listing",
    time: "3 hours ago",
  },
  {
    id: 6,
    read: true,
    icon: "🏷️",
    text: "PS5 Controller has received <strong>12 new bids</strong>",
    time: "Today",
  },
];
let notifCount = 3;

const txList = [
  {
    icon: "🎉",
    name: "Sold: MacBook Pro 2022",
    date: "Feb 27",
    amt: 72000,
    type: "credit",
  },
  {
    icon: "🏆",
    name: "Won: Sony WH-1000XM5",
    date: "Feb 25",
    amt: -8500,
    type: "debit",
  },
  {
    icon: "💳",
    name: "Added Funds via GCash",
    date: "Feb 24",
    amt: 5000,
    type: "credit",
  },
  {
    icon: "🎉",
    name: "Sold: Canon EOS R50",
    date: "Feb 20",
    amt: 35000,
    type: "credit",
  },
  {
    icon: "↓",
    name: "Withdrawal to BDO",
    date: "Feb 18",
    amt: -20000,
    type: "debit",
  },
];

const chatData = {
  MariaSells: {
    init: "MS",
    bg: "linear-gradient(135deg,#f59e0b,#ea580c)",
    stat: "Active now",
    msgs: [
      {
        t: "them",
        tx: "Hi! Is the iPhone still available? 😊",
        time: "2:34 PM",
      },
      {
        t: "me",
        tx: "Yes! Auction ends in 2 hours. Bid or Buy Now 🔥",
        time: "2:36 PM",
      },
      { t: "them", tx: "What's the lowest for Buy Now?", time: "2:37 PM" },
      { t: "me", tx: "Best I can do is ₱31,000!", time: "2:38 PM" },
      { t: "them", tx: "Okay let me think about it 🤔", time: "2:39 PM" },
      { t: "me", tx: "Sure! Just message me anytime 😊", time: "2:40 PM" },
    ],
  },
  "TechHub PH": {
    init: "TH",
    bg: "linear-gradient(135deg,#7c3aed,#2563eb)",
    stat: "Active now",
    msgs: [
      {
        t: "them",
        tx: "Are you interested in the MacBook? Let's deal!",
        time: "1:10 PM",
      },
      { t: "me", tx: "What's the lowest bid you'll accept?", time: "1:15 PM" },
    ],
  },
  "Karl Sneakers": {
    init: "KS",
    bg: "linear-gradient(135deg,#10b981,#0891b2)",
    stat: "In auction",
    msgs: [{ t: "them", tx: "Size 10 available pa ba?", time: "11:00 AM" }],
  },
  "Juan Dela Cruz": {
    init: "JD",
    bg: "linear-gradient(135deg,#4b5563,#374151)",
    stat: "Active 3h ago",
    msgs: [],
  },
  "Ana Navarro": {
    init: "AN",
    bg: "linear-gradient(135deg,#ec4899,#8b5cf6)",
    stat: "Active yesterday",
    msgs: [],
  },
};
let currentChat = "MariaSells";

const myListings = {
  active: [
    {
      e: "🎮",
      n: "PS5 DualSense Controller",
      p: "₱2,800",
      b: 12,
      t: "1d 2h",
      c: "Brand New",
    },
    {
      e: "📷",
      n: "Sony Camera Lens 50mm f/1.8",
      p: "₱5,500",
      b: 8,
      t: "3h 12m",
      c: "Like New",
    },
    {
      e: "📱",
      n: "Samsung Galaxy S24 Ultra",
      p: "₱45,000",
      b: 3,
      t: "6h 44m",
      c: "Brand New",
    },
  ],
  ended: [
    {
      e: "💻",
      n: "Dell XPS 15 Laptop",
      p: "₱55,000",
      b: 0,
      t: "Ended",
      c: "Pre-loved",
    },
    {
      e: "🎧",
      n: "Sony WH-1000XM4",
      p: "₱8,000",
      b: 1,
      t: "Ended",
      c: "Like New",
    },
  ],
  sold: [
    {
      e: "⌚",
      n: "Casio G-Shock DW5600",
      p: "₱3,100",
      b: 7,
      t: "Sold",
      c: "Pre-loved",
    },
    {
      e: "🖥️",
      n: "MacBook Pro 2022",
      p: "₱72,000",
      b: 15,
      t: "Sold",
      c: "Like New",
    },
    {
      e: "📸",
      n: "Canon EOS R50",
      p: "₱35,000",
      b: 9,
      t: "Sold",
      c: "Brand New",
    },
  ],
};

let watchItems = [
  {
    e: "📱",
    n: "iPhone 15 Pro Max 256GB",
    p: "₱28,500",
    seller: "Maria Reyes",
    time: "2h 9m",
    bids: 47,
  },
  {
    e: "👟",
    n: "Nike Air Jordan 1 Retro",
    p: "₱4,200",
    seller: "Karl Sneakers",
    time: "40m",
    bids: 23,
  },
  {
    e: "💻",
    n: "MacBook Air M2",
    p: "₱62,000",
    seller: "TechHub PH",
    time: "18h",
    bids: 31,
  },
  {
    e: "🎮",
    n: "Nintendo Switch OLED",
    p: "₱12,500",
    seller: "GamersHub",
    time: "1d 5h",
    bids: 18,
  },
  {
    e: "⌚",
    n: "Apple Watch Series 9",
    p: "₱18,000",
    seller: "GadgetPH",
    time: "6h",
    bids: 9,
  },
];

let wonItems = [
  {
    e: "🎧",
    n: "Sony WH-1000XM5",
    p: "₱8,500",
    date: "Feb 25",
    seller: "AudioPH",
    s: "Delivered",
  },
  {
    e: "⌚",
    n: "Vintage Rolex Submariner",
    p: "₱15,000",
    date: "Feb 15",
    seller: "LuxuryMNL",
    s: "Processing",
  },
  {
    e: "👟",
    n: "Yeezy Boost 350 V2",
    p: "₱6,200",
    date: "Feb 10",
    seller: "SneakersPH",
    s: "Delivered",
  },
  {
    e: "📷",
    n: "Fujifilm X-T5 Camera",
    p: "₱52,000",
    date: "Feb 3",
    seller: "GadgetPH",
    s: "Delivered",
  },
];

const buyerReviews = [
  {
    av: "MR",
    bg: "linear-gradient(135deg,#7c3aed,#2563eb)",
    name: "Maria Reyes",
    rating: 5,
    date: "Feb 27",
    text: "Super legit seller! Nakatanggap ako ng iPhone exactly as described. Fast shipping din! Will definitely buy again 🙌",
    item: "iPhone 15 Pro Max",
  },
  {
    av: "TH",
    bg: "linear-gradient(135deg,#f59e0b,#ea580c)",
    name: "TechHub PH",
    rating: 5,
    date: "Feb 20",
    text: "Very responsive and trustworthy. Canon camera arrived in perfect condition with all accessories. Highly recommended!",
    item: "Canon EOS R50",
  },
  {
    av: "KS",
    bg: "linear-gradient(135deg,#10b981,#0891b2)",
    name: "Karl Sneakers",
    rating: 4,
    date: "Feb 15",
    text: "Good transaction overall. Item was as described. Packaging could be better but product is great.",
    item: "Casio G-Shock",
  },
  {
    av: "AN",
    bg: "linear-gradient(135deg,#ec4899,#8b5cf6)",
    name: "Ana Navarro",
    rating: 5,
    date: "Feb 10",
    text: "Best seller on BiliBid! Super honest ang description ng item. MacBook Pro arrived sealed pa. 100% legit! 💯",
    item: "MacBook Pro 2022",
  },
  {
    av: "JD",
    bg: "linear-gradient(135deg,#4b5563,#374151)",
    name: "Juan Dela Cruz",
    rating: 5,
    date: "Feb 3",
    text: "Smooth transaction. Item exactly as described. Fast response sa messages. Trusted seller talaga!",
    item: "Sony Camera Lens",
  },
];

const posts = [
  {
    id: "p1",
    av: "MR",
    avbg: "linear-gradient(135deg,#7c3aed,#2563eb)",
    author: "Maria Reyes",
    verified: true,
    badge: "⭐ Top Seller",
    time: "2 hours ago",
    cat: "Electronics",
    e: "📱",
    title: "iPhone 15 Pro Max 256GB — Deep Titanium",
    desc: "Brand new, sealed in box. Apple PH warranty. Bought as a gift but already have one. Complete with original receipt.",
    tags: ["📱 iPhone", "✨ Brand New", "📦 Free Shipping", "🇵🇭 Metro Manila"],
    bid: 28500,
    bids: 47,
    startBid: 20000,
    buyNow: 32000,
    secs: 7800,
    prog: 78,
    live: true,
    likes: 84,
    filter: "Electronics",
  },
  {
    id: "p2",
    av: "TH",
    avbg: "linear-gradient(135deg,#f59e0b,#ea580c)",
    author: "TechHub PH",
    verified: true,
    badge: null,
    time: "5 hours ago",
    cat: "Computers",
    e: "💻",
    title: "MacBook Air M2 — Midnight, 8GB/256GB",
    desc: "Unit only, complete accessories, international warranty. 2 months old, mint condition. Upgrading to Pro.",
    tags: ["💻 MacBook", "🍎 Apple M2", "✅ Verified Seller"],
    bid: 62000,
    bids: 31,
    startBid: 50000,
    buyNow: 70000,
    secs: 67440,
    prog: 45,
    live: false,
    likes: 112,
    filter: "Electronics",
  },
  {
    id: "p3",
    av: "KS",
    avbg: "linear-gradient(135deg,#10b981,#0891b2)",
    author: "Karl Sneakers PH",
    verified: false,
    badge: null,
    time: "1 day ago",
    cat: "Sneakers",
    e: "👟",
    title: 'Nike Air Jordan 1 Retro High OG "Chicago"',
    desc: "Pre-loved, worn once. US10 / EU44. 100% authentic with receipt. Original box included. No box damage.",
    tags: ["👟 Jordan 1", "🔥 Rare", "📦 With Box", "💯 Legit Check"],
    bid: 4200,
    bids: 23,
    startBid: 2000,
    buyNow: null,
    secs: 2402,
    prog: 92,
    live: true,
    likes: 67,
    filter: "Sneakers",
  },
  {
    id: "p4",
    av: "GH",
    avbg: "linear-gradient(135deg,#8b5cf6,#ec4899)",
    author: "GamersHub PH",
    verified: true,
    badge: null,
    time: "3 hours ago",
    cat: "Gaming",
    e: "🎮",
    title: "Nintendo Switch OLED — White Edition",
    desc: "Barely used, comes with carrying case and original box. Great condition, no scratches on screen.",
    tags: ["🎮 Nintendo", "OLED", "📦 With Box", "✨ Like New"],
    bid: 10000,
    bids: 18,
    startBid: 8000,
    buyNow: 15000,
    secs: 3900,
    prog: 60,
    live: false,
    likes: 43,
    filter: "Gaming",
  },
];

let timers = {};
posts.forEach(function (p) {
  timers[p.id] = p.secs;
  postComments[p.id] = [
    {
      av: "JD",
      bg: "linear-gradient(135deg,#4b5563,#374151)",
      author: "Juan D.",
      text: "Is this still available?",
      time: "1h ago",
    },
    {
      av: "AN",
      bg: "linear-gradient(135deg,#ec4899,#8b5cf6)",
      author: "Ana N.",
      text: "What's the lowest?",
      time: "30m ago",
    },
  ];
});

// ===== TIMERS =====
function pad(n) {
  return String(n).padStart(2, "0");
}
setInterval(function () {
  posts.forEach(function (p) {
    if (timers[p.id] > 0) timers[p.id]--;
    var el = document.getElementById("tmr-" + p.id);
    if (!el) return;
    var t = timers[p.id],
      h = Math.floor(t / 3600),
      m = Math.floor((t % 3600) / 60),
      s = t % 60;
    el.innerHTML =
      '<div class="time-unit"><div class="time-num">' +
      pad(h) +
      '</div><div class="time-label">hrs</div></div><div class="time-unit"><div class="time-num">' +
      pad(m) +
      '</div><div class="time-label">min</div></div><div class="time-unit"><div class="time-num">' +
      pad(s) +
      '</div><div class="time-label">sec</div></div>';
  });
}, 1000);

// ===== NAVIGATE =====
function navigate(page) {
  document.querySelectorAll(".page").forEach(function (p) {
    p.classList.remove("active");
  });
  document.querySelectorAll(".nav-item").forEach(function (n) {
    n.classList.remove("active");
  });
  var pg = document.getElementById("page-" + page);
  if (pg) pg.classList.add("active");
  var nv = document.getElementById("nav-" + page);
  if (nv) nv.classList.add("active");
  if (page === "feed") renderFeed();
  if (page === "my-auctions") renderMyAuct("active");
  if (page === "watchlist") renderWatchlist();
  if (page === "won") renderWon();
  if (page === "notifications") renderNotifs();
  if (page === "wallet") renderWallet();
  if (page === "profile") renderProfile();
  window.scrollTo(0, 0);
}

// ===== FEED =====
function renderFeed() {
  var fp = posts.slice();
  if (feedFilter === "ending")
    fp.sort(function (a, b) {
      return timers[a.id] - timers[b.id];
    });
  else if (feedFilter !== "all" && feedFilter !== "following")
    fp = posts.filter(function (p) {
      return p.filter === feedFilter;
    });
  var container = document.getElementById("postsContainer");
  if (container) container.innerHTML = fp.map(buildPost).join("");
}

function buildPost(p) {
  var bid = p.bid,
    bids = p.bids,
    liked = likedPosts[p.id],
    watched = watchedPosts[p.id];
  var ending = timers[p.id] < 3600;
  var cs = postComments[p.id] || [];
  var safeAuthor = p.author.replace(/'/g, "\\'");
  var html = '<div class="auction-post" id="' + p.id + '">';
  html += '<div class="post-header">';
  html +=
    '<div class="post-avatar" style="background:' +
    p.avbg +
    '" onclick="openChatByName(\'' +
    safeAuthor +
    "')\">" +
    p.av +
    "</div>";
  html +=
    '<div class="post-meta"><div class="post-author">' +
    escapeHtml(p.author) +
    (p.verified ? ' <span class="verified">✓</span>' : "") +
    (p.badge
      ? ' <span class="seller-badge">' + escapeHtml(p.badge) + "</span>"
      : "") +
    "</div>";
  html +=
    '<div class="post-time">' +
    escapeHtml(p.time) +
    " · " +
    escapeHtml(p.cat) +
    "</div></div>";
  html +=
    '<div class="post-menu-wrap"><div class="post-menu" onclick="toggleMenu(\'' +
    p.id +
    "')\">···</div>";
  html += '<div class="post-menu-dropdown" id="menu-' + p.id + '">';
  html +=
    '<div class="menu-opt" onclick="closeMenus();openChatByName(\'' +
    safeAuthor +
    "')\">💬 Message Seller</div>";
  html +=
    '<div class="menu-opt" onclick="closeMenus();doWatch(\'' +
    p.id +
    "')\">👁️ " +
    (watched ? "Unwatch" : "Watch Item") +
    "</div>";
  html +=
    '<div class="menu-opt" onclick="closeMenus();doShare()">🔗 Share Listing</div>';
  html +=
    "<div class=\"menu-opt danger\" onclick=\"closeMenus();toast('✅ Reported','info')\">🚩 Report</div></div></div></div>";
  html +=
    '<div class="post-product-img" onclick="doWatch(\'' +
    p.id +
    "')\">" +
    p.e +
    (p.live
      ? '<div class="img-overlay"><div class="live-dot"></div> LIVE AUCTION</div>'
      : "") +
    "</div>";
  html += '<div class="post-body">';
  html += '<div class="post-title">' + escapeHtml(p.title) + "</div>";
  html += '<div class="post-desc">' + escapeHtml(p.desc) + "</div>";
  html +=
    '<div class="post-tags">' +
    p.tags
      .map(function (t) {
        return '<span class="tag">' + escapeHtml(t) + "</span>";
      })
      .join("") +
    "</div>";
  html += '<div class="bid-section"><div class="bid-row"><div>';
  html += '<div class="bid-label">Current Bid</div>';
  html +=
    '<div class="bid-amount" id="ba-' +
    p.id +
    '">₱' +
    bid.toLocaleString() +
    "</div>";
  html +=
    '<div class="bid-count" id="bc-' +
    p.id +
    '">' +
    bids +
    " bids · " +
    (watched ? "👁️ Watching" : "Not watching") +
    "</div></div>";
  html +=
    '<div><div class="bid-label">Time Left</div><div class="timer" id="tmr-' +
    p.id +
    '">';
  html +=
    '<div class="time-unit"><div class="time-num">' +
    pad(Math.floor(p.secs / 3600)) +
    '</div><div class="time-label">hrs</div></div>';
  html +=
    '<div class="time-unit"><div class="time-num">' +
    pad(Math.floor((p.secs % 3600) / 60)) +
    '</div><div class="time-label">min</div></div>';
  html +=
    '<div class="time-unit"><div class="time-num">' +
    pad(p.secs % 60) +
    '</div><div class="time-label">sec</div></div></div></div></div>';
  html +=
    '<div class="bid-progress"><div class="bid-progress-fill" style="width:' +
    p.prog +
    "%;" +
    (ending ? "background:linear-gradient(90deg,var(--red),var(--gold))" : "") +
    '"></div></div>';
  html +=
    '<div style="font-size:11px;color:' +
    (ending ? "var(--red)" : "var(--muted2)") +
    ";margin-top:6px;font-weight:" +
    (ending ? 700 : 400) +
    '">' +
    (ending
      ? "⚠️ Ending very soon!"
      : "Starting: ₱" +
        p.startBid.toLocaleString() +
        (p.buyNow ? " · Buy Now: ₱" + p.buyNow.toLocaleString() : "")) +
    "</div></div>";
  html += '<div class="bid-input-row" style="margin-top:14px">';
  html +=
    '<input class="bid-input" type="number" id="bi-' +
    p.id +
    '" placeholder="Min ₱' +
    (bid + 100).toLocaleString() +
    '">';
  html +=
    '<button class="bid-btn' +
    (ending ? " gold-btn" : "") +
    '" onclick="placeBid(\'' +
    p.id +
    "')\">🔥 " +
    (ending ? "⚡ NOW!" : "Place Bid") +
    "</button></div>";
  if (p.buyNow)
    html +=
      '<button class="bid-btn gold-btn" style="width:100%;padding:12px" onclick="buyNow(\'' +
      p.id +
      "'," +
      p.buyNow +
      ')">⚡ Buy Now — ₱' +
      p.buyNow.toLocaleString() +
      "</button>";
  html += "</div>";
  html += '<div class="post-actions">';
  html +=
    '<button class="post-action' +
    (liked ? " liked" : "") +
    '" id="like-' +
    p.id +
    '" onclick="doLike(\'' +
    p.id +
    '\')">❤️ <span id="lc-' +
    p.id +
    '">' +
    (p.likes + (liked ? 1 : 0)) +
    "</span></button>";
  html +=
    '<button class="post-action" onclick="toggleComments(\'' +
    p.id +
    '\')">💬 <span id="cc-' +
    p.id +
    '">' +
    cs.length +
    "</span> Comments</button>";
  html +=
    '<button class="post-action' +
    (watched ? " watching" : "") +
    '" id="wbtn-' +
    p.id +
    '" onclick="doWatch(\'' +
    p.id +
    "')\">👁️ " +
    (watched ? "Watching" : "Watch") +
    "</button>";
  html +=
    '<button class="post-action" onclick="doShare()">↗️ Share</button></div>';
  html += '<div class="comments-section" id="cmts-' + p.id + '">';
  html += '<div class="comment-input-row">';
  html +=
    '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--blue),var(--gold));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:11px;color:#fff;flex-shrink:0">JN</div>';
  html +=
    '<input class="comment-input" id="cin-' +
    p.id +
    '" placeholder="Write a comment..." onkeydown="if(event.key===\'Enter\')addComment(\'' +
    p.id +
    "')\">";
  html +=
    '<button class="comment-send" onclick="addComment(\'' +
    p.id +
    "')\">➤</button></div>";
  html +=
    '<div id="clist-' +
    p.id +
    '">' +
    cs.map(buildCommentHtml).join("") +
    "</div></div></div>";
  return html;
}

function buildCommentHtml(c) {
  return (
    '<div class="comment-item"><div class="comment-av" style="background:' +
    c.bg +
    '">' +
    escapeHtml(c.av) +
    '</div><div class="comment-bubble"><div class="comment-author">' +
    escapeHtml(c.author) +
    '</div><div class="comment-text">' +
    escapeHtml(c.text) +
    '</div><div class="comment-actions"><button class="comment-action" onclick="toast(\'👍 Liked!\',\'info\')">👍 Like</button><button class="comment-action" onclick="toast(\'💬 Reply...\',\'info\')">💬 Reply</button><span style="font-size:11px;color:var(--muted)">' +
    escapeHtml(c.time) +
    "</span></div></div></div>"
  );
}

function setFilter(el, f) {
  document.querySelectorAll(".filter-tab").forEach(function (t) {
    t.classList.remove("active");
  });
  el.classList.add("active");
  feedFilter = f;
  renderFeed();
}
function filterCat(cat) {
  navigate("feed");
  feedFilter = cat;
  document.querySelectorAll(".filter-tab").forEach(function (t) {
    t.classList.remove("active");
  });
  renderFeed();
  toast("🔍 " + cat, "info");
}

// ===== BID ACTIONS =====
function placeBid(pid) {
  var el = document.getElementById("bi-" + pid);
  var val = parseInt(el ? el.value : "");
  var post = posts.find(function (p) {
    return p.id === pid;
  });
  if (!post) return;
  if (!val || isNaN(val)) {
    toast("⚠️ Enter a bid amount first!", "error");
    return;
  }
  if (val <= post.bid) {
    toast("⚠️ Bid must be higher than ₱" + post.bid.toLocaleString(), "error");
    return;
  }
  if (walletBal < val) {
    toast("⚠️ Insufficient wallet balance!", "error");
    navigate("wallet");
    return;
  }
  showConfirm(
    "🔥",
    "Place Bid",
    "Bid <strong>₱" + val.toLocaleString() + "</strong> on this item?",
    "Place Bid",
    false,
    function () {
      post.bid = val;
      post.bids++;
      var baEl = document.getElementById("ba-" + pid),
        bcEl = document.getElementById("bc-" + pid);
      if (baEl) baEl.textContent = "₱" + val.toLocaleString();
      if (bcEl)
        bcEl.textContent =
          post.bids +
          " bids · " +
          (watchedPosts[pid] ? "👁️ Watching" : "Not watching");
      if (el) {
        el.value = "";
        el.placeholder = "Min ₱" + (val + 100).toLocaleString();
      }
      toast("🔥 Bid of ₱" + val.toLocaleString() + " placed!", "success");
      addNotif("🔥", "You placed a bid of ₱" + val.toLocaleString() + "!");
    },
  );
}

function buyNow(pid, price) {
  if (walletBal < price) {
    toast("⚠️ Insufficient balance!", "error");
    navigate("wallet");
    return;
  }
  showConfirm(
    "⚡",
    "Buy Now",
    "Buy for <strong>₱" +
      price.toLocaleString() +
      "</strong>? Deducted from wallet.",
    "Buy Now!",
    false,
    function () {
      walletBal -= price;
      txList.unshift({
        icon: "🏆",
        name: "Won via Buy Now",
        date: "Just now",
        amt: -price,
        type: "debit",
      });
      wonItems.unshift({
        e: "🛒",
        n: "New Purchase",
        p: "₱" + price.toLocaleString(),
        date: "Today",
        seller: "Seller",
        s: "Processing",
      });
      toast("🎉 Purchased for ₱" + price.toLocaleString() + "!", "success");
      addNotif("🎉", "You bought an item for ₱" + price.toLocaleString() + "!");
    },
  );
}

// ===== LIKE/WATCH/SHARE =====
function doLike(pid) {
  likedPosts[pid] = !likedPosts[pid];
  var post = posts.find(function (p) {
    return p.id === pid;
  });
  if (!post) return;
  var lcEl = document.getElementById("lc-" + pid);
  if (lcEl) lcEl.textContent = post.likes + (likedPosts[pid] ? 1 : 0);
  var btn = document.getElementById("like-" + pid);
  if (btn) btn.className = "post-action" + (likedPosts[pid] ? " liked" : "");
  toast(likedPosts[pid] ? "❤️ Liked!" : "💔 Unliked", "info");
}
function doWatch(pid) {
  watchedPosts[pid] = !watchedPosts[pid];
  var btn = document.getElementById("wbtn-" + pid);
  if (btn) {
    btn.className = "post-action" + (watchedPosts[pid] ? " watching" : "");
    btn.textContent = "👁️ " + (watchedPosts[pid] ? "Watching" : "Watch");
  }
  var bc = document.getElementById("bc-" + pid),
    post = posts.find(function (p) {
      return p.id === pid;
    });
  if (bc && post)
    bc.textContent =
      post.bids +
      " bids · " +
      (watchedPosts[pid] ? "👁️ Watching" : "Not watching");
  toast(
    watchedPosts[pid] ? "👁️ Added to Watchlist!" : "Removed from Watchlist",
    "info",
  );
}
function doShare() {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText)
      navigator.clipboard.writeText(window.location.href);
  } catch (e) {}
  toast("🔗 Link copied!", "success");
}

// ===== COMMENTS =====
function toggleComments(pid) {
  var el = document.getElementById("cmts-" + pid);
  if (!el) return;
  el.classList.toggle("open");
  if (el.classList.contains("open")) {
    var c = document.getElementById("cin-" + pid);
    if (c) c.focus();
  }
}
function addComment(pid) {
  var input = document.getElementById("cin-" + pid);
  if (!input) return;
  var text = input.value.trim();
  if (!text) return;
  if (!postComments[pid]) postComments[pid] = [];
  var nc = {
    av: "JN",
    bg: "linear-gradient(135deg,var(--blue),var(--gold))",
    author: "Jarme N.",
    text: text,
    time: "Just now",
  };
  postComments[pid].push(nc);
  var list = document.getElementById("clist-" + pid);
  if (list) list.innerHTML += buildCommentHtml(nc);
  var ccEl = document.getElementById("cc-" + pid);
  if (ccEl) ccEl.textContent = postComments[pid].length;
  input.value = "";
  toast("💬 Comment posted!", "success");
}

// ===== POST MENU =====
function toggleMenu(pid) {
  closeMenus();
  var m = document.getElementById("menu-" + pid);
  if (m) m.classList.toggle("open");
}
function closeMenus() {
  document.querySelectorAll(".post-menu-dropdown").forEach(function (m) {
    m.classList.remove("open");
  });
}
document.addEventListener("click", function (e) {
  if (!e.target.closest(".post-menu-wrap")) closeMenus();
});

// ===== MY AUCTIONS =====
function renderMyAuct(tab) {
  var items = myListings[tab] || [],
    c = document.getElementById("myAuctContent");
  if (!c) return;
  if (!items.length) {
    c.innerHTML =
      '<div class="card" style="text-align:center;color:var(--muted2)"><div style="font-size:48px;margin-bottom:12px">📦</div><div>No listings here.</div><button class="btn-submit" style="margin-top:16px" onclick="checkVerifiedAndPost()">＋ Post Auction</button></div>';
    return;
  }
  c.innerHTML = items
    .map(function (item, i) {
      var actions = "";
      if (tab === "active") {
        actions =
          "<button class=\"listing-action-btn\" onclick=\"toast('✏️ Edit listing','info')\">✏️ Edit</button><button class=\"listing-action-btn\" onclick=\"toast('📊 Viewing bids...','info')\">📊 Bids (" +
          item.b +
          ')</button><button class="listing-action-btn" onclick="toast(\'⚡ Listing promoted!\',\'success\')">⚡ Promote</button><button class="listing-action-btn danger" onclick="deleteActiveListing(' +
          i +
          ')">🗑️ Delete</button>';
      } else if (tab === "ended") {
        actions =
          '<button class="listing-action-btn" onclick="checkVerifiedAndPost()">🔄 Relist</button><button class="listing-action-btn" onclick="toast(\'📊 View analytics\',\'info\')">📊 Analytics</button>';
      } else {
        actions =
          "<button class=\"listing-action-btn\" onclick=\"toast('📦 Tracking: In Transit','info')\">📦 Track</button><button class=\"listing-action-btn\" onclick=\"toast('⭐ Review submitted!','success')\">⭐ Review</button>";
      }
      return (
        '<div class="card" style="display:flex;gap:14px;align-items:center;padding:14px"><div style="width:56px;height:56px;border-radius:12px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0">' +
        item.e +
        '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;margin-bottom:2px">' +
        escapeHtml(item.n) +
        "</div><div style=\"color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:15px\">" +
        escapeHtml(item.p) +
        '</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">' +
        item.b +
        " bids · " +
        escapeHtml(item.t) +
        " · " +
        escapeHtml(item.c) +
        '</div><div class="listing-actions">' +
        actions +
        "</div></div></div>"
      );
    })
    .join("");
}
function deleteActiveListing(i) {
  showConfirm(
    "🗑️",
    "Delete Listing",
    "Delete this auction? This cannot be undone.",
    "Delete",
    true,
    function () {
      myListings.active.splice(i, 1);
      renderMyAuct("active");
      toast("🗑️ Listing deleted", "error");
    },
  );
}
function myAuctTab(el, tab) {
  document.querySelectorAll(".tab-sw").forEach(function (t) {
    t.classList.remove("active");
  });
  el.classList.add("active");
  renderMyAuct(tab);
}

// ===== WATCHLIST =====
function renderWatchlist() {
  var c = document.getElementById("watchlistContent");
  if (!c) return;
  if (!watchItems.length) {
    c.innerHTML =
      '<div class="card" style="text-align:center;color:var(--muted2)"><div style="font-size:48px;margin-bottom:12px">👁️</div><div>No items in watchlist.</div><button class="btn-submit" style="margin-top:16px" onclick="navigate(\'feed\')">Browse Auctions</button></div>';
    return;
  }
  c.innerHTML = watchItems
    .map(function (item, i) {
      return (
        '<div class="watchlist-item"><div style="width:60px;height:60px;border-radius:12px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">' +
        item.e +
        '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;margin-bottom:2px">' +
        escapeHtml(item.n) +
        "</div><div style=\"color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:15px\">" +
        escapeHtml(item.p) +
        '</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">by ' +
        escapeHtml(item.seller) +
        " · " +
        item.bids +
        " bids · ⏰ " +
        escapeHtml(item.time) +
        ' left</div><div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap"><input style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:var(--text);font-size:12px;width:120px;outline:none" type="number" placeholder="₱ Your bid" id="wb-' +
        i +
        '"><button class="bid-btn" style="padding:6px 14px;font-size:12px" onclick="wBid(' +
        i +
        ')">Bid Now 🔥</button><button class="remove-watch" onclick="removeWatch(' +
        i +
        ')">✕ Remove</button></div></div></div>'
      );
    })
    .join("");
}
function wBid(i) {
  var inputEl = document.getElementById("wb-" + i),
    v = inputEl ? inputEl.value : "";
  if (!v) {
    toast("⚠️ Enter a bid", "error");
    return;
  }
  showConfirm(
    "🔥",
    "Place Bid",
    "Bid <strong>₱" + parseInt(v).toLocaleString() + "</strong>?",
    "Bid!",
    false,
    function () {
      toast("🔥 Bid placed!", "success");
      var el = document.getElementById("wb-" + i);
      if (el) el.value = "";
    },
  );
}
function removeWatch(i) {
  showConfirm(
    "👁️",
    "Remove",
    "Remove this item from watchlist?",
    "Remove",
    true,
    function () {
      watchItems.splice(i, 1);
      renderWatchlist();
      toast("Removed from watchlist", "info");
      var wb = document.getElementById("watchBadge");
      if (wb) wb.textContent = watchItems.length;
    },
  );
}

// ===== WON AUCTIONS =====
function renderWon() {
  var c = document.getElementById("wonContent");
  if (!c) return;
  if (!wonItems.length) {
    c.innerHTML =
      '<div class="card" style="text-align:center;color:var(--muted2)"><div style="font-size:48px;margin-bottom:12px">🏆</div><div>No won auctions yet.</div></div>';
    return;
  }
  c.innerHTML = wonItems
    .map(function (item) {
      var actionBtn =
        item.s === "Delivered"
          ? '<button class="bid-btn" style="padding:7px 14px;font-size:12px;flex-shrink:0" onclick="toast(\'⭐ Review submitted!\',\'success\')">⭐ Review</button>'
          : '<button class="bid-btn gold-btn" style="padding:7px 14px;font-size:12px;flex-shrink:0" onclick="toast(\'📦 Tracking: In Transit\',\'info\')">📦 Track</button>';
      var sc = item.s === "Delivered" ? "var(--green)" : "var(--gold)",
        st = item.s === "Delivered" ? "✓ Delivered" : "⏳ " + item.s;
      return (
        '<div class="won-item"><div style="width:60px;height:60px;border-radius:12px;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:28px;flex-shrink:0">' +
        item.e +
        '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:14px;margin-bottom:2px">' +
        escapeHtml(item.n) +
        "</div><div style=\"color:var(--gold);font-family:'Syne',sans-serif;font-weight:700;font-size:15px\">" +
        escapeHtml(item.p) +
        '</div><div style="font-size:11px;color:var(--muted2);margin-top:2px">from ' +
        escapeHtml(item.seller) +
        " · " +
        escapeHtml(item.date) +
        ' · <span style="color:' +
        sc +
        '">' +
        st +
        "</span></div></div>" +
        actionBtn +
        "</div>"
      );
    })
    .join("");
}

// ===== NOTIFICATIONS =====
function renderSidebarNotifs() {
  var c = document.getElementById("sidebarNotifs");
  if (!c) return;
  c.innerHTML = notifs
    .slice(0, 3)
    .map(function (n) {
      return (
        '<div class="notif-item' +
        (n.read ? "" : " unread") +
        '" onclick="markRead(' +
        n.id +
        ')"><div class="notif-dot" style="background:' +
        (n.read ? "var(--muted)" : "var(--blue)") +
        '"></div><div><div class="notif-text">' +
        n.text +
        '</div><div class="notif-time">' +
        n.time +
        "</div></div></div>"
      );
    })
    .join("");
}
function renderNotifs() {
  var c = document.getElementById("notifContent");
  if (!c) return;
  c.innerHTML = notifs
    .map(function (n) {
      return (
        '<div class="notif-item' +
        (n.read ? "" : " unread") +
        '" onclick="markRead(' +
        n.id +
        ')"><div style="font-size:24px;flex-shrink:0;width:40px;text-align:center">' +
        n.icon +
        '</div><div style="flex:1"><div class="notif-text">' +
        n.text +
        '</div><div class="notif-time">' +
        n.time +
        "</div></div>" +
        (n.read
          ? ""
          : '<div class="notif-dot" style="flex-shrink:0;margin:0"></div>') +
        "</div>"
      );
    })
    .join("");
}
function markRead(id) {
  var n = notifs.find(function (x) {
    return x.id === id;
  });
  if (n && !n.read) {
    n.read = true;
    notifCount = Math.max(0, notifCount - 1);
    updateNB();
    renderSidebarNotifs();
    var np = document.getElementById("page-notifications");
    if (np && np.classList.contains("active")) renderNotifs();
  }
}
function markAllRead() {
  notifs.forEach(function (n) {
    n.read = true;
  });
  notifCount = 0;
  updateNB();
  renderSidebarNotifs();
  renderNotifs();
  toast("✅ All marked read", "success");
}
function updateNB() {
  var b1 = document.getElementById("notifBadge"),
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
function addNotif(icon, text) {
  notifs.unshift({
    id: Date.now(),
    read: false,
    icon: icon,
    text: text,
    time: "Just now",
  });
  notifCount++;
  updateNB();
  renderSidebarNotifs();
}

// ===== WALLET =====
function renderWallet() {
  var balEl = document.getElementById("walletBal");
  if (balEl) balEl.textContent = "₱" + walletBal.toLocaleString() + ".00";
  var txEl = document.getElementById("txContent");
  if (txEl)
    txEl.innerHTML = txList
      .map(function (t) {
        var bg =
            t.type === "credit"
              ? "rgba(16,185,129,.15)"
              : "rgba(239,68,68,.15)",
          pfx = t.type === "credit" ? "+" : "";
        return (
          '<div class="tx-item"><div class="tx-icon" style="background:' +
          bg +
          '">' +
          t.icon +
          '</div><div style="flex:1"><div class="tx-name">' +
          escapeHtml(t.name) +
          '</div><div class="tx-date">' +
          escapeHtml(t.date) +
          '</div></div><div class="tx-amount ' +
          t.type +
          '">' +
          pfx +
          "₱" +
          Math.abs(t.amt).toLocaleString() +
          "</div></div>"
        );
      })
      .join("");
}

function walletAction(type) {
  walletType = type;
  var titles = {
    add: "💳 Add Funds",
    send: "↗️ Send Money",
    withdraw: "↓ Withdraw",
  };
  var subs = {
    add: "Add money to your BiliBid wallet",
    send: "Send money to another user",
    withdraw: "Withdraw to bank or e-wallet",
  };
  var g = function (id) {
    return document.getElementById(id);
  };
  if (g("wmTitle")) g("wmTitle").textContent = titles[type] || "Action";
  if (g("wmSub")) g("wmSub").textContent = subs[type] || "";
  if (g("wmBtn"))
    g("wmBtn").textContent =
      type === "add" ? "Add Funds" : type === "send" ? "Send" : "Withdraw";
  if (g("wmAmt")) g("wmAmt").value = "";
  renderPaymentMethodSelect(type);
  var walletModal = g("walletModal");
  if (walletModal) walletModal.classList.add("open");
}

function renderPaymentMethodSelect(type) {
  var wrap = document.getElementById("wmMethodWrap");
  if (!wrap) return;
  var options = "";
  if (type === "add")
    options =
      '<option value="GCash">GCash</option><option value="Maya">Maya</option><option value="BDO ATM">BDO ATM/Debit Card</option><option value="BPI ATM">BPI ATM/Debit Card</option><option value="Credit Card">Credit / Debit Card</option><option value="UnionBank">UnionBank Online</option>';
  else if (type === "send")
    options =
      '<option value="BiliBid Wallet">BiliBid Wallet (Username)</option><option value="GCash">GCash</option><option value="Maya">Maya</option>';
  else
    options =
      '<option value="GCash">GCash</option><option value="Maya">Maya</option><option value="BDO Bank">BDO Bank Transfer</option><option value="BPI Bank">BPI Bank Transfer</option><option value="UnionBank">UnionBank</option>';
  wrap.innerHTML =
    '<label class="form-label">Payment Method</label><select class="form-select" id="wmMethod" onchange="updateWalletExtraFields(\'' +
    type +
    "',this.value)\">" +
    options +
    "</select>";
  // Render initial extra fields
  var firstVal =
    type === "add" ? "GCash" : type === "send" ? "BiliBid Wallet" : "GCash";
  updateWalletExtraFields(type, firstVal);
}

function updateWalletExtraFields(type, method) {
  var extra = document.getElementById("wmExtra");
  if (!extra) return;
  var html = "";
  if (type === "add") {
    if (method === "GCash" || method === "Maya")
      html =
        '<div class="form-group"><label class="form-label">' +
        method +
        ' Number</label><input class="form-input" id="wmPhone" placeholder="09XX XXX XXXX" maxlength="11"></div>';
    else if (method === "Credit Card")
      html =
        '<div class="form-group"><label class="form-label">Cardholder Name</label><input class="form-input" id="wmCardName" placeholder="Name as it appears on card"></div><div class="form-group"><label class="form-label">Card Number</label><input class="form-input" id="wmCardNum" placeholder="XXXX XXXX XXXX XXXX" maxlength="19" oninput="formatCardNum(this)"></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div class="form-group"><label class="form-label">Expiry (MM/YY)</label><input class="form-input" id="wmExpiry" placeholder="MM/YY" maxlength="5" oninput="formatExpiry(this)"></div><div class="form-group"><label class="form-label">CVV</label><input class="form-input" id="wmCvv" placeholder="XXX" maxlength="4" type="password"></div></div>';
    else if (method === "BDO ATM" || method === "BPI ATM")
      html =
        '<div class="form-group"><label class="form-label">' +
        method.replace(" ATM", "") +
        " " +
        'Account Number</label><input class="form-input" id="wmBankNum" placeholder="Account number"></div><div class="form-group"><label class="form-label">Account Name</label><input class="form-input" id="wmAcctName" placeholder="Full name on account"></div>';
    else if (method === "UnionBank")
      html =
        '<div class="form-group"><label class="form-label">UnionBank Account / Username</label><input class="form-input" id="wmBankNum" placeholder="Account number or username"></div>';
  } else if (type === "send") {
    if (method === "BiliBid Wallet")
      html =
        '<div class="form-group"><label class="form-label">Recipient Username</label><input class="form-input" id="wmRecip" placeholder="e.g. @mariasells"></div>';
    else
      html =
        '<div class="form-group"><label class="form-label">' +
        method +
        ' Number</label><input class="form-input" id="wmPhone" placeholder="09XX XXX XXXX" maxlength="11"></div><div class="form-group"><label class="form-label">Account Name</label><input class="form-input" id="wmAcctName" placeholder="Full name on account"></div>';
  } else {
    if (method === "GCash" || method === "Maya")
      html =
        '<div class="form-group"><label class="form-label">' +
        method +
        ' Number</label><input class="form-input" id="wmPhone" placeholder="09XX XXX XXXX" maxlength="11"></div><div class="form-group"><label class="form-label">Account Name</label><input class="form-input" id="wmAcctName" placeholder="Full name on account"></div>';
    else
      html =
        '<div class="form-group"><label class="form-label">' +
        method.replace(" Bank", "") +
        " " +
        'Account Number</label><input class="form-input" id="wmBankNum" placeholder="Account number"></div><div class="form-group"><label class="form-label">Account Name</label><input class="form-input" id="wmAcctName" placeholder="Full name on account"></div>';
  }
  extra.innerHTML = html;
}

function formatCardNum(input) {
  var v = input.value.replace(/\D/g, "").substring(0, 16);
  input.value = v.replace(/(.{4})/g, "$1 ").trim();
}
function formatExpiry(input) {
  var v = input.value.replace(/\D/g, "").substring(0, 4);
  if (v.length >= 2) v = v.substring(0, 2) + "/" + v.substring(2);
  input.value = v;
}

function processWallet() {
  var amtEl = document.getElementById("wmAmt"),
    methodEl = document.getElementById("wmMethod");
  var amt = parseInt(amtEl ? amtEl.value : "");
  if (!amt || isNaN(amt) || amt <= 0) {
    toast("⚠️ Enter a valid amount", "error");
    return;
  }
  if ((walletType === "withdraw" || walletType === "send") && amt > walletBal) {
    toast("⚠️ Insufficient balance", "error");
    return;
  }
  var phone = document.getElementById("wmPhone"),
    cardNum = document.getElementById("wmCardNum"),
    bankNum = document.getElementById("wmBankNum");
  if (phone && !phone.value.trim()) {
    toast("⚠️ Enter the mobile number", "error");
    return;
  }
  if (cardNum && cardNum.value.replace(/\s/g, "").length < 16) {
    toast("⚠️ Enter a valid 16-digit card number", "error");
    return;
  }
  if (bankNum && !bankNum.value.trim()) {
    toast("⚠️ Enter the account number", "error");
    return;
  }
  var method = methodEl ? methodEl.value : "GCash";
  closeWM();
  if (walletType === "add") {
    walletBal += amt;
    txList.unshift({
      icon: "💳",
      name: "Added via " + method,
      date: "Just now",
      amt: amt,
      type: "credit",
    });
    toast("✅ ₱" + amt.toLocaleString() + " added!", "success");
  } else if (walletType === "send") {
    walletBal -= amt;
    txList.unshift({
      icon: "↗️",
      name: "Sent via " + method,
      date: "Just now",
      amt: -amt,
      type: "debit",
    });
    toast("↗️ ₱" + amt.toLocaleString() + " sent!", "success");
  } else {
    walletBal -= amt;
    txList.unshift({
      icon: "↓",
      name: "Withdrawal to " + method,
      date: "Just now",
      amt: -amt,
      type: "debit",
    });
    toast("↓ Withdrawal requested!", "success");
  }
  renderWallet();
}
function closeWM() {
  var wm = document.getElementById("walletModal");
  if (wm) wm.classList.remove("open");
  var wa = document.getElementById("wmAmt");
  if (wa) wa.value = "";
}

// ===== PROFILE =====
function renderProfile() {
  // Verification badge
  var verBadge = document.getElementById("verifiedBadge");
  if (verBadge) {
    if (idVerified)
      verBadge.innerHTML =
        '<span style="background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);border-radius:50px;padding:4px 14px;font-size:12px;color:var(--green);font-weight:600;display:inline-flex;align-items:center;gap:6px">✅ ID Verified</span>';
    else if (idSubmitted)
      verBadge.innerHTML =
        '<span style="background:rgba(245,158,11,.15);border:1px solid rgba(245,158,11,.3);border-radius:50px;padding:4px 14px;font-size:12px;color:var(--gold);font-weight:600;display:inline-flex;align-items:center;gap:6px">⏳ Pending Review</span>';
    else
      verBadge.innerHTML =
        '<span style="background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);border-radius:50px;padding:4px 14px;font-size:12px;color:var(--red);font-weight:600;display:inline-flex;align-items:center;gap:6px">⚠️ Not Verified</span>';
  }
  // Verification section
  var verSection = document.getElementById("verificationSection");
  if (verSection) {
    if (idVerified) {
      verSection.innerHTML =
        '<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:10px">✅</div><div style="font-family:\'Syne\',sans-serif;font-weight:700;font-size:16px;color:var(--green);margin-bottom:6px">ID Verified!</div><div style="font-size:13px;color:var(--muted2)">Your identity has been verified. You can now post and sell items on BiliBid.</div></div>';
    } else if (idSubmitted) {
      verSection.innerHTML =
        '<div style="text-align:center;padding:20px"><div style="font-size:48px;margin-bottom:10px">⏳</div><div style="font-family:\'Syne\',sans-serif;font-weight:700;font-size:16px;color:var(--gold);margin-bottom:6px">Under Review</div><div style="font-size:13px;color:var(--muted2);margin-bottom:14px">Your ID is being reviewed. This usually takes 1-2 business days.</div><button class="btn-cancel" style="font-size:12px;padding:8px 16px" onclick="simulateVerify()">✅ Simulate Approval (Demo)</button></div>';
    } else {
      verSection.innerHTML =
        '<div style="font-size:13px;color:var(--muted2);margin-bottom:16px;line-height:1.6">Upload a valid government ID to verify your account and unlock the ability to post auctions. Accepted: Driver\'s License, Passport, SSS ID, PhilHealth, UMID.</div>' +
        '<div class="upload-area" style="margin-bottom:16px"><input type="file" accept="image/*,.pdf" onchange="handleIdUpload(this)" /><div class="upload-icon" id="idUpIcon">🪪</div><div class="upload-text" id="idUpText">Click to upload your government ID<br><span style="color:var(--muted);font-size:12px">JPG, PNG, PDF · Front side · Max 10MB</span></div></div>' +
        '<div class="form-group"><label class="form-label">ID Type</label><select class="form-select" id="idType"><option>Driver\'s License</option><option>Passport</option><option>SSS ID</option><option>PhilHealth ID</option><option>UMID</option><option>Postal ID</option><option>Voter\'s ID</option></select></div>' +
        '<div class="form-group"><label class="form-label">ID Number</label><input class="form-input" id="idNumber" placeholder="Enter your ID number"></div>' +
        '<div class="form-group"><label class="form-label">Full Legal Name (as on ID)</label><input class="form-input" id="idLegalName" placeholder="Your full name"></div>' +
        '<button class="btn-submit" onclick="submitIdVerification()" style="width:100%">📤 Submit for Verification</button>';
    }
  }
  renderReviews();
  var fcEl = document.getElementById("followerCount"),
    fgEl = document.getElementById("followingCount");
  if (fcEl) fcEl.textContent = followers;
  if (fgEl) fgEl.textContent = following;
}

function handleIdUpload(input) {
  if (input.files && input.files.length) {
    var ui = document.getElementById("idUpIcon"),
      ut = document.getElementById("idUpText");
    if (ui) ui.textContent = "✅";
    if (ut) ut.textContent = "ID photo selected: " + input.files[0].name;
  }
}

function submitIdVerification() {
  var idNum = document.getElementById("idNumber"),
    idName = document.getElementById("idLegalName");
  if (!idNum || !idNum.value.trim()) {
    toast("⚠️ Enter your ID number", "error");
    return;
  }
  if (!idName || !idName.value.trim()) {
    toast("⚠️ Enter your full legal name", "error");
    return;
  }
  idSubmitted = true;
  renderProfile();
  toast("📤 ID submitted for verification!", "success");
  addNotif(
    "🪪",
    "Your ID verification is under review. We'll notify you within 1-2 days.",
  );
}

function simulateVerify() {
  idVerified = true;
  idSubmitted = true;
  var handle = document.querySelector(".profile-handle");
  if (handle)
    handle.innerHTML =
      '@jarmenathaniel · ⭐ 4.9 · <span style="color:var(--green);font-size:11px">✅ Verified</span>';
  renderProfile();
  toast("✅ Account verified! You can now post auctions.", "success");
  addNotif(
    "✅",
    "Your identity has been verified! You can now post and sell items.",
  );
}

function renderReviews() {
  var c = document.getElementById("reviewsContent");
  if (!c) return;
  var avg = (
    buyerReviews.reduce(function (s, r) {
      return s + r.rating;
    }, 0) / buyerReviews.length
  ).toFixed(1);
  var stars = function (n) {
    return "⭐".repeat(n) + "☆".repeat(5 - n);
  };
  var barHtml = [5, 4, 3, 2, 1]
    .map(function (star) {
      var count = buyerReviews.filter(function (r) {
        return r.rating === star;
      }).length;
      var pct = Math.round((count / buyerReviews.length) * 100);
      return (
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px"><span style="font-size:11px;color:var(--muted2);width:8px">' +
        star +
        '</span><div style="flex:1;height:6px;background:var(--surface3);border-radius:6px;overflow:hidden"><div style="height:100%;width:' +
        pct +
        '%;background:var(--gold);border-radius:6px"></div></div><span style="font-size:11px;color:var(--muted2);width:20px">' +
        count +
        "</span></div>"
      );
    })
    .join("");
  c.innerHTML =
    '<div style="display:flex;align-items:center;gap:20px;background:var(--surface2);border-radius:14px;padding:16px;margin-bottom:16px;border:1px solid var(--border)"><div style="text-align:center"><div style="font-family:\'Syne\',sans-serif;font-weight:800;font-size:42px;color:var(--gold)">' +
    avg +
    '</div><div style="font-size:18px">⭐⭐⭐⭐⭐</div><div style="font-size:12px;color:var(--muted2);margin-top:4px">' +
    buyerReviews.length +
    ' reviews</div></div><div style="flex:1">' +
    barHtml +
    "</div></div>" +
    buyerReviews
      .map(function (r) {
        return (
          '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:14px;padding:14px;margin-bottom:10px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:10px"><div style="width:38px;height:38px;border-radius:50%;background:' +
          r.bg +
          ';display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;color:#fff;flex-shrink:0">' +
          r.av +
          '</div><div style="flex:1"><div style="font-weight:700;font-size:13px">' +
          escapeHtml(r.name) +
          '</div><div style="font-size:11px;color:var(--muted2)">' +
          r.date +
          " · " +
          escapeHtml(r.item) +
          '</div></div><div style="font-size:14px">' +
          stars(r.rating) +
          '</div></div><div style="font-size:13px;color:var(--muted2);line-height:1.6">' +
          escapeHtml(r.text) +
          "</div></div>"
        );
      })
      .join("");
}

function saveProfile() {
  var en = document.getElementById("editName"),
    dn = document.getElementById("dispName");
  if (en && dn) dn.textContent = en.value;
  toast("✅ Profile saved!", "success");
}
function savePassword() {
  toast("🔒 Password updated!", "success");
}

// ===== ID CHECK / POST =====
function checkVerifiedAndPost() {
  if (!idVerified) {
    showConfirm(
      "🪪",
      "ID Verification Required",
      "You need to verify your identity before you can post or sell items. Go to your Profile to submit your ID.",
      "Go to Profile",
      false,
      function () {
        navigate("profile");
      },
    );
    return;
  }
  openModal();
}

function openModal() {
  if (!idVerified) {
    checkVerifiedAndPost();
    return;
  }
  var modal = document.getElementById("postModal");
  if (modal) modal.classList.add("open");
}

function closeModal() {
  var modal = document.getElementById("postModal");
  if (modal) modal.classList.remove("open");
  ["pTitle", "pDesc", "pBid", "pBuyNow"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = "";
  });
  var ui = document.getElementById("upIcon"),
    ut = document.getElementById("upText");
  if (ui) ui.textContent = "📸";
  if (ut)
    ut.innerHTML =
      'Click to upload photos (up to 10 images)<br><span style="color:var(--muted);font-size:12px">JPG, PNG, WebP</span>';
}

function handleUpload(input) {
  if (input.files && input.files.length) {
    var ui = document.getElementById("upIcon"),
      ut = document.getElementById("upText");
    if (ui) ui.textContent = "✅";
    if (ut) ut.textContent = input.files.length + " photo(s) selected";
  }
}

function submitPost() {
  var pTitle = document.getElementById("pTitle"),
    pBid = document.getElementById("pBid"),
    pDesc = document.getElementById("pDesc"),
    pCat = document.getElementById("pCat"),
    pCond = document.getElementById("pCond"),
    pBuyNow = document.getElementById("pBuyNow"),
    pShip = document.getElementById("pShip");
  var title = pTitle ? pTitle.value.trim() : "",
    bid = parseInt(pBid ? pBid.value : "");
  if (!title) {
    toast("⚠️ Add a title", "error");
    return;
  }
  if (!bid || isNaN(bid)) {
    toast("⚠️ Set a starting bid", "error");
    return;
  }
  var cat = pCat ? pCat.value : "Electronics",
    cond = pCond ? pCond.value : "Brand New";
  var buyNowVal = pBuyNow ? parseInt(pBuyNow.value) : null,
    shipText = pShip ? pShip.value.split(" ")[0] : "Free";
  var descText = pDesc ? pDesc.value || "No description." : "No description.";
  closeModal();
  var newPost = {
    id: "np" + Date.now(),
    av: "JN",
    avbg: "linear-gradient(135deg,var(--blue),var(--gold))",
    author: "Jarme Nathaniel",
    verified: true,
    badge: null,
    time: "Just now",
    cat: cat,
    e: "🏷️",
    title: title,
    desc: descText,
    tags: ["✨ " + cond, "📦 " + shipText],
    bid: bid,
    bids: 0,
    startBid: bid,
    buyNow: buyNowVal || null,
    secs: 3600,
    prog: 0,
    live: false,
    likes: 0,
    filter: cat,
  };
  posts.unshift(newPost);
  timers[newPost.id] = 3600;
  postComments[newPost.id] = [];
  myListings.active.unshift({
    e: "🏷️",
    n: title,
    p: "₱" + bid.toLocaleString(),
    b: 0,
    t: "1h",
    c: cond,
  });
  var lc = document.getElementById("listedCount");
  if (lc) lc.textContent = parseInt(lc.textContent) + 1;
  navigate("feed");
  toast("🚀 Auction posted!", "success");
  addNotif("🚀", 'Your auction "' + title + '" is now live!');
}

// ===== CHAT =====
function openChatByName(name) {
  var data = chatData[name] || {
    init: name.slice(0, 2).toUpperCase(),
    bg: "linear-gradient(135deg,#4b5563,#374151)",
    stat: "Unknown",
    msgs: [],
  };
  currentChat = name;
  var cn = document.getElementById("chatName"),
    cs = document.getElementById("chatStat"),
    ca = document.getElementById("chatAv"),
    cp = document.getElementById("chatPopup"),
    me = document.getElementById("chatMsgs");
  if (cn) cn.textContent = name;
  if (cs) cs.textContent = data.stat;
  if (ca) {
    ca.textContent = data.init;
    ca.style.background = data.bg;
  }
  if (me)
    me.innerHTML = data.msgs
      .map(function (m) {
        return (
          '<div class="msg ' +
          m.t +
          '">' +
          escapeHtml(m.tx) +
          '<div class="msg-time">' +
          escapeHtml(m.time) +
          "</div></div>"
        );
      })
      .join("");
  if (cp) cp.classList.add("open");
  setTimeout(function () {
    if (me) me.scrollTop = me.scrollHeight;
  }, 50);
}

function closeChat() {
  var cp = document.getElementById("chatPopup");
  if (cp) cp.classList.remove("open");
}

function sendMsg() {
  var input = document.getElementById("chatIn"),
    text = input ? input.value.trim() : "";
  if (!text) return;
  var now = new Date(),
    time = now.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
    });
  var me = document.getElementById("chatMsgs");
  if (me) {
    me.innerHTML +=
      '<div class="msg me">' +
      escapeHtml(text) +
      '<div class="msg-time">' +
      time +
      "</div></div>";
    me.scrollTop = me.scrollHeight;
  }
  if (input) input.value = "";
  if (!chatData[currentChat])
    chatData[currentChat] = {
      init: currentChat.slice(0, 2).toUpperCase(),
      bg: "linear-gradient(135deg,#4b5563,#374151)",
      stat: "",
      msgs: [],
    };
  chatData[currentChat].msgs.push({ t: "me", tx: text, time: time });
  setTimeout(function () {
    var replies = [
      "Got it, thanks! 😊",
      "Sure, I will check that.",
      "Can you send more photos?",
      "Sounds good!",
      "Let me get back to you on that.",
      "Okay, noted! 👍",
      "Pwede ba meet up? 😊",
      "Salamat sa pag-check! 🙏",
    ];
    var r = replies[Math.floor(Math.random() * replies.length)];
    if (me) {
      me.innerHTML +=
        '<div class="msg them">' +
        escapeHtml(r) +
        '<div class="msg-time">' +
        time +
        "</div></div>";
      me.scrollTop = me.scrollHeight;
    }
    chatData[currentChat].msgs.push({ t: "them", tx: r, time: time });
  }, 900);
}

// ===== FOLLOW =====
function toggleFollow(btn) {
  var isF = btn.getAttribute("data-following") === "true";
  if (isF) {
    btn.setAttribute("data-following", "false");
    btn.textContent = "+ Follow";
    btn.style.background = "linear-gradient(135deg,var(--blue),var(--accent))";
    followers = Math.max(0, followers - 1);
    toast("Unfollowed", "info");
  } else {
    btn.setAttribute("data-following", "true");
    btn.textContent = "✓ Following";
    btn.style.background = "var(--surface3)";
    followers++;
    toast("✅ Following!", "success");
  }
  var fcEl = document.getElementById("followerCount");
  if (fcEl) fcEl.textContent = followers;
}

// ===== SEARCH =====
function showSR() {
  var sr = document.getElementById("searchResults");
  if (sr) sr.style.display = "block";
}
function hideSR() {
  var sr = document.getElementById("searchResults");
  if (sr) sr.style.display = "none";
}
function handleSearch(q) {
  var box = document.getElementById("searchResults");
  if (!box) return;
  var v = (q || "").toLowerCase().trim();
  if (!v) {
    box.style.display = "none";
    return;
  }
  var matches = posts
    .filter(function (p) {
      return (
        p.title.toLowerCase().includes(v) || p.author.toLowerCase().includes(v)
      );
    })
    .slice(0, 6);
  if (!matches.length) {
    box.style.display = "none";
    return;
  }
  box.innerHTML = matches
    .map(function (m) {
      return (
        "<div class=\"search-result-item\" onclick=\"navigate('feed');toast('🔎 Searching...','info')\"><div style=\"width:36px;height:36px;border-radius:8px;background:" +
        m.avbg +
        ';display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px">' +
        m.av +
        '</div><div style="flex:1;min-width:0"><div style="font-weight:700;font-size:13px">' +
        escapeHtml(m.title) +
        '</div><div style="font-size:12px;color:var(--muted2)">' +
        escapeHtml(m.author) +
        "</div></div></div>"
      );
    })
    .join("");
  box.style.display = "block";
}

// ===== UTILITIES =====
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, function (c) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c];
  });
}

function toast(msg, type) {
  var t = document.getElementById("toast");
  if (!t) return;
  t.className = "toast show";
  if (type) t.classList.add(type);
  t.innerHTML = msg;
  setTimeout(function () {
    t.className = "toast";
  }, 2500);
}

function showConfirm(icon, title, msg, okText, danger, cb) {
  confirmCb = cb;
  var ci = document.getElementById("cfIcon"),
    ct = document.getElementById("cfTitle"),
    cm = document.getElementById("cfMsg"),
    co = document.getElementById("cfOk"),
    ov = document.getElementById("confirmOverlay");
  if (ci) ci.textContent = icon;
  if (ct) ct.textContent = title;
  if (cm) cm.innerHTML = msg;
  if (co) {
    co.textContent = okText || "Confirm";
    co.classList.toggle("danger", !!danger);
  }
  if (ov) ov.classList.add("open");
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
  var ov = document.getElementById("confirmOverlay");
  if (ov) ov.classList.remove("open");
}

// ===== STARTUP =====
document.addEventListener("DOMContentLoaded", function () {
  updateNB();
  renderSidebarNotifs();
  renderWallet();
  renderFeed();
});
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  updateNB();
  renderSidebarNotifs();
  renderWallet();
  renderFeed();
}

// Globals
window.navigate = navigate;
window.toast = toast;
window.openModal = openModal;
window.closeModal = closeModal;
window.openChatByName = openChatByName;
window.closeChat = closeChat;
window.sendMsg = sendMsg;
window.placeBid = placeBid;
window.buyNow = buyNow;
window.doLike = doLike;
window.doWatch = doWatch;
window.doShare = doShare;
window.toggleComments = toggleComments;
window.addComment = addComment;
window.toggleMenu = toggleMenu;
window.closeMenus = closeMenus;
window.setFilter = setFilter;
window.filterCat = filterCat;
window.myAuctTab = myAuctTab;
window.renderMyAuct = renderMyAuct;
window.deleteActiveListing = deleteActiveListing;
window.wBid = wBid;
window.removeWatch = removeWatch;
window.markRead = markRead;
window.markAllRead = markAllRead;
window.walletAction = walletAction;
window.processWallet = processWallet;
window.closeWM = closeWM;
window.saveProfile = saveProfile;
window.savePassword = savePassword;
window.submitPost = submitPost;
window.handleUpload = handleUpload;
window.showConfirm = showConfirm;
window.runConfirm = runConfirm;
window.closeConfirm = closeConfirm;
window.handleSearch = handleSearch;
window.showSR = showSR;
window.hideSR = hideSR;
window.checkVerifiedAndPost = checkVerifiedAndPost;
window.submitIdVerification = submitIdVerification;
window.handleIdUpload = handleIdUpload;
window.simulateVerify = simulateVerify;
window.updateWalletExtraFields = updateWalletExtraFields;
window.formatCardNum = formatCardNum;
window.formatExpiry = formatExpiry;
window.toggleFollow = toggleFollow;
window.renderPaymentMethodSelect = renderPaymentMethodSelect;
