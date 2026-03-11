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
  .then(() => {
    console.log("✅ MongoDB Connected");
  })
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

/* REGISTER */
app.post("/api/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        message: "Username, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existing = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existing) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await User.create({
      username,
      email,
      password: hashed,
    });

    res.status(201).json({
      message: "Account created successfully",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({
      message: "Registration failed",
    });
  }
});

/* LOGIN */
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password required",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(400).json({
        message: "Invalid credentials",
      });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({
      message: "Login failed",
    });
  }
});

/* ==============================
   AUCTION ROUTES
============================== */

/* GET ALL AUCTIONS */
app.get("/api/auctions", async (req, res) => {
  try {
    const auctions = await Auction.find();
    res.json(auctions);
  } catch (err) {
    res.status(500).json({
      message: "Failed to fetch auctions",
    });
  }
});

/* CREATE AUCTION */
app.post("/api/create-auction", async (req, res) => {
  try {
    const { title, startingPrice, duration } = req.body;

    if (!title || !startingPrice || !duration) {
      return res.status(400).json({
        message: "Missing auction fields",
      });
    }

    const auction = await Auction.create({
      title,
      startingPrice: Number(startingPrice),
      currentBid: Number(startingPrice),
      duration: Number(duration),
      endsAt: Date.now() + Number(duration) * 1000,
      bids: [],
    });

    res.status(201).json({
      message: "Auction created",
      auction,
    });
  } catch (err) {
    console.error("Create auction error:", err);
    res.status(500).json({
      message: "Failed to create auction",
    });
  }
});

/* PLACE BID */
app.post("/api/place-bid/:id", async (req, res) => {
  try {
    const { bidderName, bidAmount } = req.body;

    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({
        message: "Auction not found",
      });
    }

    if (Date.now() > auction.endsAt) {
      return res.status(400).json({
        message: "Auction already ended",
      });
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

    res.json({
      message: "Bid placed",
      auction,
    });
  } catch (err) {
    console.error("Bid error:", err);
    res.status(500).json({
      message: "Failed to place bid",
    });
  }
});

/* RESET AUCTIONS */
app.delete("/api/auctions/reset", async (req, res) => {
  try {
    await Auction.deleteMany({});
    res.json({
      message: "All auctions cleared",
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to reset auctions",
    });
  }
});

/* ==============================
   START SERVER
============================== */

app.listen(PORT, () => {
  console.log(`🚀 BiliBid server running on port ${PORT}`);
});
