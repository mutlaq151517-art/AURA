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

/* ================= Cloudinary ================= */

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET
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
  subscriptionLifetime: { type: Boolean, default: false },
  subscriptionType: { type: String, default: null }
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

    res.json({
      message: "Login successful",
      token
    });

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

/* ================= Check Subscription ================= */

app.get("/check-subscription", authMiddleware, async (req,res)=>{

  const user = await User.findById(req.userId);
  if(!user) return res.json({ active:false });

  const now = new Date();

  if(user.subscriptionLifetime){
    return res.json({
      active:true,
      lifetime:true
    });
  }

  if(user.subscriptionExpiresAt && user.subscriptionExpiresAt > now){
    return res.json({
      active:true,
      expiresAt:user.subscriptionExpiresAt
    });
  }

  return res.json({ active:false });
});

/* ================= Admin Users ================= */

app.get("/admin/users", async (req, res) => {

  const users = await User.find();
  const now = new Date();

  const formatted = users.map(user=>{

    let active = false;
    let daysLeft = 0;

    if(user.subscriptionLifetime){
      active = true;
      daysLeft = "∞";
    }
    else if(user.subscriptionExpiresAt && user.subscriptionExpiresAt > now){
      active = true;
      daysLeft = Math.ceil(
        (user.subscriptionExpiresAt - now) / (1000*60*60*24)
      );
    }

    return {
      username:user.username,
      active,
      subscriptionType:user.subscriptionType,
      subscriptionExpiresAt:user.subscriptionExpiresAt,
      daysLeft
    };
  });

  res.json(formatted);
});

/* ================= Give Subscription ================= */

app.post("/admin/give-subscription", async (req, res) => {

  const { username, type, customDays, customDate } = req.body;

  const user = await User.findOne({ username });
  if (!user)
    return res.status(404).json({ message: "User not found" });

  const now = new Date();

  let baseDate =
    user.subscriptionExpiresAt && user.subscriptionExpiresAt > now
      ? new Date(user.subscriptionExpiresAt)
      : now;

  if(type === "1m"){
    baseDate.setMonth(baseDate.getMonth() + 1);
    user.subscriptionType = "شهر";
  }
  else if(type === "1y"){
    baseDate.setFullYear(baseDate.getFullYear() + 1);
    user.subscriptionType = "سنة";
  }
  else if(type === "lifetime"){
    user.subscriptionLifetime = true;
    user.subscriptionExpiresAt = null;
    user.subscriptionType = "مدى الحياة";
  }
  else if(type === "customDays" && customDays){
    baseDate.setDate(baseDate.getDate() + Number(customDays));
    user.subscriptionType = `${customDays} يوم`;
  }
  else if(type === "customDate" && customDate){
    user.subscriptionExpiresAt = new Date(customDate);
    user.subscriptionType = "مخصص";
  }

  if(type !== "lifetime"){
    user.subscriptionLifetime = false;
    user.subscriptionExpiresAt = baseDate;
  }

  user.subscriptionActive = true;

  await user.save();

  res.json({ message: "Subscription granted successfully" });
});

/* ================= Toggle Episode Lock ================= */

app.post("/admin/toggle-episode-lock", async (req, res) => {

  const { movieId, episodeId, isLocked } = req.body;

  await Movie.updateOne(
    { _id: movieId, "episodes._id": episodeId },
    { $set: { "episodes.$.isLocked": isLocked } }
  );

  res.json({ message: "Episode lock status updated" });
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

/* ================= Delete Movie ================= */

app.delete("/movies/:id", async (req, res) => {
  try {
    await Movie.findByIdAndDelete(req.params.id);
    res.json({ message: "Movie deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Delete movie failed" });
  }
});

/* ================= Delete Episode ================= */

app.delete("/movies/:movieId/episodes/:episodeId", async (req, res) => {
  try {
    const { movieId, episodeId } = req.params;

    await Movie.findByIdAndUpdate(movieId, {
      $pull: { episodes: { _id: episodeId } }
    });

    res.json({ message: "Episode deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Delete episode failed" });
  }
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
