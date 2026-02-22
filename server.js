const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const JWT_SECRET = "AURA_SECRET_KEY_2025";

/* =========================
   Cloudinary Config
========================= */

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
});

/* =========================
   Multer Config
========================= */

const storage = multer.memoryStorage();
const upload = multer({ storage });

/* =========================
   MongoDB
========================= */

mongoose.connect(
  "mongodb+srv://mutlaq151517_db_user:PHYxq5mF7VQ5SkxR@cluster0.wmswp4j.mongodb.net/auraDB?retryWrites=true&w=majority"
)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => {
  console.error("Mongo Error ❌", err);
  process.exit(1);
});

/* =========================
   Schemas
========================= */

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
  email: { type: String, unique: true },
  password: String
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* =========================
   VIDEO UPLOAD ROUTE
========================= */

app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "video" },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(file.buffer);
    });

    res.json({ url: result.secure_url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

/* =========================
   Movies
========================= */

app.get("/movies", async (req, res) => {
  try {
    const movies = await Movie.find();
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: "Error loading movies" });
  }
});

app.post("/movies", async (req, res) => {
  try {
    const { title, image } = req.body;

    const newMovie = new Movie({
      title,
      image,
      episodes: []
    });

    await newMovie.save();
    res.json({ message: "Movie added" });

  } catch (err) {
    res.status(500).json({ message: "Error adding movie" });
  }
});

/* ===== Add Episode ===== */

app.post("/movies/:id/episodes", async (req, res) => {
  try {
    const { name, video, image } = req.body;

    await Movie.findByIdAndUpdate(req.params.id, {
      $push: { episodes: { name, video, image } }
    });

    res.json({ message: "Episode added" });

  } catch (err) {
    res.status(500).json({ message: "Error adding episode" });
  }
});

/* ===== DELETE EPISODE (🔥 هذا المهم) ===== */

app.delete("/movies/:seriesId/episodes/:episodeId", async (req, res) => {
  try {

    const { seriesId, episodeId } = req.params;

    const movie = await Movie.findById(seriesId);

    if (!movie) {
      return res.status(404).json({ message: "Movie not found" });
    }

    movie.episodes = movie.episodes.filter(
      ep => ep._id.toString() !== episodeId
    );

    await movie.save();

    res.json({ message: "Episode deleted successfully" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting episode" });
  }
});

/* =========================
   Auth
========================= */

app.post("/register", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashed
    });

    await newUser.save();
    res.json({ message: "User created ✅" });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
   Static Files
========================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
