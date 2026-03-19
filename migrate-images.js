// ============================================================
//  migrate-images.js
//
//  One-time script to clean up legacy /uploads/... image URLs
//  stored in MongoDB before Cloudinary was set up properly.
//
//  USAGE:
//    node migrate-images.js
//
//  Set your MONGO_URI in .env before running, or pass it
//  as an environment variable:
//    MONGO_URI="mongodb+srv://..." node migrate-images.js
// ============================================================

require("dotenv").config();
const mongoose = require("mongoose");

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌ MONGO_URI not set");
  process.exit(1);
}

// ── Schemas (minimal, just what we need) ─────────────────────
const auctionSchema = new mongoose.Schema(
  { images: [String], sellerAvatar: String },
  { strict: false },
);
const userSchema = new mongoose.Schema({ avatar: String }, { strict: false });
const storySchema = new mongoose.Schema(
  { imageUrl: String },
  { strict: false },
);
const messageSchema = new mongoose.Schema(
  { imageUrl: String },
  { strict: false },
);

const Auction = mongoose.model("Auction", auctionSchema, "auctions");
const User = mongoose.model("User", userSchema, "users");
const Story = mongoose.model("Story", storySchema, "stories");
const Message = mongoose.model("Message", messageSchema, "messages");

const LOCAL_RE = /^\/uploads\//;

async function run() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(MONGO_URI, { dbName: "BiliBid" });
  console.log("✅ Connected to:", mongoose.connection.db.databaseName);

  const stats = { auctions: 0, users: 0, stories: 0, messages: 0 };

  // ── 1. Fix auction images arrays ─────────────────────────
  console.log("\n[1/4] Scanning auction images…");
  const auctions = await Auction.find({
    $or: [
      { images: { $elemMatch: { $regex: "^/uploads/" } } },
      { sellerAvatar: { $regex: "^/uploads/" } },
    ],
  });

  for (const a of auctions) {
    let dirty = false;
    if (Array.isArray(a.images)) {
      const before = a.images.length;
      // Remove local paths; keep empty-string-free array
      a.images = a.images.filter((img) => img && !LOCAL_RE.test(img));
      if (a.images.length !== before) dirty = true;
    }
    if (a.sellerAvatar && LOCAL_RE.test(a.sellerAvatar)) {
      a.sellerAvatar = "";
      dirty = true;
    }
    if (dirty) {
      await a.save();
      stats.auctions++;
    }
  }
  console.log(`   Fixed ${stats.auctions} auction documents`);

  // ── 2. Fix user avatars ───────────────────────────────────
  console.log("[2/4] Scanning user avatars…");
  const users = await User.find({ avatar: { $regex: "^/uploads/" } });
  for (const u of users) {
    u.avatar = "";
    await u.save();
    stats.users++;
  }
  console.log(`   Fixed ${stats.users} user documents`);

  // ── 3. Fix story imageUrls ────────────────────────────────
  console.log("[3/4] Scanning story images…");
  const result3 = await Story.updateMany(
    { imageUrl: { $regex: "^/uploads/" } },
    { $set: { imageUrl: "" } },
  );
  stats.stories = result3.modifiedCount;
  console.log(`   Fixed ${stats.stories} story documents`);

  // ── 4. Fix message imageUrls ──────────────────────────────
  console.log("[4/4] Scanning message images…");
  const result4 = await Message.updateMany(
    { imageUrl: { $regex: "^/uploads/" } },
    { $set: { imageUrl: "" } },
  );
  stats.messages = result4.modifiedCount;
  console.log(`   Fixed ${stats.messages} message documents`);

  // ── Summary ───────────────────────────────────────────────
  console.log("\n✅ Migration complete!");
  console.log("   Auctions fixed:", stats.auctions);
  console.log("   Users fixed:   ", stats.users);
  console.log("   Stories fixed: ", stats.stories);
  console.log("   Messages fixed:", stats.messages);
  console.log("\n   All legacy /uploads/ paths have been removed.");
  console.log("   Items that had images will now show the placeholder.");
  console.log("   Users should re-upload their avatars / item photos.");

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error("❌ Migration failed:", err.message);
  mongoose.disconnect();
  process.exit(1);
});
