require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

/* ==============================
   SOCKET.IO — FIXED CORS + RELAY
============================== */
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "bilibid_secret_key";

/* ==============================
   MIDDLEWARE
============================== */
app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

/* ==============================
   MULTER (Image Uploads)
============================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

/* ==============================
   AUTH MIDDLEWARE
============================== */
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

/* ==============================
   MONGODB CONNECTION
============================== */
console.log("MONGO_URI:", process.env.MONGO_URI);
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    console.log("📌 DB:", mongoose.connection.name);
  })
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
  });
/* ==============================
   SCHEMAS
============================== */

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

// NEW: Transaction schema
const transactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["credit", "debit"],
      required: true,
    },
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
    // AUCTIONS
    await Auction.collection.createIndex({ status: 1, createdAt: -1 });
    await Auction.collection.createIndex({ sellerId: 1 });
    await Auction.collection.createIndex({
      title: "text",
      description: "text",
    });
    await Auction.collection.createIndex({ endsAt: 1 });

    // MESSAGES
    await Message.collection.createIndex({
      senderId: 1,
      receiverId: 1,
      createdAt: 1,
    });
    await Message.collection.createIndex({ receiverId: 1, read: 1 });

    // USERS
    await User.collection.createIndex({ username: 1 });

    // NOTIFICATIONS
    await Notification.collection.createIndex({
      userId: 1,
      read: 1,
      createdAt: -1,
    });

    // STORIES (TTL AUTO DELETE)
    await Story.collection.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0 },
    );

    // TRANSACTIONS
    await Transaction.collection.createIndex({ userId: 1, createdAt: -1 });

    console.log("✅ Indexes created successfully");
  } catch (err) {
    console.error("❌ Index creation error:", err.message);
  }
}
/* ==============================
   ROOT ROUTE
============================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "BiliBidMain.html"));
});

/* ==============================
   IMAGE UPLOAD ROUTES
============================== */
app.post(
  "/api/upload",
  authMiddleware,
  upload.array("images", 5),
  (req, res) => {
    if (!req.files || req.files.length === 0)
      return res.status(400).json({ message: "No files uploaded" });
    const urls = req.files.map((f) => `/uploads/${f.filename}`);
    res.json({ urls });
  },
);

app.post(
  "/api/upload/profile",
  authMiddleware,
  upload.single("profilePic"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ message: "No file uploaded" });
    res.json({ url: `/uploads/${req.file.filename}` });
  },
);

/* ==============================
   AUTH ROUTES
============================== */

/* REGISTER */
app.post("/api/register", async (req, res) => {
  try {
    console.log(
      "[REGISTER] DB:",
      mongoose.connection.db.databaseName,
      "| Host:",
      mongoose.connection.host,
    );
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ message: "All fields required" });
    if (password.length < 6)
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters" });

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashed });

    const token = jwt.sign(
      { id: user._id, username: user.username },
      JWT_SECRET,
      {
        expiresIn: "7d",
      },
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

/* LOGIN */
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
      {
        expiresIn: "7d",
      },
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

/* GET CURRENT USER */
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
});

/* UPDATE PROFILE */
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

/* CHANGE PASSWORD */
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

/* ==============================
   WALLET ROUTES
============================== */

/* WALLET: ADD FUNDS — records transaction */
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
    console.error("Wallet add error:", err);
    res.status(500).json({ message: "Failed to add funds" });
  }
});

/* WALLET: SEND MONEY TO ANOTHER USER */
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
      link: "",
    });

    res.json({
      message: `✅ ₱${sendAmt.toLocaleString()} sent to @${recipient.username}`,
      walletBalance: updatedSender.walletBalance,
    });
  } catch (err) {
    console.error("Wallet send error:", err);
    res.status(500).json({ message: "Failed to send money" });
  }
});

/* WALLET: WITHDRAW */
app.post("/api/wallet/withdraw", authMiddleware, async (req, res) => {
  try {
    const { amount, method, accountNumber, accountName } = req.body;
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
    console.error("Wallet withdraw error:", err);
    res.status(500).json({ message: "Failed to process withdrawal" });
  }
});

/* WALLET: GET TRANSACTION HISTORY */
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

/* ==============================
   USER ROUTES
============================== */

