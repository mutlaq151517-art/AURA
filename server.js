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
  image: String
}, { _id: true });

const movieSchema = new mongoose.Schema({
  title: String,
  image: String,
  video: String,
  freeEpisodes: { type: Number, default: 1 },
  episodes: [episodeSchema]
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  password: String,
  role: { type: String, default: "user" }, // user / admin
  subscriptionEnd: { type: Date, default: null }
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* ================= Helpers ================= */

function generateToken(user){
  return jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET || "aura_secret_key",
    { expiresIn: "7d" }
  );
}

function isSubscribed(user){
  if (!user.subscriptionEnd) return false;
  return new Date(user.subscriptionEnd) > new Date();
}

async function authMiddleware(req,res,next){
  try{
    const token = req.headers.authorization?.split(" ")[1];
    if(!token) return res.status(401).json({message:"No token"});
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "aura_secret_key");
    req.user = await User.findById(decoded.id);
    if(!req.user) return res.status(401).json({message:"Invalid user"});
    next();
  }catch{
    res.status(401).json({message:"Unauthorized"});
  }
}

function adminOnly(req,res,next){
  if(req.user.role !== "admin")
    return res.status(403).json({message:"Admins only"});
  next();
}

/* ================= Auth ================= */

app.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body;
    const existingUser = await User.findOne({ username });
    if (existingUser)
      return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ username, password: hashedPassword });

    await newUser.save();
    res.json({ message: "User registered successfully" });

  } catch {
    res.status(500).json({ message: "Registration error" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Wrong password" });

    const token = generateToken(user);

    res.json({
      token,
      subscribed: isSubscribed(user),
      role: user.role,
      subscriptionEnd: user.subscriptionEnd
    });

  } catch {
    res.status(500).json({ message: "Login error" });
  }
});

/* ================= Admin Subscription Control ================= */

app.get("/admin/users", authMiddleware, adminOnly, async (req,res)=>{
  const users = await User.find().select("-password");
  res.json(users);
});

app.post("/admin/subscribe", authMiddleware, adminOnly, async (req,res)=>{
  const { username, duration } = req.body;
  const user = await User.findOne({ username });
  if(!user) return res.status(404).json({message:"User not found"});

  let endDate = new Date();

  if(duration === "1m") endDate.setMonth(endDate.getMonth()+1);
  if(duration === "1y") endDate.setFullYear(endDate.getFullYear()+1);
  if(duration === "lifetime") endDate = new Date("2099-12-31");

  user.subscriptionEnd = endDate;
  await user.save();

  res.json({message:"Subscription updated", subscriptionEnd:endDate});
});

/* ================= Upload Video ================= */

app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {
    const base64Video = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
    const result = await cloudinary.uploader.upload(base64Video, { resource_type: "video" });
    res.json({ url: result.secure_url });
  } catch {
    res.status(500).json({ message: "Upload failed" });
  }
});

/* ================= Movies ================= */

app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

app.post("/movies", async (req, res) => {
  const { title, image, freeEpisodes } = req.body;
  const newMovie = new Movie({ title, image, freeEpisodes });
  await newMovie.save();
  res.json({ message: "Movie added" });
});

app.post("/movies/:id/episodes", async (req, res) => {
  const { name, video, image } = req.body;
  await Movie.findByIdAndUpdate(req.params.id, {
    $push: { episodes: { name, video, image } }
  });
  res.json({ message: "Episode added" });
});

app.delete("/movies/:movieId/episodes/:episodeId", async (req, res) => {
  await Movie.findByIdAndUpdate(req.params.movieId, {
    $pull: { episodes: { _id: req.params.episodeId } }
  });
  res.json({ message: "Episode deleted successfully" });
});

app.delete("/movies/:id", async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id);
  res.json({ message: "Movie deleted successfully" });
});

/* ================= Static ================= */

const publicPath = path.join(__dirname, "public");
app.use(express.static(publicPath));

app.get("*", (req, res) => {
  const filePath = path.join(publicPath, req.path);
  if (fs.existsSync(filePath) && fs.lstatSync(filePath).isFile())
    return res.sendFile(filePath);
  return res.sendFile(path.join(publicPath, "index.html"));
});

/* ================= Start ================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
