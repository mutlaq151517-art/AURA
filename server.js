const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const fs = require("fs");

const app = express();

app.use(cors());
app.use(express.json({ limit: "50mb" }));

const PORT = process.env.PORT || 10000;

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

/* 👑 watch history */
const watchSchema = new mongoose.Schema({
  movieId: String,
  episodeId: String,
  progress: Number,
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  subscriptionActive: { type: Boolean, default: false },
  subscriptionExpiresAt: { type: Date, default: null },
  subscriptionLifetime: { type: Boolean, default: false },
  subscriptionType: { type: String, default: null },

  /* 🔥 الجديد */
  watchHistory: [watchSchema]
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* ================= JWT Middleware ================= */

function authMiddleware(req,res,next){
  const authHeader = req.headers.authorization;
  if(!authHeader) return res.status(401).json({ message:"No token" });

  const token = authHeader.split(" ")[1];

  try{
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "aura_secret_key"
    );
    req.userId = decoded.id;
    next();
  }catch(err){
    res.status(401).json({ message:"Invalid token" });
  }
}

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

    res.json({ message: "Login successful", token });

  } catch (err) {
    res.status(500).json({ message: "Login error" });
  }
});

/* ================= 👤 Get Current User ================= */

app.get("/me", authMiddleware, async (req,res)=>{
  try{
    const user = await User.findById(req.userId);
    if(!user) return res.status(404).json({message:"User not found"});

    res.json({
      username:user.username,
      subscriptionLifetime:user.subscriptionLifetime,
      subscriptionExpiresAt:user.subscriptionExpiresAt,
      subscriptionType:user.subscriptionType
    });

  }catch(err){
    res.status(500).json({message:"Server error"});
  }
});

/* ================= 🎬 Save Progress ================= */

app.post("/save-progress", authMiddleware, async (req,res)=>{

  const { movieId, episodeId, progress } = req.body;

  if(!movieId || !episodeId)
    return res.status(400).json({ message:"Missing data" });

  const user = await User.findById(req.userId);
  if(!user) return res.status(404).json({ message:"User not found" });

  const existing = user.watchHistory.find(
    w => w.movieId === movieId && w.episodeId === episodeId
  );

  if(existing){
    existing.progress = progress;
    existing.updatedAt = new Date();
  }else{
    user.watchHistory.push({
      movieId,
      episodeId,
      progress
    });
  }

  await user.save();

  res.json({ message:"Progress saved" });
});

/* ================= 🎬 Get Progress ================= */

app.get("/get-progress/:movieId/:episodeId", authMiddleware, async (req,res)=>{

  const { movieId, episodeId } = req.params;

  const user = await User.findById(req.userId);
  if(!user) return res.json({ progress:0 });

  const record = user.watchHistory.find(
    w => w.movieId === movieId && w.episodeId === episodeId
  );

  if(record){
    return res.json({ progress:record.progress });
  }

  return res.json({ progress:0 });
});

/* ================= Check Subscription ================= */

app.get("/check-subscription", authMiddleware, async (req,res)=>{

  const user = await User.findById(req.userId);
  if(!user) return res.json({ active:false });

  const now = new Date();

  if(user.subscriptionLifetime){
    return res.json({ active:true, lifetime:true });
  }

  if(user.subscriptionExpiresAt && user.subscriptionExpiresAt > now){
    return res.json({
      active:true,
      expiresAt:user.subscriptionExpiresAt
    });
  }

  return res.json({ active:false });
});

/* ================= Movies ================= */

app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
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

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
