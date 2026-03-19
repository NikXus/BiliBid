// ============================================================
//  middleware/upload.js
//  Multer middleware wired to Cloudinary storage.
//
//  Root cause of the disappearing-image bug:
//    Render (and most PaaS platforms) use an EPHEMERAL filesystem.
//    Any file written to /tmp or a local uploads/ folder is lost
//    the moment the dyno restarts — which happens on every deploy
//    and after periods of inactivity on the free tier.
//
//  Fix:
//    Stream every upload directly to Cloudinary via
//    multer-storage-cloudinary.  The file never touches the local
//    disk; the returned URL is a permanent CDN-backed URL that
//    survives restarts, deploys, and scaling events.
// ============================================================
"use strict";

const multer                    = require("multer");
const { CloudinaryStorage }     = require("multer-storage-cloudinary");
const cloudinary                = require("../config/cloudinary");

/* ── Shared Cloudinary storage configuration ── */
function makeStorage({ folder, allowedFormats, transformation }) {
  return new CloudinaryStorage({
    cloudinary,
    params: {
      folder,
      allowed_formats: allowedFormats || ["jpg", "jpeg", "png", "webp", "gif"],
      // Keep original quality but cap dimensions sensibly.
      // Transformation happens server-side so the client always gets
      // the right size — no front-end resize logic needed.
      transformation: transformation || [
        { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
      ],
      // Use the original filename (sanitised) so URLs are human-readable
      // and easier to debug.  Cloudinary appends a unique suffix
      // automatically, so collisions are impossible.
      public_id: (req, file) => {
        const stem = file.originalname
          .replace(/\.[^.]+$/, "")          // strip extension
          .replace(/[^a-z0-9_-]/gi, "_")    // safe chars only
          .slice(0, 60);                     // reasonable length
        return `${stem}_${Date.now()}`;
      },
    },
  });
}

/* ── Multer instance for auction / listing images ── */
const auctionStorage = makeStorage({
  folder: "bilibid/auctions",
  transformation: [
    { width: 1200, height: 1200, crop: "limit", quality: "auto:good" },
  ],
});

/* ── Multer instance for user avatars (square crop) ── */
const avatarStorage = makeStorage({
  folder: "bilibid/avatars",
  transformation: [
    { width: 400, height: 400, crop: "fill", gravity: "face", quality: "auto:good" },
  ],
});

/* ── Multer instance for story images ── */
const storyStorage = makeStorage({
  folder: "bilibid/stories",
  transformation: [
    { width: 1080, height: 1920, crop: "limit", quality: "auto:good" },
  ],
});

/* ── File filter — reject non-image MIME types early ── */
function imageFilter(req, file, cb) {
  if (!file.mimetype.startsWith("image/")) {
    return cb(
      Object.assign(new Error("Only image files are allowed."), { status: 400 }),
      false
    );
  }
  cb(null, true);
}

/* ── Size limits ── */
const LIMITS = { fileSize: 8 * 1024 * 1024 }; // 8 MB per file

/* ── Exported middleware ── */

/** Upload up to 5 auction / listing images (field name: "images") */
const uploadAuctionImages = multer({
  storage: auctionStorage,
  fileFilter: imageFilter,
  limits: LIMITS,
}).array("images", 5);

/** Upload a single user avatar (field name: "avatar") */
const uploadAvatar = multer({
  storage: avatarStorage,
  fileFilter: imageFilter,
  limits: LIMITS,
}).single("avatar");

/** Upload a single story image (field name: "images") */
const uploadStoryImage = multer({
  storage: storyStorage,
  fileFilter: imageFilter,
  limits: LIMITS,
}).single("images");

/* ── Tiny error-handling wrapper ── */
// Wraps a multer middleware in a promise so Express error handlers
// receive multer errors the same way as any other thrown error.
function wrapMulter(fn) {
  return (req, res, next) => {
    fn(req, res, (err) => {
      if (!err) return next();
      const status = err.status || (err.code === "LIMIT_FILE_SIZE" ? 413 : 400);
      res.status(status).json({ message: err.message });
    });
  };
}

module.exports = {
  uploadAuctionImages: wrapMulter(uploadAuctionImages),
  uploadAvatar:        wrapMulter(uploadAvatar),
  uploadStoryImage:    wrapMulter(uploadStoryImage),
};
