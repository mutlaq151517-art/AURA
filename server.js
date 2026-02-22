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
.catch(err => console.log(err));

/* =========================
   Schemas
========================= */

const profileSchema = new mongoose.Schema({
  name: String,
  color: String,

  // 🔥 لكل ملف سجل مشاهدة خاص فيه
  continueWatching: [
    {
      movieId: { type: mongoose.Schema.Types.ObjectId, ref: "Movie" },
      episodeId: String,
      currentTime: Number
    }
  ]

}, { _id: true });

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

  profiles: [profileSchema]
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
  try{
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if(existing) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const colors = ["#ff4d6d","#00b4d8","#8338ec","#06d6a0","#ffbe0b"];

    const newUser = new User({
      username,
      email,
      password: hashed,
      profiles: [{
        name: username,
        color: colors[Math.floor(Math.random()*colors.length)],
        continueWatching: []
      }]
    });

    await newUser.save();
    res.json({ message: "User created ✅" });

  }catch(err){
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
  }
});

app.get("/me", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId).select("username");
  res.json({ username: user.username });
});

/* =========================
   Profiles
========================= */

const profileColors = ["#ff4d6d","#00b4d8","#8338ec","#06d6a0","#ffbe0b","#f72585","#3a86ff"];

app.get("/profiles", verifyToken, async (req, res) => {
  const user = await User.findById(req.userId);
  res.json(user.profiles || []);
});

app.post("/profiles", verifyToken, async (req, res) => {
  try{
    const { name } = req.body;
    const user = await User.findById(req.userId);

    if(user.profiles.length >= 5)
      return res.status(400).json({ message: "Maximum 5 profiles allowed" });

    user.profiles.push({
      name,
      color: profileColors[Math.floor(Math.random()*profileColors.length)],
      continueWatching: []
    });

    await user.save();
    res.json({ message: "Profile created ✅" });

  }catch(err){
    res.status(500).json({ message: "Error creating profile" });
  }
});

app.put("/profiles/:profileId", verifyToken, async (req, res) => {
  try{
    const { name } = req.body;
    const user = await User.findById(req.userId);

    const profile = user.profiles.id(req.params.profileId);
    if(!profile)
      return res.status(404).json({ message: "Profile not found" });

    profile.name = name;
    await user.save();

    res.json({ message: "Profile updated ✅" });

  }catch(err){
    res.status(500).json({ message: "Error updating profile" });
  }
});

app.delete("/profiles/:profileId", verifyToken, async (req, res) => {
  try{
    const user = await User.findById(req.userId);

    if(user.profiles.length <= 1)
      return res.status(400).json({ message: "Cannot delete last profile" });

    user.profiles = user.profiles.filter(
      p => p._id.toString() !== req.params.profileId
    );

    await user.save();
    res.json({ message: "Profile deleted ✅" });

  }catch(err){
    res.status(500).json({ message: "Error deleting profile" });
  }
});

/* =========================
   🔥 Continue Watching (Per Profile)
========================= */

app.post("/progress", verifyToken, async (req, res) => {
  try{
    const { profileId, movieId, episodeId, currentTime } = req.body;

    const user = await User.findById(req.userId);
    const profile = user.profiles.id(profileId);

    if(!profile)
      return res.status(404).json({ message: "Profile not found" });

    const existing = profile.continueWatching.find(
      item =>
        item.movieId.toString() === movieId &&
        item.episodeId === episodeId
    );

    if(existing){
      existing.currentTime = currentTime;
    }else{
      profile.continueWatching.push({
        movieId,
        episodeId,
        currentTime
      });
    }

    await user.save();
    res.json({ message: "Progress saved ✅" });

  }catch(err){
    res.status(500).json({ message: "Error saving progress" });
  }
});

app.get("/progress/:profileId/:movieId/:episodeId", verifyToken, async (req,res)=>{
  try{
    const user = await User.findById(req.userId);
    const profile = user.profiles.id(req.params.profileId);

    if(!profile)
      return res.status(404).json({ message:"Profile not found" });

    const item = profile.continueWatching.find(
      p =>
        p.movieId.toString() === req.params.movieId &&
        p.episodeId === req.params.episodeId
    );

    res.json(item || { currentTime: 0 });

  }catch(err){
    res.status(500).json({ message:"Error fetching progress" });
  }
});

/* =========================
   Movies
========================= */

app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

/* =========================
   Static
========================= */

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