/* GET /api/users?search=q — used by live search */
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

    const result = users.map((u) => ({
      _id: u._id,
      username: u.username,
      avatar: u.avatar,
      bio: u.bio,
      followersCount: u.followers?.length || 0,
      followingCount: u.following?.length || 0,
      isFollowing: myId
        ? u.followers.some((f) => f.toString() === myId)
        : false,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* GET /api/users/:id — used by openUserProfile() */
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

/* POST /api/users/:id/follow */
app.post("/api/users/:id/follow", authMiddleware, async (req, res) => {
  try {
    const targetId = req.params.id;
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
    res.status(500).json({ message: "Follow action failed" });
  }
});

/* DELETE /api/users/:id/follow */
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

/* POST /api/users/upload-avatar */
app.post(
  "/api/users/upload-avatar",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "No file uploaded" });
      const avatarUrl = `/uploads/${req.file.filename}`;
      await User.findByIdAndUpdate(req.user.id, { avatar: avatarUrl });
      res.json({ avatarUrl });
    } catch (err) {
      res.status(500).json({ message: "Avatar upload failed" });
    }
  },
);

/* ==============================
   AUCTION ROUTES
============================== */

/* GET ALL AUCTIONS (with filters) */
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

    // Auto-end expired auctions
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
            message: `🏆 You won the auction for "${auction.title}" with a bid of ₱${winner.bidAmount}!`,
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

/* GET MY AUCTIONS — must be before /:id */
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

/* GET WON AUCTIONS — must be before /:id */
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

/* GET SINGLE AUCTION */
app.get("/api/auctions/:id", async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    res.json(auction);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auction" });
  }
});

/* CREATE AUCTION */
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

    const auction = await Auction.create({
      title,
      description: description || "",
      category: category || "Other",
      condition: condition || "",
      shipping: shipping || "",
      location: location || "",
      images: images || [],
      startingPrice: Number(startingPrice),
      currentBid: Number(startingPrice),
      buyNowPrice: buyNowPrice ? Number(buyNowPrice) : null,
      duration: Number(duration),
      endsAt: Date.now() + Number(duration) * 1000,
      sellerId: req.user.id,
      sellerName: req.user.username,
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

/* PLACE BID — with transaction recording */
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
      return res.status(400).json({
        message: `Bid must be higher than ₱${auction.currentBid}`,
      });

    const bidder = await User.findById(req.user.id);
    if (!bidder) return res.status(404).json({ message: "User not found" });
    if (bidder.walletBalance < amount)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    // Refund previous highest bidder
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

    // Deduct from bidder
    const updatedBidder = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: -amount } },
      { new: true },
    );

    // Record bid transaction
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
      message: `💰 ${req.user.username} placed a bid of ₱${amount} on "${auction.title}"`,
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

/* BUY NOW */
app.post("/api/auctions/:id/buynow", authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });
    if (auction.status === "ended")
      return res.status(400).json({ message: "Auction has ended" });
    if (!auction.buyNowPrice)
      return res.status(400).json({ message: "No Buy Now price set" });
    if (auction.sellerId.toString() === req.user.id)
      return res.status(400).json({ message: "Cannot buy your own auction" });

    const buyer = await User.findById(req.user.id);
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

    res.json({ message: "Purchase successful", auction });
  } catch (err) {
    res.status(500).json({ message: "Buy Now failed" });
  }
});

/* LIKE AUCTION */
app.post("/api/auctions/:id/like", authMiddleware, async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);
    if (!auction) return res.status(404).json({ message: "Auction not found" });

    const userId = mongoose.Types.ObjectId.createFromHexString(req.user.id);
    const liked = auction.likes.some((l) => l.toString() === req.user.id);

    if (liked) {
      auction.likes = auction.likes.filter((l) => l.toString() !== req.user.id);
    } else {
      auction.likes.push(userId);
    }
    await auction.save();
    res.json({ liked: !liked, likeCount: auction.likes.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to toggle like" });
  }
});

/* ADD COMMENT */
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

/* WATCHLIST TOGGLE */
app.post("/api/auctions/:id/watch", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const auctionId = req.params.id;
    const watching = user.watchlist.some((w) => w.toString() === auctionId);

    if (watching) {
      user.watchlist = user.watchlist.filter((w) => w.toString() !== auctionId);
    } else {
      user.watchlist.push(auctionId);
    }
    await user.save();
    res.json({ watching: !watching });
  } catch (err) {
    res.status(500).json({ message: "Failed to update watchlist" });
  }
});

/* GET WATCHLIST */
app.get("/api/watchlist", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).populate("watchlist");
    res.json(user.watchlist);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch watchlist" });
  }
});

/* AUCTION BID HISTORY */
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

/* DELETE AUCTION */
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

/* EDIT AUCTION */
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

