const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

let movies = [];

// عرض كل الأفلام
app.get("/movies", (req, res) => {
  res.json(movies);
});

// إضافة فيلم
app.post("/movies", (req, res) => {
  const movie = req.body;
  movie.id = Date.now(); // رقم فريد
  movies.push(movie);
  res.json({ message: "Added successfully" });
});

// حذف فيلم
app.delete("/movies/:id", (req, res) => {
  const id = parseInt(req.params.id);
  movies = movies.filter(movie => movie.id !== id);
  res.json({ message: "Deleted successfully" });
});

app.listen(PORT, () => {
  console.log("AURA Backend Running 🚀");
});
