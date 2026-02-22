const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;
const JWT_SECRET = "AURA_SECRET_KEY_2025";

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
   API ROUTES
========================= */

/* ===== Movies ===== */

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

app.put("/movies/:id", async (req, res) => {
  try {
    const { title, image } = req.body;

    await Movie.findByIdAndUpdate(req.params.id, {
      title,
      image
    });

    res.json({ message: "Movie updated" });

  } catch (err) {
    res.status(500).json({ message: "Error updating movie" });
  }
});

app.delete("/movies/:id", async (req, res) => {
  try {
    await Movie.findByIdAndDelete(req.params.id);
    res.json({ message: "Movie deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting movie" });
  }
});

/* ===== Episodes ===== */

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

app.delete("/movies/:seriesId/episodes/:episodeId", async (req, res) => {
  try {
    await Movie.findByIdAndUpdate(req.params.seriesId, {
      $pull: { episodes: { _id: req.params.episodeId } }
    });

    res.json({ message: "Episode deleted" });

  } catch (err) {
    res.status(500).json({ message: "Error deleting episode" });
  }
});

/* ===== Auth ===== */

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
   Static Files (يكون آخر شيء)
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
