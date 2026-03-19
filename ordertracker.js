/**
 * BiliBid — Order Tracker
 * Auction order tracking system for BiliBidTracking.html
 * ES6+ · No cart · Reads auctionId from URL · Auto-refreshes
 */

(() => {
  "use strict";

  /* ═══════════════════════════════════════════
     CONFIG
  ═══════════════════════════════════════════ */
  const API_BASE = "https://bilibid-1.onrender.com";
  const REFRESH_MS = 30_000; // auto-refresh interval (30 s)
  const MAX_RETRIES = 3; // fetch retry attempts
  const RETRY_DELAY = 1_500; // ms between retries

  /* ═══════════════════════════════════════════
     CONSTANTS
  ═══════════════════════════════════════════ */
  const STATUS_STEPS = [
    { key: "pending", icon: "🕐", label: "Order Placed" },
    { key: "confirmed", icon: "✅", label: "Confirmed" },
    { key: "shipped", icon: "🚚", label: "Shipped" },
    { key: "delivered", icon: "🏠", label: "Delivered" },
  ];

  const STATUS_META = {
    pending: { cls: "status-pending", icon: "🕐", label: "Order Placed" },
    confirmed: { cls: "status-confirmed", icon: "✅", label: "Confirmed" },
    shipped: { cls: "status-shipped", icon: "🚚", label: "In Transit" },
    delivered: { cls: "status-delivered", icon: "🏠", label: "Delivered" },
    cancelled: { cls: "status-cancelled", icon: "✕", label: "Cancelled" },
  };

  const TIMELINE_PCT = {
    pending: 10,
    confirmed: 40,
    shipped: 70,
    delivered: 100,
    cancelled: 100,
  };

  /* ═══════════════════════════════════════════
     UTILITIES
  ═══════════════════════════════════════════ */

  /** Escape HTML special chars to prevent XSS. */
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  /** Human-readable relative time. */
  function timeAgo(d) {
    const diff = (Date.now() - new Date(d).getTime()) / 1000;
    if (!diff || isNaN(diff)) return "—";
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(d).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  /** Capitalise first letter. */
  const cap = (s) =>
    String(s || "")
      .charAt(0)
      .toUpperCase() + String(s || "").slice(1);

  /** Sleep helper for retry delays. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  /* ═══════════════════════════════════════════
     AUTH
  ═══════════════════════════════════════════ */
  const Auth = {
    /** Retrieve stored token (localStorage → URL param fallback). */
    token() {
      return (
        localStorage.getItem("bbToken") ||
        new URLSearchParams(window.location.search).get("token") ||
        ""
      );
    },

    /** True when a token is present. */
    isLoggedIn() {
      return !!this.token();
    },
  };

  /* ═══════════════════════════════════════════
     API
  ═══════════════════════════════════════════ */
  const API = {
    /**
     * Fetch all orders for the logged-in user.
     * Retries up to MAX_RETRIES times on network failure.
     */
    async fetchOrders() {
      const token = Auth.token();
      if (!token) throw new Error("NOT_LOGGED_IN");

      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          const res = await fetch(`${API_BASE}/api/orders`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.status === 401) throw new Error("UNAUTHORIZED");
          if (!res.ok) throw new Error(`HTTP_${res.status}`);

          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch (err) {
          if (err.message === "UNAUTHORIZED") throw err;
          if (attempt < MAX_RETRIES) await sleep(RETRY_DELAY);
          else throw err;
        }
      }
    },

    /**
     * Find a specific order by auctionId or order _id.
     * Returns null if not found.
     */
    async findOrder(auctionId) {
      const orders = await this.fetchOrders();
      return (
        orders.find(
          (o) =>
            String(o.auctionId) === String(auctionId) ||
            String(o._id) === String(auctionId),
        ) ?? null
      );
    },
  };

  /* ═══════════════════════════════════════════
     RENDER — BUILDING BLOCKS
  ═══════════════════════════════════════════ */
  const Render = {
    /** Step progress bar (4 steps). */
    steps(status) {
      const stepIdx = STATUS_STEPS.findIndex((s) => s.key === status);
      return STATUS_STEPS.map((s, i) => {
        const cls = i < stepIdx ? "done" : i === stepIdx ? "active" : "";
        return `
          <div class="step">
            <div class="step-icon ${cls}">${s.icon}</div>
            <div class="step-label ${cls}">${s.label}</div>
          </div>`;
      }).join("");
    },

    /** Tracking timeline from trackingEvents array. */
    timeline(events, status) {
      const pct = TIMELINE_PCT[status] ?? 10;
      const rows = [...events]
        .reverse()
        .map((e, i) => {
          const isLatest = i === 0;
          const dotCls = isLatest ? "dot-active" : "dot-done";
          return `
          <div class="timeline-event">
            <div class="timeline-dot ${dotCls}"></div>
            <div class="event-status">${cap(e.status || "Update")}</div>
            <div class="event-msg">${esc(e.message || "")}</div>
            ${e.location ? `<div class="event-loc">📍 ${esc(e.location)}</div>` : ""}
            <div class="event-time">${timeAgo(e.timestamp)}</div>
          </div>`;
        })
        .join("");

      return `
        <div class="tracking-timeline">
          <div class="timeline-line">
            <div class="timeline-fill" style="height:${pct}%"></div>
          </div>
          ${rows}
        </div>`;
    },

    /** Order thumbnail — image URL or fallback emoji. */
    thumb(order) {
      if (order.auctionImage) {
        const src = order.auctionImage.startsWith("http")
          ? order.auctionImage
          : `${API_BASE}${order.auctionImage}`;
        return `<img src="${esc(src)}" alt="${esc(order.auctionTitle)}"
                     style="width:100%;height:100%;object-fit:cover;border-radius:14px"
                     onerror="this.replaceWith(document.createTextNode('📦'))">`;
      }
      return "📦";
    },

    /** Full order tracking card. */
    orderCard(order) {
      const status = order.orderStatus || "pending";
      const si = STATUS_META[status] ?? STATUS_META.pending;
      const amount = isNaN(Number(order.amount)) ? 0 : Number(order.amount);

      // Use real tracking events if present; fall back to a single "order placed" event
      const events = order.trackingEvents?.length
        ? order.trackingEvents
        : [
            {
              status: "pending",
              message: "Order placed via BiliBid Auction",
              timestamp: order.createdAt,
            },
          ];

      const shortId =
        String(order._id || "")
          .slice(-8)
          .toUpperCase() || "—";

      return `
        <!-- ── ORDER SUMMARY ── -->
        <div class="card">
          <div class="order-info">
            <div class="order-thumb">${this.thumb(order)}</div>
            <div>
              <div class="order-title">${esc(order.auctionTitle || "Auction Order")}</div>
              <div class="order-meta">from <strong>${esc(order.sellerName || "Seller")}</strong></div>
              <div class="order-price">
                ₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
              </div>
            </div>
          </div>

          <div class="status-badge ${si.cls}">${si.icon} ${si.label}</div>

          <div class="steps-row">${this.steps(status)}</div>

          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px;margin-bottom:16px">
            Tracking Timeline
          </div>
          ${this.timeline(events, status)}
        </div>

        <!-- ── ORDER DETAILS ── -->
        <div class="card">
          <div style="font-family:'Syne',sans-serif;font-weight:700;font-size:15px;margin-bottom:16px">
            Order Details
          </div>
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Order ID</div>
              <div class="info-value" style="font-family:monospace;font-size:12px">${shortId}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Payment</div>
              <div class="info-value">${esc(order.paymentMethod || "BiliBid Wallet")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Seller</div>
              <div class="info-value">${esc(order.sellerName || "—")}</div>
            </div>
            <div class="info-item">
              <div class="info-label">Carrier</div>
              <div class="info-value">${esc(order.trackingCarrier || "TBD")}</div>
            </div>
            ${
              order.trackingNumber
                ? `
            <div class="info-item" style="grid-column:1/-1">
              <div class="info-label">Tracking Number</div>
              <div class="info-value" style="font-family:monospace">${esc(order.trackingNumber)}</div>
            </div>`
                : ""
            }
            <div class="info-item">
              <div class="info-label">Placed</div>
              <div class="info-value">${timeAgo(order.createdAt)}</div>
            </div>
          </div>
        </div>

        <!-- ── CONTACT SELLER (active orders only) ── -->
        ${
          status !== "delivered" && status !== "cancelled"
            ? `
        <div class="card"
             style="text-align:center;background:rgba(37,99,235,.05);border-color:rgba(37,99,235,.2)">
          <div style="font-size:20px;margin-bottom:8px">📨</div>
          <div style="font-weight:700;font-size:14px;margin-bottom:4px">
            Have a question about your order?
          </div>
          <div style="font-size:13px;color:var(--muted2);margin-bottom:14px">
            Contact the seller directly via BiliBid chat
          </div>
          <button id="msgSellerBtn"
            style="background:linear-gradient(135deg,var(--blue),#1d4ed8);color:#fff;
                   border:none;padding:10px 24px;border-radius:50px;
                   font-size:14px;font-weight:700;cursor:pointer">
            💬 Message Seller
          </button>
        </div>`
            : ""
        }

        <!-- ── LAST REFRESHED ── -->
        <p style="text-align:center;font-size:11px;color:var(--muted);margin-top:4px">
          Last updated: <span id="lastRefreshed">just now</span>
          &nbsp;·&nbsp;
          <button id="refreshBtn"
            style="background:none;border:none;color:var(--blue-light);cursor:pointer;
                   font-size:11px;font-family:inherit;padding:0;text-decoration:underline">
            Refresh
          </button>
        </p>`;
    },

    /* ── STATE SCREENS ───────────────────────── */

    notFound: () => `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">🔍</div>
        <div style="font-weight:700;font-size:18px;margin-bottom:8px">Order Not Found</div>
        <div style="color:var(--muted2);font-size:13px">
          We couldn't find tracking info for this order.<br>
          It may still be processing — check again shortly.
        </div>
        <button id="refreshBtn"
          style="margin-top:20px;background:var(--surface2);border:1px solid var(--border);
                 color:var(--muted2);padding:10px 24px;border-radius:50px;
                 cursor:pointer;font-size:13px;font-weight:600">
          🔄 Try Again
        </button>
      </div>`,

    noId: () => `
      <div class="card" style="text-align:center;padding:40px">
        <div style="font-size:48px;margin-bottom:12px">📋</div>
        <div style="font-weight:700;font-size:18px;margin-bottom:8px">No Order Selected</div>
        <div style="color:var(--muted2);font-size:13px">
          Open this page from your <strong>Won Auctions</strong>
          or <strong>My Orders</strong> section.
        </div>
      </div>`,

    notLoggedIn: () => `
      <div class="card" style="text-align:center;padding:40px;border-color:rgba(239,68,68,.25)">
        <div style="font-size:48px;margin-bottom:12px">🔒</div>
        <div style="font-weight:700;font-size:18px;margin-bottom:8px">Login Required</div>
        <div style="color:var(--muted2);font-size:13px">
          You must be logged in to view your order tracking details.
        </div>
      </div>`,

    apiError: (err) => {
      const isUnauth = err?.message === "UNAUTHORIZED";
      return `
        <div class="card" style="text-align:center;padding:40px;border-color:rgba(239,68,68,.25)">
          <div style="font-size:48px;margin-bottom:12px">${isUnauth ? "🔒" : "⚠️"}</div>
          <div style="font-weight:700;font-size:18px;margin-bottom:8px">
            ${isUnauth ? "Session Expired" : "Could Not Load Order"}
          </div>
          <div style="color:var(--muted2);font-size:13px">
            ${
              isUnauth
                ? "Your session has expired. Please log in again."
                : "There was a problem connecting to BiliBid.<br>Check your connection and try again."
            }
          </div>
          ${
            !isUnauth
              ? `
          <button id="refreshBtn"
            style="margin-top:20px;background:var(--surface2);border:1px solid var(--border);
                   color:var(--muted2);padding:10px 24px;border-radius:50px;
                   cursor:pointer;font-size:13px;font-weight:600">
            🔄 Retry
          </button>`
              : ""
          }
        </div>`;
    },

    loading: () => `
      <div class="loading-state">
        <div class="loading-icon">📦</div>
        <div>Loading order details…</div>
      </div>`,
  };

  /* ═══════════════════════════════════════════
     CONTROLLER
  ═══════════════════════════════════════════ */
  const Tracker = {
    auctionId: "",
    refreshTimer: null,
    firstLoad: true,

    /** Mount the tracker — called once on DOMContentLoaded. */
    init() {
      this.auctionId =
        new URLSearchParams(window.location.search).get("auctionId") || "";
      this.load();
      this._startAutoRefresh();
    },

    /** Fetch and render the order; handles all error states. */
    async load() {
      const container = document.getElementById("trackingContent");
      if (!container) return;

      // No auctionId in URL
      if (!this.auctionId) {
        container.innerHTML = Render.noId();
        return;
      }

      // Not logged in
      if (!Auth.isLoggedIn()) {
        container.innerHTML = Render.notLoggedIn();
        return;
      }

      // Show spinner only on the very first load
      if (this.firstLoad) {
        container.innerHTML = Render.loading();
        this.firstLoad = false;
      }

      try {
        const order = await API.findOrder(this.auctionId);

        if (!order) {
          container.innerHTML = Render.notFound();
        } else {
          container.innerHTML = Render.orderCard(order);
        }
      } catch (err) {
        console.error("[BiliBid Tracker]", err.message);
        container.innerHTML = Render.apiError(err);
      }

      // Re-attach dynamic button listeners after every render
      this._attachDynamicListeners();
    },

    /** Wire up buttons injected by Render (refresh, message seller). */
    _attachDynamicListeners() {
      document
        .getElementById("refreshBtn")
        ?.addEventListener("click", () => this.load());

      document.getElementById("msgSellerBtn")?.addEventListener("click", () => {
        // Hook into BiliBid's chat system if it exposes openSellerChat(), else close popup
        if (typeof window.openSellerChat === "function") {
          window.openSellerChat(this.auctionId);
        } else {
          window.close();
        }
      });
    },

    /** Poll for updated order status every REFRESH_MS ms. */
    _startAutoRefresh() {
      this._stopAutoRefresh();
      this.refreshTimer = setInterval(() => {
        if (Auth.isLoggedIn() && this.auctionId) this.load();
      }, REFRESH_MS);
    },

    _stopAutoRefresh() {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    },
  };

  /* ═══════════════════════════════════════════
     PUBLIC API
     Other scripts can call:
       BiliBidTracker.refresh()   — force reload
       BiliBidTracker.stop()      — stop auto-refresh
  ═══════════════════════════════════════════ */
  window.BiliBidTracker = {
    refresh: () => Tracker.load(),
    stop: () => Tracker._stopAutoRefresh(),
  };

  /* ═══════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════ */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Tracker.init());
  } else {
    Tracker.init();
  }

  // Pause polling when tab is backgrounded; resume and refresh when visible again
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      Tracker._stopAutoRefresh();
    } else {
      Tracker.load();
      Tracker._startAutoRefresh();
    }
  });
})();
