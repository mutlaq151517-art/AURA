const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto = require("crypto");

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
  email: { type: String, unique: true },
  password: String,

  favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],
  watchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Movie" }],

  continueWatching: [
    {
      movieId: { type: mongoose.Schema.Types.ObjectId, ref: "Movie" },
      episodeId: String,
      currentTime: Number
    }
  ],

  profiles: [
    {
      name: String,
      color: String
    }
  ],

  resetToken: String,
  resetTokenExpiry: Date
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* =========================
   Middleware
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
   Auth
========================= */

app.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  const existing = await User.findOne({ $or: [{ username }, { email }] });
  if(existing) return res.status(400).json({ message: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);

  const colors = ["#ff4d6d","#00b4d8","#8338ec","#06d6a0","#ffbe0b"];

  const newUser = new User({
    username,
    email,
    password: hashed,
    profiles: [
      {
        name: username,
        color: colors[Math.floor(Math.random()*colors.length)]
      }
    ]
  });

  await newUser.save();
  res.json({ message: "User created ✅" });
});

app.post("/login", async (req, res) => {
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
});

app.get("/me", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId).select("username");
  res.json({ username: user.username });
});

/* =========================
   Profiles
========================= */

const profileColors = ["#ff4d6d","#00b4d8","#8338ec","#06d6a0","#ffbe0b","#f72585","#3a86ff"];

// GET profiles
app.get("/profiles", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user.profiles || []);
});

// CREATE profile
app.post("/profiles", verifyToken, async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.userId);

  if(user.profiles.length >= 5){
    return res.status(400).json({ message: "Maximum 5 profiles allowed" });
  }

  user.profiles.push({
    name,
    color: profileColors[Math.floor(Math.random()*profileColors.length)]
  });

  await user.save();
  res.json({ message: "Profile created ✅" });
});

// UPDATE profile
app.put("/profiles/:profileId", verifyToken, async (req, res) => {
  const { name } = req.body;
  const user = await User.findById(req.userId);

  const profile = user.profiles.id(req.params.profileId);
  if(!profile) return res.status(404).json({ message: "Profile not found" });

  profile.name = name;
  await user.save();

  res.json({ message: "Profile updated ✅" });
});

// DELETE profile
app.delete("/profiles/:profileId", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);

  if(user.profiles.length <= 1){
    return res.status(400).json({ message: "Cannot delete last profile" });
  }

  const profile = user.profiles.id(req.params.profileId);
  if(!profile) return res.status(404).json({ message: "Profile not found" });

  profile.remove();
  await user.save();

  res.json({ message: "Profile deleted ✅" });
});

/* =========================
   Movies
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

/* =========================
   Static
========================= */

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
