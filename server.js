const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

/* 🔥 MongoDB Connection */
mongoose.connect(
  "mongodb+srv://mutlaq151517_db_user:PHYxq5mF7VQ5SkxR@cluster0.wmswp4j.mongodb.net/auraDB?retryWrites=true&w=majority"
)
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log("MongoDB Error ❌", err));

/* 🎬 Schema */
const episodeSchema = new mongoose.Schema({
  name: String,
  video: String
}, { _id: true });

const movieSchema = new mongoose.Schema({
  title: String,
  image: String,
  episodes: [episodeSchema]
}, { timestamps: true });

const Movie = mongoose.model("Movie", movieSchema);

/* ========================= */
/* 🎬 Routes */
/* ========================= */

/* جلب جميع المسلسلات */
app.get("/movies", async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ error: "Error fetching movies" });
  }
});

/* إضافة مسلسل */
app.post("/movies", async (req, res) => {
  try {
    const { title, image } = req.body;

    const newMovie = new Movie({
      title,
      image,
      episodes: []
    });

    await newMovie.save();
    res.json(newMovie);
  } catch (err) {
    res.status(500).json({ error: "Error adding movie" });
  }
});

/* تعديل مسلسل */
app.put("/movies/:id", async (req, res) => {
  try {
    const { title, image } = req.body;

    const updated = await Movie.findByIdAndUpdate(
      req.params.id,
      { title, image },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error updating movie" });
  }
});

/* حذف مسلسل */
app.delete("/movies/:id", async (req, res) => {
  try {
    await Movie.findByIdAndDelete(req.params.id);
    res.json({ message: "Movie deleted" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting movie" });
  }
});

/* إضافة حلقة */
app.post("/movies/:id/episodes", async (req, res) => {
  try {
    const { name, video } = req.body;

    const movie = await Movie.findById(req.params.id);
    movie.episodes.push({ name, video });

    await movie.save();
    res.json(movie);
  } catch (err) {
    res.status(500).json({ error: "Error adding episode" });
  }
});

/* حذف حلقة */
app.delete("/movies/:seriesId/episodes/:episodeId", async (req, res) => {
  try {
    const { seriesId, episodeId } = req.params;

    const updated = await Movie.findByIdAndUpdate(
      seriesId,
      { $pull: { episodes: { _id: episodeId } } },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Error deleting episode" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
