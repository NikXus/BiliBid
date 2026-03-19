require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const http = require("http");
const { Server } = require("socket.io");

// ── Cloudinary ────────────────────────────────────────────────
const cloudinary = require("cloudinary").v2;
const CloudinaryStorage = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────
// FIX: polling first so Render's reverse-proxy handshake succeeds,
// then upgrades to WebSocket.  Ping settings prevent 30-s idle drop.
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  transports: ["polling", "websocket"],
  pingInterval: 25_000,
  pingTimeout: 20_000,
  allowEIO3: true,
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "bilibid_secret_key";

// ── CORS ──────────────────────────────────────────────────────
// Accept a comma-separated FRONTEND_URL list, or fall back to "*"
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(",").map((s) => s.trim())
  : "*";

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

// NOTE: /uploads static route removed — files are now served from
// Cloudinary's CDN, not from Render's ephemeral disk.

// ── Multer → Cloudinary storage ───────────────────────────────
// All uploads go straight to Cloudinary.  req.files[n].path holds
// the full https://res.cloudinary.com/... URL to store in MongoDB.

const auctionImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "bilibid/auctions",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "bilibid/avatars",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [
      { width: 400, height: 400, crop: "fill", quality: "auto" },
    ],
  },
});

const storyImageStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "bilibid/stories",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  },
});

const uploadImages = multer({
  storage: auctionImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
const uploadStory = multer({
  storage: storyImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// ── Auth middleware ───────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ message: "Unauthorized" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
};

/* ── MongoDB ── */
console.log("MONGO_URI:", process.env.MONGO_URI?.replace(/:([^@]+)@/, ":***@"));
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI, { dbName: "BiliBid" })
  .then(async () => {
    console.log(
      "✅ MongoDB Connected to DB:",
      mongoose.connection.db.databaseName,
    );
    await createIndexes();
  })
  .catch((err) => {
    console.error("❌ MongoDB Error:", err.message);
    process.exit(1);
  });

/* ── SCHEMAS ── */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    avatar: { type: String, default: "" },
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    walletBalance: { type: Number, default: 0 },
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Auction" }],
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

const auctionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "Other" },
    condition: { type: String, default: "" },
    shipping: { type: String, default: "" },
    location: { type: String, default: "" },
    images: [{ type: String }],
    startingPrice: { type: Number, required: true },
    currentBid: { type: Number, required: true },
    buyNowPrice: { type: Number, default: null },
    duration: { type: Number, required: true },
    endsAt: { type: Number, required: true },
    sellerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sellerName: { type: String, required: true },
    sellerAvatar: { type: String, default: "" },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    winnerName: { type: String, default: null },
    status: { type: String, enum: ["active", "ended"], default: "active" },
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    bids: [
      {
        bidderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        bidderName: String,
        bidAmount: Number,
        placedAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        username: String,
        text: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderName: { type: String, default: "" },
    message: { type: String, default: "" },
    messageType: {
      type: String,
      enum: ["text", "image", "location"],
      default: "text",
    },
    imageUrl: { type: String, default: "" },
    location: { lat: Number, lng: Number, address: String },
    read: { type: Boolean, default: false },
  },
  { timestamps: true },
);

const reviewSchema = new mongoose.Schema(
  {
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reviewerName: { type: String, required: true },
    targetUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    rating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, required: true },
    auctionId: { type: mongoose.Schema.Types.ObjectId, ref: "Auction" },
  },
  { timestamps: true },
);

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: { type: String, required: true },
    message: { type: String, required: true },
    read: { type: Boolean, default: false },
    link: { type: String, default: "" },
  },
  { timestamps: true },
);

const storySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    username: { type: String, required: true },
    text: { type: String, default: "" },
    imageUrl: { type: String, default: "" },
    isLive: { type: Boolean, default: false },
    views: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  },
  { timestamps: true },
);

