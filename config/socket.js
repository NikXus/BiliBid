// ============================================================
//  config/socket.js
//  Production-ready Socket.io server configuration.
//
//  Root cause of the timeout error:
//    The client was configured with transports: ["websocket", "polling"].
//    Render's HTTP proxy does NOT immediately support WebSocket
//    upgrades on a cold connection.  Socket.io tries WebSocket,
//    the proxy drops the upgrade, and the connection times out
//    before falling back to polling.
//
//  Fix:
//    1. Server: accept both transports, enable CORS properly.
//    2. Client: start with polling, upgrade to WS after handshake.
//    3. Both: set explicit ping/pong intervals so Render's 30-second
//       idle-connection killer doesn't drop the socket mid-session.
// ============================================================
"use strict";

const { Server } = require("socket.io");

/**
 * Attach a configured Socket.io server to an existing HTTP server.
 *
 * @param {import("http").Server} httpServer
 * @returns {import("socket.io").Server}
 */
function createSocketServer(httpServer) {
  const io = new Server(httpServer, {
    // ── Transport configuration ──────────────────────────────
    // Allow BOTH transports on the server side.
    // The client controls the upgrade order (polling → websocket).
    // This is the correct Render / reverse-proxy setup.
    transports: ["polling", "websocket"],

    // ── Ping / keepalive ─────────────────────────────────────
    // Render disconnects idle connections after ~30 s.
    // Ping every 20 s so the socket stays alive between messages.
    pingInterval:  20_000,   // ms between server pings
    pingTimeout:   15_000,   // ms client has to reply before disconnect
    connectTimeout: 10_000,  // ms to complete the initial handshake

    // ── CORS ─────────────────────────────────────────────────
    // In production the front-end origin MUST be whitelisted.
    // Set FRONTEND_URL in your environment (e.g. https://bilibid.com).
    // During local dev FRONTEND_URL is not set so "*" is used as fallback.
    cors: {
      origin: process.env.FRONTEND_URL
        ? process.env.FRONTEND_URL.split(",")
        : "*",
      methods:     ["GET", "POST"],
      credentials: true,
    },

    // ── Upgrade behaviour ────────────────────────────────────
    // Allow the client to upgrade from polling to websocket after
    // the initial handshake succeeds.  This is the key fix for Render:
    // the first request goes through as plain HTTP polling,
    // then the socket upgrades to a persistent WebSocket.
    allowUpgrades: true,
    upgradeTimeout: 5_000,

    // ── Misc ─────────────────────────────────────────────────
    maxHttpBufferSize: 1e6,   // 1 MB max event payload
  });

  return io;
}

module.exports = { createSocketServer };
