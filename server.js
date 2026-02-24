const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

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
  image: String
}, { _id: true });

const movieSchema = new mongoose.Schema({
  title: String,
  image: String,
  video: String,
  episodes: [episodeSchema]
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* ================= Auth ================= */

// Register
app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;

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

// Login
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
      token
    });

  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
});

/* ================= Upload Video ================= */

app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const base64Video = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const result = await cloudinary.uploader.upload(base64Video, {
      resource_type: "video"
    });

    res.json({ url: result.secure_url });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
});

/* ================= Movies ================= */

// Get All
app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

// Add Movie
app.post("/movies", async (req, res) => {
  const { title, image } = req.body;
  const newMovie = new Movie({ title, image, episodes: [] });
  await newMovie.save();
  res.json({ message: "Movie added" });
});

// Update Movie
app.put("/movies/:id", async (req, res) => {
  try {
    const { title, image } = req.body;

    await Movie.findByIdAndUpdate(req.params.id, {
      title,
      image
    });

    res.json({ message: "Movie updated successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error updating movie" });
  }
});

// Delete Movie
app.delete("/movies/:id", async (req, res) => {
  try {

    const movie = await Movie.findByIdAndDelete(req.params.id);

    if (!movie)
      return res.status(404).json({ message: "Movie not found" });

    res.json({ message: "Movie deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error deleting movie" });
  }
});

// Add Episode
app.post("/movies/:id/episodes", async (req, res) => {
  const { name, video, image } = req.body;

  await Movie.findByIdAndUpdate(req.params.id, {
    $push: { episodes: { name, video, image } }
  });

  res.json({ message: "Episode added" });
});

// Delete Episode
app.delete("/movies/:seriesId/episodes/:episodeId", async (req, res) => {
  try {

    const movie = await Movie.findById(req.params.seriesId);

    if (!movie)
      return res.status(404).json({ message: "Movie not found" });

    movie.episodes = movie.episodes.filter(
      ep => ep._id.toString() !== req.params.episodeId
    );

    await movie.save();

    res.json({ message: "Episode deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error deleting episode" });
  }
});

/* ================= Static ================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* ================= Start ================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
