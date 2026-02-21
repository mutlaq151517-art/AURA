const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

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

const Movie = mongoose.model("Movie", movieSchema);

/* =========================
   Static Files (Frontend)
========================= */

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   API Routes
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

app.put("/movies/:id", async (req, res) => {
  const updated = await Movie.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true }
  );
  res.json(updated);
});

app.delete("/movies/:id", async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

app.post("/movies/:id/episodes", async (req, res) => {
  const movie = await Movie.findById(req.params.id);
  movie.episodes.push(req.body);
  await movie.save();
  res.json(movie);
});

app.delete("/movies/:seriesId/episodes/:episodeId", async (req, res) => {
  await Movie.findByIdAndUpdate(
    req.params.seriesId,
    { $pull: { episodes: { _id: req.params.episodeId } } }
  );
  res.json({ message: "Episode deleted" });
});

/* =========================
   Start Server
========================= */

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
