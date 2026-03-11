require("dotenv").config();

const express = require("express");
const path = require("path");
const cors = require("cors");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const app = express();
const PORT = process.env.PORT || 3000;

/* ==============================
   MIDDLEWARE
============================== */
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname)));

/* ==============================
   ROOT ROUTE
============================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "BiliBidMain.html"));
});

/* ==============================
   MONGODB CONNECTION
============================== */
mongoose.set("strictQuery", true);

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB Runtime Error:", err);
});

/* ==============================
   SCHEMAS
============================== */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
  },
  { timestamps: true },
);

const auctionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    startingPrice: { type: Number, required: true },
    currentBid: { type: Number, required: true },
    duration: { type: Number, required: true },
    endsAt: { type: Number, required: true },
    bids: [
      {
        bidderName: String,
        bidAmount: Number,
        placedAt: String,
      },
    ],
  },
  { timestamps: true },
);

const User = mongoose.model("User", userSchema);
const Auction = mongoose.model("Auction", auctionSchema);

/* ==============================
   USER ROUTES
============================== */

// REGISTER
app.post("/api/register", async (req, res) => {
  try {
    console.log("Register request:", req.body);

    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      return res.status(400).json({ message: "User already exists." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      username,
      email,
      password: hashedPassword,
    });

    console.log("User saved:", newUser);

    res.status(201).json({
      message: "Account created successfully!",
      user: {
        id: newUser._id,
        username: newUser.username,
        email: newUser.email,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error during registration." });
  }
});

// LOGIN
app.post("/api/login", async (req, res) => {
  try {
    console.log("Login request:", req.body);

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials." });
    }

    res.json({
      message: "Login successful!",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error during login." });
  }
});

/* ==============================
   AUCTION ROUTES
============================== */

// GET all auctions
app.get("/api/auctions", async (req, res) => {
  try {
    const auctions = await Auction.find();
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch auctions." });
  }
});

// CREATE auction
app.post("/api/create-auction", async (req, res) => {
  try {
    const { title, startingPrice, duration } = req.body;

    if (!title || !startingPrice || !duration) {
      return res.status(400).json({ message: "Missing auction fields." });
    }

    const newAuction = await Auction.create({
      title,
      startingPrice: Number(startingPrice),
      currentBid: Number(startingPrice),
      duration: Number(duration),
      endsAt: Date.now() + Number(duration) * 1000,
      bids: [],
    });

    res.status(201).json({
      message: "Auction created!",
      auction: newAuction,
    });
  } catch (err) {
    console.error("Create auction error:", err);
    res.status(500).json({ message: "Failed to create auction." });
  }
});

// PLACE BID
app.post("/api/place-bid/:id", async (req, res) => {
  try {
    const { bidderName, bidAmount } = req.body;

    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found." });
    }

    if (Date.now() > auction.endsAt) {
      return res.status(400).json({ message: "Auction ended." });
    }

    const amount = Number(bidAmount);

    if (amount <= auction.currentBid) {
      return res.status(400).json({
        message: `Bid must be higher than ${auction.currentBid}`,
      });
    }

    auction.currentBid = amount;
    auction.bids.push({
      bidderName: bidderName || "Anonymous",
      bidAmount: amount,
      placedAt: new Date().toISOString(),
    });

    await auction.save();

    res.json({ message: "Bid placed!", auction });
  } catch (err) {
    console.error("Bid error:", err);
    res.status(500).json({ message: "Failed to place bid." });
  }
});

// RESET auctions
app.delete("/api/auctions/reset", async (req, res) => {
  try {
    await Auction.deleteMany({});
    res.json({ message: "All auctions cleared." });
  } catch (err) {
    res.status(500).json({ message: "Failed to reset auctions." });
  }
});

/* ==============================
   START SERVER
============================== */
app.listen(PORT, () => {
  console.log(`🚀 BiliBid server running at http://localhost:${PORT}`);
});
