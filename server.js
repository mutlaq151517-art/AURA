const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");

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
  episodes: [episodeSchema]
});

const Movie = mongoose.model("Movie", movieSchema);

/* ================= Upload Video ================= */

app.post("/upload-video", upload.single("video"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { resource_type: "video", chunk_size: 6000000 },
        (error, result) => {
          if (result) resolve(result);
          else reject(error);
        }
      );
      streamifier.createReadStream(req.file.buffer).pipe(stream);
    });

    res.json({ url: result.secure_url });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Upload failed" });
  }
});

/* ================= Movies ================= */

// Get All
app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

// Add Movie
app.post("/movies", async (req, res) => {
  const { title, image } = req.body;
  const newMovie = new Movie({ title, image, episodes: [] });
  await newMovie.save();
  res.json({ message: "Movie added" });
});

// ✅ Update Movie (هذا كان ناقص)
app.put("/movies/:id", async (req, res) => {
  try {

    const { title, image } = req.body;

    await Movie.findByIdAndUpdate(req.params.id, {
      title,
      image
    });

    res.json({ message: "Movie updated successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error updating movie" });
  }
});

// Delete Movie
app.delete("/movies/:id", async (req, res) => {
  try {

    const movie = await Movie.findByIdAndDelete(req.params.id);

    if (!movie)
      return res.status(404).json({ message: "Movie not found" });

    res.json({ message: "Movie deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error deleting movie" });
  }
});

// Add Episode
app.post("/movies/:id/episodes", async (req, res) => {
  const { name, video, image } = req.body;

  await Movie.findByIdAndUpdate(req.params.id, {
    $push: { episodes: { name, video, image } }
  });

  res.json({ message: "Episode added" });
});

// Delete Episode
app.delete("/movies/:seriesId/episodes/:episodeId", async (req, res) => {
  try {

    const movie = await Movie.findById(req.params.seriesId);

    if (!movie)
      return res.status(404).json({ message: "Movie not found" });

    movie.episodes = movie.episodes.filter(
      ep => ep._id.toString() !== req.params.episodeId
    );

    await movie.save();

    res.json({ message: "Episode deleted successfully" });

  } catch (err) {
    res.status(500).json({ message: "Error deleting episode" });
  }
});

/* ================= Static ================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
