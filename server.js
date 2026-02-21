const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 10000;

/* 🔥 غير الباسورد إذا غيرته */
mongoose.connect("mongodb+srv://mutlaq151517_db_user:PHYxq5mF7VQ5SkxR@cluster0.wmswp4j.mongodb.net/aura?retryWrites=true&w=majority")
.then(() => console.log("MongoDB Connected ✅"))
.catch(err => console.log(err));

/* 🎬 Model */
const movieSchema = new mongoose.Schema({
  title: String,
  image: String,
  video: String,
  episodes: [
    {
      name: String,
      video: String
    }
  ]
});

const Movie = mongoose.model("Movie", movieSchema);

/* 📥 جلب كل الأعمال */
app.get("/movies", async (req, res) => {
  const movies = await Movie.find();
  res.json(movies);
});

/* ➕ إضافة مسلسل أو فيلم */
app.post("/movies", async (req, res) => {
  const newMovie = new Movie(req.body);
  await newMovie.save();
  res.json({ message: "Added successfully" });
});

/* ➕ إضافة حلقة لمسلسل */
app.post("/movies/:id/episodes", async (req, res) => {
  try {
    const { name, video } = req.body;

    await Movie.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          episodes: { name, video }
        }
      }
    );

    res.json({ message: "Episode added ✅" });
  } catch (error) {
    res.status(500).json({ error: "Error adding episode" });
  }
});

/* ❌ حذف مسلسل */
app.delete("/movies/:id", async (req, res) => {
  await Movie.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted successfully" });
});

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