const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: { type: String, enum: ["credit", "debit"], required: true },
    category: {
      type: String,
      enum: [
        "add_funds",
        "bid_placed",
        "bid_refund",
        "bid_won",
        "sent",
        "received",
        "withdrawal",
        "buy_now",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    description: { type: String, default: "" },
    relatedUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    relatedAuctionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auction",
      default: null,
    },
    balanceAfter: { type: Number, required: true },
    method: { type: String, default: "" },
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
const Auction = mongoose.model("Auction", auctionSchema);
const Message = mongoose.model("Message", messageSchema);
const Review = mongoose.model("Review", reviewSchema);
const Notification = mongoose.model("Notification", notificationSchema);
const Story = mongoose.model("Story", storySchema);
const Transaction = mongoose.model("Transaction", transactionSchema);

async function createIndexes() {
  try {
    await Auction.collection.createIndex({ status: 1, createdAt: -1 });
    await Auction.collection.createIndex({ sellerId: 1 });
    await Auction.collection.createIndex({
      title: "text",
      description: "text",
    });
    await Auction.collection.createIndex({ endsAt: 1 });
    await Message.collection.createIndex({
      senderId: 1,
      receiverId: 1,
      createdAt: 1,
    });
    await Message.collection.createIndex({ receiverId: 1, read: 1 });
    await User.collection.createIndex({ username: 1 });
    await Notification.collection.createIndex({
      userId: 1,
      read: 1,
      createdAt: -1,
    });
    await Story.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );
    await Transaction.collection.createIndex({ userId: 1, createdAt: -1 });
    console.log("✅ Indexes created");
  } catch (err) {
    console.error("❌ Index error:", err.message);
  }
}

/* ══════════════════════════════
   DEBUG
══════════════════════════════ */
app.get("/api/debug", (req, res) => {
  res.json({
    db: mongoose.connection.db?.databaseName,
    host: mongoose.connection.host,
    readyState: mongoose.connection.readyState,
    version: "v5.1-bilibid",
    mongoUri: process.env.MONGO_URI?.replace(/:([^@]+)@/, ":***@"),
    cloudinary: process.env.CLOUDINARY_CLOUD_NAME || "not configured",
  });
});

/* ══════════════════════════════
   ROOT
══════════════════════════════ */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "BiliBidMain.html"));
});

/* ══════════════════════════════
   UPLOADS
   Images are stored on Cloudinary.
   The response returns full https:// URLs — no IMAGE_BASE prefix needed.
══════════════════════════════ */

// General image upload (auction photos, chat images, story images)
// Uses uploadImages storage (bilibid/auctions folder on Cloudinary)
app.post(
  "/api/upload",
  authMiddleware,
  uploadImages.array("images", 5),
  (req, res) => {
    if (!req.files?.length)
      return res.status(400).json({ message: "No files uploaded" });
    // STEP 8: store full Cloudinary URL (file.path), not filename
    const urls = req.files.map((f) => f.path);
    res.json({ urls });
  },
);

// Profile picture upload (kept for backward compatibility)
app.post(
  "/api/upload/profile",
  authMiddleware,
  uploadAvatar.single("profilePic"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ url: req.file.path });
  },
);

/* ══════════════════════════════
   AUTH
══════════════════════════════ */
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    console.log(
      "[REGISTER] DB:",
      mongoose.connection.db?.databaseName,
      "host:",
      mongoose.connection.host,
    );

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed });
    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        walletBalance: user.walletBalance,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password required" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio,
        location: user.location,
        walletBalance: user.walletBalance,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login failed" });
  }
});

app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

app.put("/api/me", authMiddleware, async (req, res) => {
  try {
    const { bio, location, avatar, username } = req.body;
    const update = {};
    if (bio !== undefined) update.bio = bio;
    if (location !== undefined) update.location = location;
    if (avatar !== undefined) update.avatar = avatar;
    if (username !== undefined) update.username = username;
    const user = await User.findByIdAndUpdate(req.user.id, update, {
      new: true,
    }).select("-password");
    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

app.put("/api/me/password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Both passwords required" });
    if (newPassword.length < 6)
      return res
        .status(400)
        .json({ message: "New password must be at least 6 characters" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match)
      return res.status(400).json({ message: "Current password is incorrect" });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Password change error:", err);
    res.status(500).json({ message: "Failed to update password" });
  }
});

/* ══════════════════════════════
   WALLET
══════════════════════════════ */
app.post("/api/wallet/add", authMiddleware, async (req, res) => {
  try {
    const { amount, method } = req.body;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: Number(amount) } },
      { new: true },
    ).select("-password");
    await Transaction.create({
      userId: req.user.id,
      type: "credit",
      category: "add_funds",
      amount: Number(amount),
      description: `Added via ${method || "GCash"}`,
      balanceAfter: user.walletBalance,
      method: method || "GCash",
    });
    res.json({ message: "Funds added", walletBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: "Failed to add funds" });
  }
});

