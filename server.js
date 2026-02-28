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

    /* 🔥 حملة أول 50 مستخدم */
    const promoCount = await User.countDocuments({
      subscriptionType: "عرض السنة المجانية"
    });

    let subscriptionData = {};

    if (promoCount < 50) {
      const oneYearLater = new Date();
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      subscriptionData = {
        subscriptionActive: true,
        subscriptionExpiresAt: oneYearLater,
        subscriptionLifetime: false,
        subscriptionType: "عرض السنة المجانية"
      };
    }

    const newUser = new User({
      username,
      password: hashedPassword,
      ...subscriptionData
    });

    await newUser.save();

    res.json({
      message: promoCount < 50
        ? "🎉 مبروك! حصلت على اشتراك مجاني لمدة سنة"
        : "User registered successfully"
    });

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

/* ===== باقي الملف بدون أي تغيير ===== */

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

/* ================= باقي الأكواد بدون أي تعديل ================= */

app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

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
  console.log("ZARO Backend Running 🚀");
});
