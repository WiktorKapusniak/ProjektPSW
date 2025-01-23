const express = require("express");
const app = express();
const port = 3000;
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Serwer działa!");
});

app.listen(port, () => {
  console.log(`Serwer działa na porcie http://localhost:${port}`);
});