app.post("/api/wallet/send", authMiddleware, async (req, res) => {
  try {
    const { amount, recipientUsername, method } = req.body;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    if (!recipientUsername)
      return res.status(400).json({ message: "Recipient username required" });

    const sender = await User.findById(req.user.id);
    if (!sender) return res.status(404).json({ message: "Sender not found" });

    const recipient = await User.findOne({
      username: { $regex: `^${recipientUsername}$`, $options: "i" },
    });
    if (!recipient)
      return res
        .status(404)
        .json({ message: `User @${recipientUsername} not found` });
    if (recipient._id.toString() === req.user.id)
      return res.status(400).json({ message: "Cannot send money to yourself" });

    const sendAmt = Number(amount);
    if (sender.walletBalance < sendAmt)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    const updatedSender = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: -sendAmt } },
      { new: true },
    );
    const updatedRecipient = await User.findByIdAndUpdate(
      recipient._id,
      { $inc: { walletBalance: sendAmt } },
      { new: true },
    );

    await Transaction.create({
      userId: req.user.id,
      type: "debit",
      category: "sent",
      amount: sendAmt,
      description: `Sent to @${recipient.username}`,
      relatedUserId: recipient._id,
      balanceAfter: updatedSender.walletBalance,
      method: method || "BiliBid Wallet",
    });
    await Transaction.create({
      userId: recipient._id,
      type: "credit",
      category: "received",
      amount: sendAmt,
      description: `Received from @${req.user.username}`,
      relatedUserId: req.user.id,
      balanceAfter: updatedRecipient.walletBalance,
      method: "BiliBid Wallet",
    });
    await Notification.create({
      userId: recipient._id,
      type: "message",
      message: `💸 @${req.user.username} sent you ₱${sendAmt.toLocaleString()}!`,
    });

    res.json({
      message: `✅ ₱${sendAmt.toLocaleString()} sent to @${recipient.username}`,
      walletBalance: updatedSender.walletBalance,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to send money" });
  }
});

app.post("/api/wallet/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount, method, accountNumber } = req.body;
    if (!amount || Number(amount) <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    const withdrawAmt = Number(amount);
    if (user.walletBalance < withdrawAmt)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: -withdrawAmt } },
      { new: true },
    );
    await Transaction.create({
      userId: req.user.id,
      type: "debit",
      category: "withdrawal",
      amount: withdrawAmt,
      description: `Withdrawal to ${method || "GCash"}${accountNumber ? ` (${accountNumber})` : ""}`,
      balanceAfter: updatedUser.walletBalance,
      method: method || "GCash",
    });
    res.json({
      message: `✅ ₱${withdrawAmt.toLocaleString()} withdrawal requested`,
      walletBalance: updatedUser.walletBalance,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to process withdrawal" });
  }
});

app.get("/api/wallet/transactions", authMiddleware, async (req, res) => {
  try {
    const transactions = await Transaction.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("relatedUserId", "username avatar")
      .populate("relatedAuctionId", "title");
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch transactions" });
  }
});

