// ============================================================
//  config/cloudinary.js
//  Cloudinary SDK configuration — loaded once at startup.
//  Reads credentials from environment variables (never hardcoded).
// ============================================================
"use strict";

const cloudinary = require("cloudinary").v2;

// Validate that all required env vars are present before the
// server accepts any traffic.  Fail loud and early.
const required = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  throw new Error(
    `[Cloudinary] Missing required environment variables: ${missing.join(", ")}\n` +
      `Copy .env.example → .env and fill in your Cloudinary dashboard credentials.`
  );
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure:     true, // always https
});

module.exports = cloudinary;
