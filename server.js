const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

// مهم جداً
app.use(cors());
app.use(express.json());

// تخزين مؤقت بالذاكرة
let movies = [];

// اختبار السيرفر
app.get("/", (req, res) => {
  res.send("AURA Backend Running 🚀");
});

// جلب كل الأفلام
app.get("/movies", (req, res) => {
  res.json(movies);
});

// إضافة فيلم
app.post("/movies", (req, res) => {
  const { title, image, video } = req.body;

  if (!title || !image || !video) {
    return res.status(400).json({
      error: "Missing title, image or video"
    });
  }

  const newMovie = {
    id: Date.now(),
    title,
    image,
    video
  };

  movies.push(newMovie);

  res.status(201).json({
    message: "Movie added successfully ✅",
    movie: newMovie
  });
});

// حذف فيلم
app.delete("/movies/:id", (req, res) => {
  const id = parseInt(req.params.id);
  movies = movies.filter(movie => movie.id !== id);

  res.json({ message: "Movie deleted 🗑️" });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