/* ══════════════════════════════
   USERS
══════════════════════════════ */
app.get("/api/users", async (req, res) => {
  try {
    const { search } = req.query;
    const filter = search
      ? { username: { $regex: search, $options: "i" } }
      : {};
    const users = await User.find(filter).select("-password -email").limit(10);

    const myId = req.headers.authorization
      ? (() => {
          try {
            return jwt.verify(
              req.headers.authorization.split(" ")[1],
              JWT_SECRET,
            ).id;
          } catch {
            return null;
          }
        })()
      : null;

    res.json(
      users.map((u) => ({
        _id: u._id,
        username: u.username,
        avatar: u.avatar,
        bio: u.bio,
        followersCount: u.followers?.length || 0,
        followingCount: u.following?.length || 0,
        isFollowing: myId
          ? u.followers.some((f) => f.toString() === myId)
          : false,
      })),
    );
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* GET suggested sellers — real users with most active listings */
app.get("/api/users/suggested", async (req, res) => {
  try {
    const myId = req.headers.authorization
      ? (() => {
          try {
            return jwt.verify(
              req.headers.authorization.split(" ")[1],
              JWT_SECRET,
            ).id;
          } catch {
            return null;
          }
        })()
      : null;

    const topSellers = await Auction.aggregate([
      { $match: { status: "active" } },
      {
        $group: {
          _id: "$sellerId",
          count: { $sum: 1 },
          sellerName: { $first: "$sellerName" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    const userIds = topSellers.map((s) => s._id);
    const users = await User.find({ _id: { $in: userIds } }).select(
      "-password -email",
    );

    res.json(
      users.map((u) => {
        const agg = topSellers.find(
          (s) => s._id.toString() === u._id.toString(),
        );
        return {
          _id: u._id,
          username: u.username,
          avatar: u.avatar,
          bio: u.bio,
          listingsCount: agg?.count || 0,
          followersCount: u.followers?.length || 0,
          isFollowing: myId
            ? u.followers.some((f) => f.toString() === myId)
            : false,
        };
      }),
    );
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch suggested sellers" });
  }
});

app.get("/api/users/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password -email");
    if (!user) return res.status(404).json({ message: "User not found" });

    const myId = req.headers.authorization
      ? (() => {
          try {
            return jwt.verify(
              req.headers.authorization.split(" ")[1],
              JWT_SECRET,
            ).id;
          } catch {
            return null;
          }
        })()
      : null;

    const listingsCount = await Auction.countDocuments({ sellerId: user._id });
    res.json({
      _id: user._id,
      username: user.username,
      avatar: user.avatar,
      bio: user.bio,
      location: user.location,
      followersCount: user.followers?.length || 0,
      followingCount: user.following?.length || 0,
      listingsCount,
      isFollowing: myId
        ? user.followers.some((f) => f.toString() === myId)
        : false,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/* Follow — accepts both ObjectId and username */
app.post("/api/users/:id/follow", authMiddleware, async (req, res) => {
  try {
    let targetId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(targetId)) {
      const found = await User.findOne({
        username: { $regex: `^${targetId}$`, $options: "i" },
      });
      if (!found) return res.status(404).json({ message: "User not found" });
      targetId = found._id.toString();
    }

    if (targetId === req.user.id)
      return res.status(400).json({ message: "Cannot follow yourself" });

    const target = await User.findById(targetId);
    if (!target) return res.status(404).json({ message: "User not found" });

    const alreadyFollowing = target.followers.some(
      (f) => f.toString() === req.user.id,
    );

    if (alreadyFollowing) {
      await User.findByIdAndUpdate(targetId, {
        $pull: { followers: req.user.id },
      });
      await User.findByIdAndUpdate(req.user.id, {
        $pull: { following: targetId },
      });
      res.json({ following: false });
    } else {
      await User.findByIdAndUpdate(targetId, {
        $addToSet: { followers: req.user.id },
      });
      await User.findByIdAndUpdate(req.user.id, {
        $addToSet: { following: targetId },
      });
      await Notification.create({
        userId: targetId,
        type: "follow",
        message: `👥 ${req.user.username} started following you!`,
      });
      res.json({ following: true });
    }
  } catch (err) {
    console.error("Follow error:", err);
    res.status(500).json({ message: "Follow action failed" });
  }
});

app.delete("/api/users/:id/follow", authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
    await User.findByIdAndUpdate(targetId, {
      $pull: { followers: req.user.id },
    });
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: targetId },
    });
    res.json({ following: false });
  } catch (err) {
    res.status(500).json({ message: "Unfollow failed" });
  }
});

/* Avatar upload — now goes to Cloudinary */
app.post(
  "/api/users/upload-avatar",
  authMiddleware,
  uploadAvatar.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });
      // file.path is the full Cloudinary URL
      const avatarUrl = req.file.path;
      await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl });
      res.json({ avatarUrl });
    } catch (err) {
      res.status(500).json({ message: "Avatar upload failed" });
    }
  },
);

/* ══════════════════════════════
   AUCTIONS
══════════════════════════════ */
app.get("/api/auctions", async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, location, status, sellerId } =
      req.query;
    const filter = {};
    if (category && category !== "All") filter.category = category;
    if (search) filter.title = { $regex: search, $options: "i" };
    if (location) filter.location = { $regex: location, $options: "i" };
    if (status) filter.status = status;
    if (sellerId) filter.sellerId = sellerId;
    if (minPrice || maxPrice) {
      filter.currentBid = {};
      if (minPrice) filter.currentBid.$gte = Number(minPrice);
      if (maxPrice) filter.currentBid.$lte = Number(maxPrice);
    }

    const auctions = await Auction.find(filter).sort({ createdAt: -1 });

    const now = Date.now();
    for (const auction of auctions) {
      if (auction.status === "active" && now > auction.endsAt) {
        auction.status = "ended";
        if (auction.bids.length > 0) {
          const winner = auction.bids[auction.bids.length - 1];
          auction.winnerId = winner.bidderId;
          auction.winnerName = winner.bidderName;
          await Notification.create({
            userId: winner.bidderId,
            type: "won",
            message: `🏆 You won "${auction.title}" with a bid of ₱${winner.bidAmount}!`,
          });
        }
        await auction.save();
      }
    }

    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auctions" });
  }
});

