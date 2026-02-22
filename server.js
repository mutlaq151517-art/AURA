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
  resetToken: String,
  resetTokenExpiry: Date
});

const Movie = mongoose.model("Movie", movieSchema);
const User = mongoose.model("User", userSchema);

/* =========================
   Email Setup
========================= */

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "ضع_ايميلك_هنا@gmail.com",
    pass: "ضع_App_Password_هنا"
  }
});

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
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if(existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
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
   Forgot Password
========================= */

app.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "User not found" });

  const token = crypto.randomBytes(32).toString("hex");

  user.resetToken = token;
  user.resetTokenExpiry = Date.now() + 1000 * 60 * 15;
  await user.save();

  const resetLink = `https://aura-backend-mpvi.onrender.com/reset-password/${token}`;

  await transporter.sendMail({
    to: email,
    subject: "AURA Reset Password",
    html: `
      <h2>إعادة تعيين كلمة المرور</h2>
      <p>اضغط الرابط التالي:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>صالح لمدة 15 دقيقة</p>
    `
  });

  res.json({ message: "Reset email sent ✅" });
});

app.post("/reset-password/:token", async (req, res) => {
  const user = await User.findOne({
    resetToken: req.params.token,
    resetTokenExpiry: { $gt: Date.now() }
  });

  if (!user) return res.status(400).json({ message: "Invalid or expired token" });

  const hashed = await bcrypt.hash(req.body.password, 10);

  user.password = hashed;
  user.resetToken = undefined;
  user.resetTokenExpiry = undefined;

  await user.save();

  res.json({ message: "Password updated ✅" });
});

/* =========================
   Logged User Info
========================= */

app.get("/me", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId).select("username");
  res.json({ username: user.username });
});

/* =========================
   Continue Watching
========================= */

app.post("/progress", verifyToken, async (req, res) => {
  const { movieId, episodeId, currentTime } = req.body;
  const user = await User.findById(req.userId);

  const existing = user.continueWatching.find(
    item =>
      item.movieId.toString() === movieId &&
      item.episodeId === episodeId
  );

  if(existing){
    existing.currentTime = currentTime;
  } else {
    user.continueWatching.push({ movieId, episodeId, currentTime });
  }

  await user.save();
  res.json({ message: "Progress saved ✅" });
});

app.get("/progress/:movieId/:episodeId", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);

  const item = user.continueWatching.find(
    p =>
      p.movieId.toString() === req.params.movieId &&
      p.episodeId === req.params.episodeId
  );

  res.json(item || { currentTime: 0 });
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

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
