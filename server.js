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
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "bilibid_secret_key";

/* ==============================
   MIDDLEWARE
============================== */
app.use(cors());
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
mongoose.set("strictQuery", true);
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

/* ==============================
   SCHEMAS
============================== */

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    bio: { type: String, default: "" },
    location: { type: String, default: "" },
    walletBalance: { type: Number, default: 0 },
    watchlist: [{ type: mongoose.Schema.Types.ObjectId, ref: "Auction" }],
  },
  { timestamps: true },
);

const auctionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: { type: String, default: "" },
    category: { type: String, default: "Other" },
    location: { type: String, default: "" },
    images: [{ type: String }],
    startingPrice: { type: Number, required: true },
    currentBid: { type: Number, required: true },
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

const User = mongoose.model("User", userSchema);
const Auction = mongoose.model("Auction", auctionSchema);
const Message = mongoose.model("Message", messageSchema);
const Review = mongoose.model("Review", reviewSchema);
const Notification = mongoose.model("Notification", notificationSchema);

/* ==============================
   ROOT ROUTE
============================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "BiliBidMain.html"));
});

/* ==============================
   IMAGE UPLOAD ROUTE
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
        profilePic: user.profilePic,
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
        profilePic: user.profilePic,
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
    const { bio, location, profilePic } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { bio, location, profilePic },
      { new: true },
    ).select("-password");
    res.json({ message: "Profile updated", user });
  } catch (err) {
    res.status(500).json({ message: "Failed to update profile" });
  }
});

/* WALLET: ADD FUNDS */
app.post("/api/wallet/add", authMiddleware, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0)
      return res.status(400).json({ message: "Invalid amount" });
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { walletBalance: Number(amount) } },
      { new: true },
    ).select("-password");
    res.json({ message: "Funds added", walletBalance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ message: "Failed to add funds" });
  }
});

/* ==============================
   AUCTION ROUTES
============================== */

/* GET ALL AUCTIONS (with filters) */
app.get("/api/auctions", async (req, res) => {
  try {
    const { category, search, minPrice, maxPrice, location, status } =
      req.query;
    const filter = {};
    if (category && category !== "All") filter.category = category;
    if (search) filter.title = { $regex: search, $options: "i" };
    if (location) filter.location = { $regex: location, $options: "i" };
    if (status) filter.status = status;
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
          // Notify winner
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

/* GET SINGLE AUCTION — keep /:id AFTER all /user/* routes */
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
      location,
      images,
      startingPrice,
      duration,
    } = req.body;
    if (!title || !startingPrice || !duration)
      return res.status(400).json({ message: "Missing required fields" });

    const auction = await Auction.create({
      title,
      description: description || "",
      category: category || "Other",
      location: location || "",
      images: images || [],
      startingPrice: Number(startingPrice),
      currentBid: Number(startingPrice),
      duration: Number(duration),
      endsAt: Date.now() + Number(duration) * 1000,
      sellerId: req.user.id,
      sellerName: req.user.username,
      bids: [],
    });

    // Notify seller
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

/* PLACE BID */
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

    // Deduct from bidder wallet
    const bidder = await User.findById(req.user.id);
    if (!bidder) return res.status(404).json({ message: "User not found" });
    if (bidder.walletBalance < amount)
      return res.status(400).json({ message: "Insufficient wallet balance" });

    // Refund previous highest bidder
    if (auction.bids.length > 0) {
      const lastBid = auction.bids[auction.bids.length - 1];
      await User.findByIdAndUpdate(lastBid.bidderId, {
        $inc: { walletBalance: lastBid.bidAmount },
      });
    }

    await User.findByIdAndUpdate(req.user.id, {
      $inc: { walletBalance: -amount },
    });

    auction.currentBid = amount;
    auction.bids.push({
      bidderId: req.user.id,
      bidderName: req.user.username,
      bidAmount: amount,
      placedAt: new Date(),
    });
    await auction.save();

    // Notify seller of new bid
    await Notification.create({
      userId: auction.sellerId,
      type: "bid",
      message: `💰 ${req.user.username} placed a bid of ₱${amount} on your auction "${auction.title}"`,
    });

    io.emit("bidPlaced", {
      auctionId: auction._id,
      currentBid: amount,
      bidderName: req.user.username,
    });
    res.json({ message: "Bid placed", auction });
  } catch (err) {
    console.error("Bid error:", err);
    res.status(500).json({ message: "Failed to place bid" });
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

/* WATCHLIST */
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
      bids: auction.bids.reverse(),
      title: auction.title,
      currentBid: auction.currentBid,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch bids" });
  }
});