app.get("/api/auctions/user/mine", authMiddleware, async (req, res) => {
  try {
    const auctions = await Auction.find({ sellerId: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch your auctions" });
  }
});

app.get("/api/auctions/user/won", authMiddleware, async (req, res) => {
  try {
    const auctions = await Auction.find({
      winnerId: req.user.id,
      status: "ended",
    }).sort({ updatedAt: -1 });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch won auctions" });
  }
});

app.get("/api/auctions/:id", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auction" });
  }
});

app.post("/api/auctions", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      condition,
      shipping,
      location,
      images,
      startingPrice,
      duration,
      buyNowPrice,
    } = req.body;
    if (!title || !startingPrice || !duration)
      return res.status(400).json({ message: "Missing required fields" });

    const seller = await User.findById(req.user.id).select("avatar");

    const auction = await Auction.create({
      title,
      description: description || "",
      category: category || "Other",
      condition: condition || "",
      shipping: shipping || "",
      location: location || "",
      // Images are now full Cloudinary URLs passed from the client
      images: images || [],
      startingPrice: Number(startingPrice),
      currentBid: Number(startingPrice),
      buyNowPrice: buyNowPrice ? Number(buyNowPrice) : null,
      duration: Number(duration),
      endsAt: Date.now() + Number(duration) * 1000,
      sellerId: req.user.id,
      sellerName: req.user.username,
      sellerAvatar: seller?.avatar || "",
      bids: [],
    });

    await Notification.create({
      userId: req.user.id,
      type: "created",
      message: `✅ Your auction "${title}" has been posted!`,
    });
    io.emit("auctionCreated", auction);
    res.status(201).json({ message: "Auction created", auction });
  } catch (err) {
    console.error("Create auction error:", err);
    res.status(500).json({ message: "Failed to create auction" });
  }
});

/* PLACE BID with transaction recording */
app.post("/api/auctions/:id/bid", authMiddleware, async (req, res) => {
  try {
    const { bidAmount } = req.body;
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (auction.status === "ended" || Date.now() > auction.endsAt)
      return res.status(400).json({ message: "Auction has ended" });
    if (auction.sellerId.toString() === req.user.id)
      return res
        .status(400)
        .json({ message: "You cannot bid on your own auction" });

    const amount = Number(bidAmount);
    if (amount <= auction.currentBid)
      return res
        .status(400)
        .json({ message: `Bid must be higher than ₱${auction.currentBid}` });

    const bidder = await User.findById(req.user.id);
    if (!bidder) return res.status(404).json({ message: "User not found" });
    if (bidder.walletBalance < amount)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    if (auction.bids.length > 0) {
      const lastBid = auction.bids[auction.bids.length - 1];
      const refundedUser = await User.findByIdAndUpdate(
        lastBid.bidderId,
        { $inc: { walletBalance: lastBid.bidAmount } },
        { new: true },
      );
      await Transaction.create({
        userId: lastBid.bidderId,
        type: "credit",
        category: "bid_refund",
        amount: lastBid.bidAmount,
        description: `Outbid refund — "${auction.title}"`,
        relatedAuctionId: auction._id,
        balanceAfter: refundedUser.walletBalance,
      });
      await Notification.create({
        userId: lastBid.bidderId,
        type: "outbid",
        message: `⚠️ You were outbid on "${auction.title}". New bid: ₱${amount}`,
      });
    }

    const updatedBidder = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: -amount } },
      { new: true },
    );
    await Transaction.create({
      userId: req.user.id,
      type: "debit",
      category: "bid_placed",
      amount,
      description: `Bid on "${auction.title}"`,
      relatedAuctionId: auction._id,
      balanceAfter: updatedBidder.walletBalance,
    });

    auction.currentBid = amount;
    auction.bids.push({
      bidderId: req.user.id,
      bidderName: req.user.username,
      bidAmount: amount,
      placedAt: new Date(),
    });
    await auction.save();

    await Notification.create({
      userId: auction.sellerId,
      type: "bid",
      message: `💰 ${req.user.username} bid ₱${amount} on "${auction.title}"`,
    });

    io.emit("bidPlaced", {
      auctionId: auction._id,
      currentBid: amount,
      bidderName: req.user.username,
      bids: auction.bids.length,
    });
    res.json({ message: "Bid placed", auction });
  } catch (err) {
    console.error("Bid error:", err);
    res.status(500).json({ message: "Failed to place bid" });
  }
});

