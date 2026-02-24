const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 10000;

/* ================= Cloudinary ================= */

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

/* ================= Multer ================= */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2000 * 1024 * 1024 }
});

/* ================= MongoDB ================= */

mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => {
  console.error("Mongo Error ❌", err);
  process.exit(1);
});

/* ================= Schemas ================= */

const episodeSchema = new mongoose.Schema({
  name: String,
  video: String,
  image: String,
  isLocked: { type: Boolean, default: false }
}, { _id: true });

const movieSchema = new mongoose.Schema({
  title: String,
  image: String,
  video: String,
  episodes: [episodeSchema]
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,

  subscriptionActive: { type: Boolean, default: false },
  subscriptionExpiresAt: { type: Date, default: null },
  subscriptionLifetime: { type: Boolean, default: false }
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* ================= Auth ================= */

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ message: "Missing fields" });

    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashedPassword
    });

    await newUser.save();
    res.json({ message: "User registered successfully" });

  } catch (err) {
    res.status(500).json({ message: "Registration error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword)
      return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "aura_secret_key",
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login successful",
      token,
      userId: user._id
    });

  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
});

/* ================= 👑 عرض كل المستخدمين (جديد) ================= */

app.get("/admin/users", async (req, res) => {
  try {
    const users = await User.find({}, {
      username: 1,
      subscriptionActive: 1,
      subscriptionExpiresAt: 1,
      subscriptionLifetime: 1
    });

    res.json(users);

  } catch (err) {
    res.status(500).json({ message: "Failed to fetch users" });
  }
});

/* ================= إعطاء اشتراك ================= */

app.post("/admin/give-subscription", async (req, res) => {
  try {
    const { username, type, customDays, customDate } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(404).json({ message: "User not found" });

    let expiresAt = null;
    let lifetime = false;

    if (type === "1m") {
      expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    }
    else if (type === "1y") {
      expiresAt = new Date();
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }
    else if (type === "lifetime") {
      lifetime = true;
    }
    else if (type === "customDays" && customDays) {
      expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + Number(customDays));
    }
    else if (type === "customDate" && customDate) {
      expiresAt = new Date(customDate);
    }

    user.subscriptionActive = true;
    user.subscriptionExpiresAt = expiresAt;
    user.subscriptionLifetime = lifetime;

    await user.save();

    res.json({ message: "Subscription granted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Subscription error" });
  }
});

/* ================= قفل / فتح حلقة ================= */

app.post("/admin/toggle-episode-lock", async (req, res) => {
  try {
    const { movieId, episodeId, isLocked } = req.body;

    await Movie.updateOne(
      { _id: movieId, "episodes._id": episodeId },
      { $set: { "episodes.$.isLocked": isLocked } }
    );

    res.json({ message: "Episode lock status updated" });

  } catch (err) {
    res.status(500).json({ message: "Lock update failed" });
  }
});

/* ================= Movies ================= */

app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

app.post("/movies", async (req, res) => {
  const { title, image } = req.body;
  const newMovie = new Movie({ title, image, episodes: [] });
  await newMovie.save();
  res.json({ message: "Movie added" });
});

app.post("/movies/:id/episodes", async (req, res) => {
  const { name, video, image, isLocked } = req.body;

  await Movie.findByIdAndUpdate(req.params.id, {
    $push: { episodes: { name, video, image, isLocked: !!isLocked } }
  });

  res.json({ message: "Episode added" });
});

/* ================= Static ================= */

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("*", (req, res) => {
  const filePath = path.join(publicPath, req.path);

  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile()) {
    return res.sendFile(filePath);
  }

  return res.sendFile(path.join(publicPath, "index.html"));
});

/* ================= Start ================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