/* ==============================
   MESSAGING ROUTES
============================== */

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
      const senderIdStr = msg.senderId._id
        ? msg.senderId._id.toString()
        : msg.senderId.toString();
      const receiverIdStr = msg.receiverId._id
        ? msg.receiverId._id.toString()
        : msg.receiverId.toString();

      const partner = senderIdStr === userId ? msg.receiverId : msg.senderId;
      const key = partner._id ? partner._id.toString() : partner.toString();

      if (!convMap[key]) {
        convMap[key] = {
          userId: partner._id || partner,
          partnerId: partner._id || partner,
          partnerName: partner.username || "User",
          username: partner.username || "User",
          avatar: partner.avatar || "",
          partnerPic: partner.avatar || "",
          lastMessage:
            msg.message ||
            (msg.messageType === "image" ? "📷 Image" : "📍 Location"),
          lastMsgTime: msg.createdAt,
          lastTime: msg.createdAt,
          unread: 0,
        };
      }
      if (!msg.read && receiverIdStr === userId) {
        convMap[key].unread++;
      }
    }

    res.json(Object.values(convMap));
  } catch (err) {
    console.error("Conversations error:", err);
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
};

app.get("/api/messages", authMiddleware, getConversations);
app.get("/api/messages/conversations", authMiddleware, getConversations);

/* GET MESSAGES WITH A SPECIFIC USER */
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

/* SEND MESSAGE (REST fallback) */
app.post("/api/messages", authMiddleware, async (req, res) => {
  try {
    const { receiverId, message, messageType, imageUrl, location } = req.body;
    if (!receiverId)
      return res.status(400).json({ message: "Receiver required" });

    const msg = await Message.create({
      senderId: req.user.id,
      receiverId,
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

/* SEND MESSAGE WITH IMAGE */
app.post(
  "/api/messages/image",
  authMiddleware,
  upload.single("image"),
  async (req, res) => {
    try {
      const { receiverId } = req.body;
      if (!receiverId || !req.file)
        return res.status(400).json({ message: "Receiver and image required" });

      const imageUrl = `/uploads/${req.file.filename}`;
      const msg = await Message.create({
        senderId: req.user.id,
        receiverId,
        messageType: "image",
        imageUrl,
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
      res.status(500).json({ message: "Failed to send image message" });
    }
  },
);

/* ==============================
   REVIEW ROUTES
============================== */

const submitReview = async (req, res) => {
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
        .json({ message: "You already reviewed this user for this auction" });

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

app.post("/api/reviews", authMiddleware, submitReview);
app.post("/api/reviews/:userId", authMiddleware, submitReview);

/* GET REVIEWS FOR USER */
app.get("/api/reviews/:userId", async (req, res) => {
  try {
    const reviews = await Review.find({
      targetUserId: req.params.userId,
    }).sort({ createdAt: -1 });
    const avg = reviews.length
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : 0;
    res.json({ reviews, averageRating: avg, count: reviews.length });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch reviews" });
  }
});

/* ==============================
   NOTIFICATION ROUTES
============================== */

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

/* ==============================
   STORY ROUTES
============================== */

app.get("/api/stories", async (req, res) => {
  try {
    const stories = await Story.find({
      expiresAt: { $gt: new Date() },
    })
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
      isLive: false,
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

/* ==============================
   ANALYTICS ROUTES
============================== */

app.get("/api/analytics", authMiddleware, async (req, res) => {
  try {
    const myAuctions = await Auction.find({ sellerId: req.user.id });
    const totalListings = myAuctions.length;
    const activeListings = myAuctions.filter(
      (a) => a.status === "active",
    ).length;
    const endedListings = myAuctions.filter((a) => a.status === "ended").length;
    const totalBidsReceived = myAuctions.reduce((s, a) => s + a.bids.length, 0);
    const totalRevenue = myAuctions
      .filter((a) => a.status === "ended" && a.bids.length > 0)
      .reduce((s, a) => s + a.currentBid, 0);
    const totalLikes = myAuctions.reduce((s, a) => s + a.likes.length, 0);

    res.json({
      totalListings,
      activeListings,
      endedListings,
      totalBidsReceived,
      totalRevenue,
      totalLikes,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

/* ==============================
   ADMIN: RESET
============================== */
app.delete("/api/auctions/reset", async (req, res) => {
  try {
    await Auction.deleteMany({});
    res.json({ message: "All auctions cleared" });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset auctions" });
  }
});

/* ==============================
   SOCKET.IO
============================== */
const onlineUsers = {}; // userId → socketId

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", (userId) => {
    if (!userId) return;
    onlineUsers[userId] = socket.id;
    socket.userId = userId;
    socket.join(userId);
    console.log(`👤 User ${userId} online`);

    socket.broadcast.emit("userOnline", userId);
    socket.emit("onlineUsers", Object.keys(onlineUsers));
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
      console.log(`👤 User ${userId} offline`);
    }
    console.log("🔌 Socket disconnected:", socket.id);
  });
});

/* ==============================
   START SERVER
============================== */
server.listen(PORT, () => {
  console.log(`🚀 BiliBid server running on port ${PORT}`);
});
