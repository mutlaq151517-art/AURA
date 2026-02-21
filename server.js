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
   MongoDB Connection
========================= */

mongoose.connect(
  "mongodb+srv://mutlaq151517_db_user:PHYxq5mF7VQ5SkxR@cluster0.wmswp4j.mongodb.net/auraDB?retryWrites=true&w=majority"
)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));

/* =========================
   Schemas
========================= */

const episodeSchema = new mongoose.Schema({
  name: String,
  video: String
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
  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
  watchHistory: [{
    movieId: mongoose.Schema.Types.ObjectId,
    episodeVideo: String,
    currentTime: Number,
    updatedAt: Date
  }]
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* =========================
   Auth Middleware
========================= */

function verifyToken(req, res, next){
  const token = req.headers.authorization;
  if(!token) return res.status(401).json({ message: "No token" });

  try{
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  }catch(err){
    return res.status(403).json({ message: "Invalid token" });
  }
}

/* =========================
   Auth Routes
========================= */

app.post("/register", async (req, res) => {
  try{
    const { username, password } = req.body;

    const existing = await User.findOne({ username });
    if(existing) return res.status(400).json({ message: "User exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      password: hashed
    });

    await newUser.save();

    res.json({ message: "User created ✅" });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

app.post("/login", async (req, res) => {
  try{
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if(!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if(!valid) return res.status(400).json({ message: "Wrong password" });

    const token = jwt.sign(
      { id: user._id },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  }catch(err){
    res.status(500).json({ error: err.message });
  }
});

/* =========================
   Save Watch Progress
========================= */

app.post("/save-progress", verifyToken, async (req, res) => {
  const { movieId, episodeVideo, currentTime } = req.body;

  await User.findByIdAndUpdate(req.userId, {
    $pull: { watchHistory: { movieId } }
  });

  await User.findByIdAndUpdate(req.userId, {
    $push: {
      watchHistory: {
        movieId,
        episodeVideo,
        currentTime,
        updatedAt: new Date()
      }
    }
  });

  res.json({ message: "Progress saved" });
});

/* =========================
   Get Watch Progress
========================= */

app.get("/get-progress/:movieId", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  const progress = user.watchHistory.find(
    item => item.movieId.toString() === req.params.movieId
  );

  res.json(progress || null);
});

/* =========================
   Movies API
========================= */

app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

app.post("/movies", async (req, res) => {
  const newMovie = new Movie(req.body);
  await newMovie.save();
  res.json(newMovie);
});

app.put("/movies/:id", async (req, res) => {
  const updated = await Movie.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});

app.delete("/movies/:id", async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

/* =========================
   Static Files
========================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
