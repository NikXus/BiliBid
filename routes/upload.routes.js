// ============================================================
//  routes/upload.routes.js
//  Handles all file upload endpoints.
//
//  Key change from the old implementation:
//    - Files are streamed directly to Cloudinary (no disk I/O).
//    - The response returns the FULL secure Cloudinary URL,
//      which is what gets stored in MongoDB.
//    - Frontend uses these URLs directly; IMAGE_BASE prefix
//      is no longer needed for Cloudinary-hosted assets.
// ============================================================
"use strict";

const express = require("express");
const router  = express.Router();
const auth    = require("../middleware/auth");           // your existing JWT middleware
const { uploadAuctionImages, uploadAvatar, uploadStoryImage } = require("../middleware/upload");

/* ── POST /api/upload  ────────────────────────────────────────
   General image upload for auction listings.
   Accepts up to 5 files in the "images" field.
   Returns: { urls: [ "https://res.cloudinary.com/..." ] }
────────────────────────────────────────────────────────────── */
router.post("/upload", auth, uploadAuctionImages, (req, res) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ message: "No files uploaded." });
  }

  // req.files[n].path  → the full secure Cloudinary URL
  // req.files[n].secure_url is also available from multer-storage-cloudinary
  const urls = req.files.map((f) => f.path || f.secure_url);

  console.log(`[Upload] ${urls.length} image(s) saved to Cloudinary for user ${req.userId}`);
  res.json({ urls });
});

/* ── POST /api/users/upload-avatar  ──────────────────────────
   Avatar upload — single file, "avatar" field.
   Returns: { avatarUrl: "https://res.cloudinary.com/..." }
────────────────────────────────────────────────────────────── */
router.post("/users/upload-avatar", auth, uploadAvatar, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: "No file uploaded." });
  }

  const avatarUrl = req.file.path || req.file.secure_url;

  try {
    // Persist the new avatar URL on the user document
    const User = require("../models/User");        // adjust to your model path
    await User.findByIdAndUpdate(req.userId, { avatar: avatarUrl });
    console.log(`[Upload] Avatar updated for user ${req.userId}: ${avatarUrl}`);
    res.json({ avatarUrl });
  } catch (err) {
    console.error("[Upload] Avatar DB update failed:", err.message);
    res.status(500).json({ message: "Avatar saved to CDN but DB update failed." });
  }
});

module.exports = router;