/* DELETE AUCTION (seller only) */
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

/* EDIT AUCTION (seller only) */
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

/* GET CONVERSATIONS */
app.get("/api/messages/conversations", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const messages = await Message.find({
      $or: [{ senderId: userId }, { receiverId: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("senderId", "username profilePic")
      .populate("receiverId", "username profilePic");

    // Group by conversation partner
    const convMap = {};
    for (const msg of messages) {
      const partner =
        msg.senderId._id.toString() === userId ? msg.receiverId : msg.senderId;
      const key = partner._id.toString();
      if (!convMap[key]) {
        convMap[key] = {
          partnerId: partner._id,
          partnerName: partner.username,
          partnerPic: partner.profilePic,
          lastMessage:
            msg.message ||
            (msg.messageType === "image" ? "📷 Image" : "📍 Location"),
          lastTime: msg.createdAt,
          unread: 0,
        };
      }
      if (!msg.read && msg.receiverId._id.toString() === userId) {
        convMap[key].unread++;
      }
    }

    res.json(Object.values(convMap));
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch conversations" });
  }
});

/* GET MESSAGES WITH USER */
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

    // Mark as read
    await Message.updateMany(
      { senderId: theirId, receiverId: myId, read: false },
      { read: true },
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch messages" });
  }
});

/* SEND MESSAGE */
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

    // Notify receiver
    await Notification.create({
      userId: receiverId,
      type: "message",
      message: `💬 ${req.user.username} sent you a message`,
    });

    io.to(receiverId).emit("newMessage", {
      ...msg.toObject(),
      senderName: req.user.username,
    });
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

      io.to(receiverId).emit("newMessage", {
        ...msg.toObject(),
        senderName: req.user.username,
      });
      res.status(201).json(msg);
    } catch (err) {
      res.status(500).json({ message: "Failed to send image message" });
    }
  },
);

/* ==============================
   REVIEW ROUTES
============================== */

/* POST REVIEW */
app.post("/api/reviews", authMiddleware, async (req, res) => {
  try {
    const { targetUserId, rating, comment, auctionId } = req.body;
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
});

/* GET REVIEWS FOR USER */
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

app.put("/api/notifications/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id }, { read: true });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ message: "Failed to mark notifications" });
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
    const totalViews = myAuctions.reduce((s, a) => s + a.likes.length, 0);

    res.json({
      totalListings,
      activeListings,
      endedListings,
      totalBidsReceived,
      totalRevenue,
      totalLikes: totalViews,
    });
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch analytics" });
  }
});

/* ==============================
   SOCKET.IO REAL-TIME MESSAGING
============================== */
const onlineUsers = {};

io.on("connection", (socket) => {
  console.log("🔌 Socket connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers[userId] = socket.id;
    socket.join(userId);
    console.log(`👤 User ${userId} joined`);
  });

  socket.on("disconnect", () => {
    for (const [userId, sid] of Object.entries(onlineUsers)) {
      if (sid === socket.id) {
        delete onlineUsers[userId];
        break;
      }
    }
  });
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
   START SERVER
============================== */
server.listen(PORT, () => {
  console.log(`🚀 BiliBid server running on port ${PORT}`);
});
