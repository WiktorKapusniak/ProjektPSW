const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const app = express();
const port = 3000;
const usersFile = "./data/users.json";

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static("public"));

// Funkcja do wczytywania użytkowników
const getUsers = () => {
  if (!fs.existsSync(usersFile)) {
    fs.writeFileSync(usersFile, JSON.stringify({ users: [] }, null, 2));
  }
  return JSON.parse(fs.readFileSync(usersFile)).users;
};

// Funkcja do zapisywania użytkowników
const saveUsers = (users) => {
  fs.writeFileSync(usersFile, JSON.stringify({ users }, null, 2));
};

// Rejestracja użytkownika (POST /users)
app.post("/users", (req, res) => {
  const { username, password } = req.body;
  let users = getUsers();

  if (users.some((user) => user.username === username)) {
    return res.status(400).json({ message: "Nazwa użytkownika już istnieje" });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  users.push({ username, password: hashedPassword });
  saveUsers(users);

  res.cookie("username", username, { httpOnly: true });
  res.cookie("passwd", password, { httpOnly: true });

  res.status(201).json({ message: "Rejestracja udana!", username });
});

// Logowanie użytkownika (POST /users/login)
app.post("/users/login", (req, res) => {
  const { username, password } = req.body;
  let users = getUsers();
  const user = users.find((user) => user.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Nieprawidłowe dane logowania" });
  }

  res.cookie("username", username, { httpOnly: true });
  res.cookie("passwd", password, { httpOnly: true });

  res.json({ message: "Logowanie udane!", username });
});

// Sprawdzenie, czy użytkownik jest zalogowany (GET /users/auth)
app.get("/users/auth", (req, res) => {
  const { username, passwd } = req.cookies;
  let users = getUsers();
  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(passwd, user.password)) {
    return res.status(401).json({ message: "Nie jesteś zalogowany" });
  }

  res.json({ message: "Zalogowany", username });
});

// Usuwanie użytkownika (DELETE /users)
app.delete("/users", (req, res) => {
  const { username, passwd } = req.cookies;
  let users = getUsers();
  const filteredUsers = users.filter((user) => user.username !== username);

  if (users.length === filteredUsers.length) {
    return res.status(404).json({ message: "Użytkownik nie istnieje" });
  }

  saveUsers(filteredUsers);
  res.clearCookie("username");
  res.clearCookie("passwd");
  res.json({ message: "Użytkownik usunięty" });
});

// Wylogowanie użytkownika (POST /users/logout)
app.post("/users/logout", (req, res) => {
  res.clearCookie("username");
  res.clearCookie("passwd");
  res.json({ message: "Wylogowano" });
});

app.listen(port, () => {
  console.log(`Serwer działa na http://localhost:${port}`);
});