/* BUY NOW — emits auctionEnded so all clients remove it from feed */
app.post("/api/auctions/:id/buynow", authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (auction.status === "ended")
      return res.status(400).json({ message: "Auction has already ended" });
    if (!auction.buyNowPrice)
      return res.status(400).json({ message: "No Buy Now price set" });
    if (auction.sellerId.toString() === req.user.id)
      return res.status(400).json({ message: "Cannot buy your own auction" });

    const buyer = await User.findById(req.user.id);
    if (!buyer) return res.status(404).json({ message: "User not found" });
    if (buyer.walletBalance < auction.buyNowPrice)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    const updatedBuyer = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: -auction.buyNowPrice } },
      { new: true },
    );

    await Transaction.create({
      userId: req.user.id,
      type: "debit",
      category: "buy_now",
      amount: auction.buyNowPrice,
      description: `Bought "${auction.title}"`,
      relatedAuctionId: auction._id,
      balanceAfter: updatedBuyer.walletBalance,
    });

    auction.status = "ended";
    auction.winnerId = req.user.id;
    auction.winnerName = req.user.username;
    auction.currentBid = auction.buyNowPrice;
    await auction.save();

    await Notification.create({
      userId: auction.sellerId,
      type: "won",
      message: `🎉 ${req.user.username} bought "${auction.title}" for ₱${auction.buyNowPrice}!`,
    });
    await Notification.create({
      userId: req.user.id,
      type: "won",
      message: `🎉 You bought "${auction.title}" for ₱${auction.buyNowPrice}!`,
    });

    io.emit("auctionEnded", {
      auctionId: auction._id.toString(),
      reason: "buynow",
      buyerName: req.user.username,
    });

    res.status(200).json({ message: "Purchase successful", auction });
  } catch (err) {
    console.error("Buy now error:", err);
    res.status(500).json({ message: "Buy Now failed" });
  }
});

app.post("/api/auctions/:id/like", authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    const userId = mongoose.Types.ObjectId.createFromHexString(req.user.id);
    const liked = auction.likes.some((l) => l.toString() === req.user.id);
    if (liked)
      auction.likes = auction.likes.filter((l) => l.toString() !== req.user.id);
    else auction.likes.push(userId);
    await auction.save();
    res.json({ liked: !liked, likeCount: auction.likes.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

app.post("/api/auctions/:id/comment", authMiddleware, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text)
      return res.status(400).json({ message: "Comment cannot be empty" });
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    auction.comments.push({
      userId: req.user.id,
      username: req.user.username,
      text,
    });
    await auction.save();
    res.json({ message: "Comment added", comments: auction.comments });
  } catch (err) {
    res.status(500).json({ message: "Failed to add comment" });
  }
});

app.post("/api/auctions/:id/watch", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const auctionId = req.params.id;
    const watching = user.watchlist.some((w) => w.toString() === auctionId);
    if (watching)
      user.watchlist = user.watchlist.filter((w) => w.toString() !== auctionId);
    else user.watchlist.push(auctionId);
    await user.save();
    res.json({ watching: !watching });
  } catch (err) {
    res.status(500).json({ message: "Failed to update watchlist" });
  }
});

app.get("/api/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("watchlist");
    res.json(user.watchlist);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch watchlist" });
  }
});

app.get("/api/auctions/:id/bids", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id).select(
      "bids title currentBid",
    );
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    res.json({
      bids: [...auction.bids].reverse(),
      title: auction.title,
      currentBid: auction.currentBid,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bids" });
  }
});

app.delete("/api/auctions/:id", authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (auction.sellerId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });
    await auction.deleteOne();
    res.json({ message: "Auction deleted" });
  } catch (err) {
    res.status(500).json({ message: "Failed to delete auction" });
  }
});

app.put("/api/auctions/:id", authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (auction.sellerId.toString() !== req.user.id)
      return res.status(403).json({ message: "Not authorized" });
    if (auction.bids.length > 0)
      return res
        .status(400)
        .json({ message: "Cannot edit auction with existing bids" });
    const { title, description, category } = req.body;
    if (title) auction.title = title;
    if (description) auction.description = description;
    if (category) auction.category = category;
    await auction.save();
    res.json({ message: "Auction updated", auction });
  } catch (err) {
    res.status(500).json({ message: "Failed to update auction" });
  }
});

