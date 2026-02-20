const express = require("express");
const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

let movies = [];

app.get("/movies", (req, res) => {
  res.json(movies);
});

app.post("/movies", (req, res) => {
  const movie = req.body;
  movies.push(movie);
  res.json({ message: "Added successfully" });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
