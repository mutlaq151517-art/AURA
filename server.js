const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

// 🔥 MongoDB Connection
mongoose.connect(
  "mongodb+srv://mutlaq151517_db_user:PHYxq5mF7VQ5SkxR@cluster0.wmswp4j.mongodb.net/?appName=Cluster0",
  {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  }
)
.then(() => console.log("MongoDB Connected ✅"))
.catch((err) => console.log("MongoDB Error ❌", err));

// 🎬 Movie Schema
const movieSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    image: { type: String, required: true },
    video: { type: String, required: true },
  },
  { timestamps: true }
);

const Movie = mongoose.model("Movie", movieSchema);

// ✅ Test route
app.get("/", (req, res) => {
  res.send("AURA Backend Running 🚀");
});

// 📥 Get all movies
app.get("/movies", async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.json(movies);
  } catch (error) {
    res.status(500).json({ error: "Error fetching movies" });
  }
});

// ➕ Add movie
app.post("/movies", async (req, res) => {
  try {
    const newMovie = new Movie(req.body);
    await newMovie.save();
    res.json({ message: "Movie added successfully ✅" });
  } catch (error) {
    res.status(500).json({ error: "Error adding movie" });
  }
});

// ❌ Delete movie
app.delete("/movies/:id", async (req, res) => {
  try {
    await Movie.findByIdAndDelete(req.params.id);
    res.json({ message: "Movie deleted successfully ❌" });
  } catch (error) {
    res.status(500).json({ error: "Error deleting movie" });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