/* ══════════════════════════════
   MESSAGES
══════════════════════════════ */
const getConversations = async (req, res) => {
  try {
    const userId = req.user.id;
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("senderId", "username avatar")
      .populate("receiverId", "username avatar");

    const convMap = {};
    for (const msg of messages) {
      const senderIdStr = msg.senderId?._id
        ? msg.senderId._id.toString()
        : msg.senderId?.toString();
      const receiverIdStr = msg.receiverId?._id
        ? msg.receiverId._id.toString()
        : msg.receiverId?.toString();
      const partner = senderIdStr === userId ? msg.receiverId : msg.senderId;
      const key = partner?._id ? partner._id.toString() : partner?.toString();
      if (!key) continue;

      if (!convMap[key]) {
        convMap[key] = {
          userId: partner._id || partner,
          partnerId: partner._id || partner,
          partnerName: partner.username || "User",
          username: partner.username || "User",
          avatar: partner.avatar || "",
          partnerPic: partner.avatar || "",
          lastMessage:
            msg.message || (msg.messageType === "image" ? "📷 Image" : ""),
          lastMsgTime: msg.createdAt,
          lastTime: msg.createdAt,
          unread: 0,
        };
      }
      if (!msg.read && receiverIdStr === userId) convMap[key].unread++;
    }
    res.json(Object.values(convMap));
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

app.get("/api/messages", authMiddleware, getConversations);
app.get("/api/messages/conversations", authMiddleware, getConversations);

app.get("/api/messages/:userId", authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const theirId = req.params.userId;
    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: theirId },
        { senderId: theirId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });
    await Message.updateMany(
      { senderId: theirId, receiverId: myId, read: false },
      { read: true },
    );
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

app.post("/api/messages", authMiddleware, async (req, res) => {
  try {
    const { receiverId, message, messageType, imageUrl, location } = req.body;
    if (!receiverId)
      return res.status(400).json({ message: "Receiver required" });

    const msg = await Message.create({
      senderId: req.user.id,
      receiverId,
      senderName: req.user.username,
      message: message || "",
      messageType: messageType || "text",
      imageUrl: imageUrl || "",
      location: location || null,
    });

    await Notification.create({
      userId: receiverId,
      type: "message",
      message: `💬 ${req.user.username} sent you a message`,
      link: `chat:${req.user.id}`,
    });

    const receiverSocketId = onlineUsers[receiverId];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", {
        ...msg.toObject(),
        senderName: req.user.username,
        senderId: req.user.id,
      });
    }
    res.status(201).json(msg);
  } catch (err) {
    res.status(500).json({ message: "Failed to send message" });
  }
});

// Image message upload — now uses Cloudinary
app.post(
  "/api/messages/image",
  authMiddleware,
  uploadImages.single("image"),
  async (req, res) => {
    try {
      const { receiverId } = req.body;
      if (!receiverId || !req.file)
        return res.status(400).json({ message: "Receiver and image required" });
      // file.path is the full Cloudinary URL
      const imageUrl = req.file.path;
      const msg = await Message.create({
        senderId: req.user.id,
        receiverId,
        senderName: req.user.username,
        messageType: "image",
        imageUrl,
      });
      const receiverSocketId = onlineUsers[receiverId];
      if (receiverSocketId)
        io.to(receiverSocketId).emit("newMessage", {
          ...msg.toObject(),
          senderName: req.user.username,
          senderId: req.user.id,
        });
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send image message" });
    }
  },
);

/* ══════════════════════════════
   REVIEWS
══════════════════════════════ */
const submitReviewHandler = async (req, res) => {
  try {
    const targetUserId = req.params.userId || req.body.targetUserId;
    const { rating, comment, auctionId } = req.body;
    if (!targetUserId || !rating || !comment)
      return res.status(400).json({ message: "All fields required" });
    if (targetUserId === req.user.id)
      return res.status(400).json({ message: "Cannot review yourself" });

    const existing = await Review.findOne({
      reviewerId: req.user.id,
      targetUserId,
      auctionId: auctionId || null,
    });
    if (existing)
      return res
        .status(400)
        .json({ message: "You already reviewed this user" });

    const review = await Review.create({
      reviewerId: req.user.id,
      reviewerName: req.user.username,
      targetUserId,
      rating: Number(rating),
      comment,
      auctionId: auctionId || null,
    });
    await Notification.create({
      userId: targetUserId,
      type: "review",
      message: `⭐ ${req.user.username} left you a ${rating}-star review!`,
    });
    res.status(201).json({ message: "Review submitted", review });
  } catch (err) {
    res.status(500).json({ message: "Failed to submit review" });
  }
};

app.post("/api/reviews", authMiddleware, submitReviewHandler);
app.post("/api/reviews/:userId", authMiddleware, submitReviewHandler);

app.get("/api/reviews/:userId", async (req, res) => {
  try {
    const reviews = await Review.find({ targetUserId: req.params.userId }).sort(
      { createdAt: -1 },
    );
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    res.json({ reviews, averageRating: avg, count: reviews.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

/* ══════════════════════════════
   NOTIFICATIONS
══════════════════════════════ */
app.get("/api/notifications", authMiddleware, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});

app.put("/api/notifications/:id/read", authMiddleware, async (req, res) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { read: true },
    );
    res.json({ message: "Notification marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notification" });
  }
});

app.put("/api/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id }, { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notifications" });
  }
});

