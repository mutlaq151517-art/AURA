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
  console.log("Mongo Error ❌", err);
  process.exit(1);
});

/* =========================
   Schemas
========================= */

const profileSchema = new mongoose.Schema({
  name: String,
  color: String,
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
  freeEpisodesCount: { type: Number, default: 2 },
  episodes: [episodeSchema]
});

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true },
  email: { type: String, unique: true },
  password: String,
  subscription: {
    type: { type: String, default: "free" },
    expiresAt: Date
  },
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
   Static Files (المهم 🔥)
========================= */

app.use(express.static(path.join(__dirname, "public")));

// 👇 هذا هو السطر اللي كان ناقص
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   Auth
========================= */

app.post("/register", async (req, res) => {
  try{
    const { username, email, password } = req.body;

    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if(existing)
      return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    const newUser = new User({
      username,
      email,
      password: hashed,
      profiles: [{
        name: username,
        color: "#00b4d8",
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
    if(!user)
      return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if(!valid)
      return res.status(400).json({ message: "Wrong password" });

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

/* =========================
   Watch Route
========================= */

app.get("/watch/:movieId/:episodeIndex", verifyToken, async (req,res)=>{
  try{
    const { movieId, episodeIndex } = req.params;

    const user = await User.findById(req.userId);
    const movie = await Movie.findById(movieId);

    if(!movie)
      return res.status(404).json({message:"Movie not found"});

    const index = parseInt(episodeIndex);

    if(!movie.episodes[index])
      return res.status(404).json({message:"Episode not found"});

    if(index < movie.freeEpisodesCount){
      return res.json({ video: movie.episodes[index].video });
    }

    if(
      user.subscription.type === "lifetime" ||
      (user.subscription.type === "premium" &&
       user.subscription.expiresAt &&
       user.subscription.expiresAt > new Date())
    ){
      return res.json({ video: movie.episodes[index].video });
    }

    return res.status(403).json({message:"Subscription required"});

  }catch(err){
    res.status(500).json({message:"Server error"});
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
   Start Server
========================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