/* ══════════════════════════════
   STORIES
══════════════════════════════ */
app.get("/api/stories", async (req, res) => {
  try {
    const stories = await Story.find({ expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .limit(30);
    res.json(stories);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch stories" });
  }
});

app.post("/api/stories", authMiddleware, async (req, res) => {
  try {
    const { text, imageUrl } = req.body;
    if (!text && !imageUrl)
      return res.status(400).json({ message: "Add text or an image" });
    const story = await Story.create({
      userId: req.user.id,
      username: req.user.username,
      text: text || "",
      imageUrl: imageUrl || "",
    });
    res.status(201).json(story);
  } catch (err) {
    res.status(500).json({ message: "Failed to post story" });
  }
});

app.post("/api/stories/:id/view", authMiddleware, async (req, res) => {
  try {
    await Story.findByIdAndUpdate(req.params.id, {
      $addToSet: { views: req.user.id },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: "Failed to record view" });
  }
});

/* ══════════════════════════════
   ANALYTICS
══════════════════════════════ */
app.get("/api/analytics", authMiddleware, async (req, res) => {
  try {
    const myAuctions = await Auction.find({ sellerId: req.user.id });
    res.json({
      totalListings: myAuctions.length,
      activeListings: myAuctions.filter((a) => a.status === "active").length,
      endedListings: myAuctions.filter((a) => a.status === "ended").length,
      totalBidsReceived: myAuctions.reduce((s, a) => s + a.bids.length, 0),
      totalRevenue: myAuctions
        .filter((a) => a.status === "ended" && a.bids.length > 0)
        .reduce((s, a) => s + a.currentBid, 0),
      totalLikes: myAuctions.reduce((s, a) => s + a.likes.length, 0),
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

/* ══════════════════════════════
   ADMIN
══════════════════════════════ */
app.delete("/api/auctions/reset", async (req, res) => {
  try {
    await Auction.deleteMany({});
    res.json({ message: "All auctions cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset auctions" });
  }
});

/* ══════════════════════════════
   SOCKET.IO
══════════════════════════════ */
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", (userId) => {
    if (!userId) return;
    onlineUsers[userId] = socket.id;
    socket.userId = userId;
    socket.join(userId);
    socket.broadcast.emit("userOnline", userId);
    socket.emit("onlineUsers", Object.keys(onlineUsers));
    console.log(`👤 User ${userId} online`);
  });

  socket.on(
    "sendMessage",
    async ({ to, from, message, imageUrl, messageType }) => {
      try {
        if (!to || !from) return;
        const msg = await Message.create({
          senderId: from,
          receiverId: to,
          message: message || "",
          messageType: messageType || (imageUrl ? "image" : "text"),
          imageUrl: imageUrl || "",
          read: false,
        });
        const sender = await User.findById(from).select("username avatar");
        const payload = {
          ...msg.toObject(),
          senderName: sender?.username || "User",
          senderId: from,
        };
        io.to(to).emit("newMessage", payload);
        socket.emit("messageSent", payload);
        await Notification.create({
          userId: to,
          type: "message",
          message: `💬 ${sender?.username || "Someone"} sent you a message`,
          link: `chat:${from}`,
        }).catch(() => {});
        await Message.findByIdAndUpdate(msg._id, {
          senderName: sender?.username || "User",
        });
      } catch (err) {
        console.error("[Socket] sendMessage error:", err.message);
        socket.emit("messageError", { error: "Failed to send message" });
      }
    },
  );

  socket.on("typing", ({ to, from, username }) => {
    io.to(to).emit("typing", { from, username });
  });
  socket.on("stopTyping", ({ to, from }) => {
    io.to(to).emit("stopTyping", { from });
  });

  socket.on("disconnect", () => {
    const userId = socket.userId;
    if (userId) {
      delete onlineUsers[userId];
      socket.broadcast.emit("userOffline", userId);
    }
    console.log("🔌 Socket disconnected:", socket.id);
  });
});

/* ══════════════════════════════
   START
══════════════════════════════ */
server.listen(PORT, () => {
  console.log(`🚀 BiliBid server running on port ${PORT}`);
  console.log(
    `☁️  Cloudinary cloud: ${process.env.CLOUDINARY_CLOUD_NAME || "⚠️  not configured"}`,
  );
});
