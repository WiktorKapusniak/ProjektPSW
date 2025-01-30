const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const https = require("https");
const { Server } = require("socket.io");

const app = express();
const port = 3000;
const usersFile = "./data/users.json";

app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static("public"));

const privateKey = fs.readFileSync("key.pem", "utf8");
const certificate = fs.readFileSync("cert.pem", "utf8");
const credentials = { key: privateKey, cert: certificate };

const server = https.createServer(credentials, app);
const io = new Server(server);

const users = {};
const chatMessages = [];

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

// Rejestracja użytkownika
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

// Logowanie użytkownika
app.post("/users/login", (req, res) => {
  const { username, password } = req.body;
  let users = getUsers();
  const user = users.find((user) => user.username === username);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: "Nieprawidłowe dane logowania" });
  }

  res.cookie("username", username, { httpOnly: true, secure: true, sameSite: "strict" });
  res.cookie("passwd", password, { httpOnly: true, secure: true, sameSite: "strict" });

  res.json({ message: "Logowanie udane!", username });
});

// Sprawdzenie, czy użytkownik jest zalogowany
app.get("/users/auth", (req, res) => {
  const { username, passwd } = req.cookies;
  let users = getUsers();
  const user = users.find((u) => u.username === username);

  if (!user || !bcrypt.compareSync(passwd, user.password)) {
    return res.status(401).json({ message: "Nie jesteś zalogowany" });
  }

  res.json({ message: "Zalogowany", username });
});

// Usuwanie użytkownika
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

// Wylogowanie użytkownika
app.post("/users/logout", (req, res) => {
  res.clearCookie("username");
  res.clearCookie("passwd");
  res.json({ message: "Wylogowano" });
});
// wyszukiwarka uzytkownikow z wzorcem
app.get("/users/search", (req, res) => {
  const query = req.query.query.toLowerCase();
  const users = getUsers();
  const filteredUsers = users.filter((user) => user.username.toLowerCase().includes(query));
  res.json({ users: filteredUsers });
});
// zmiana nicku uzytkownika
app.patch("/users/update", (req, res) => {
  const { username, passwd } = req.cookies;
  const { newUsername } = req.body;
  let users = getUsers();
  if (users.some((user) => user.username === newUsername)) {
    return res.status(400).json({ message: "Taka nazwa użytkownika już istnieje!" });
  }
  const userIndex = users.findIndex((user) => user.username === username);
  if (userIndex === -1) {
    return res.status(404).json({ message: "Użytkownik nie znaleziony!" });
  }
  users[userIndex].username = newUsername;
  saveUsers(users);

  res.cookie("username", newUsername, { httpOnly: true, secure: true, sameSite: "strict" });
  res.json({ message: "Nazwa użytkownika zmieniona!", newUsername });
});

// CHAT
// Dołączenie do chatu
app.post("/chat/join", (req, res) => {
  const { username, passwd } = req.cookies;

  users[username] = true;
  io.emit("message", `✅ ${username} dołączył do chatu.`);
  res.json({ message: "Dołączono do chatu", username });
});

// Wysłanie wiadomości
app.post("/chat/message", (req, res) => {
  const { message } = req.body;
  const { username, passwd } = req.cookies;
  if (!username || !message) {
    return res.status(400).json({ message: "Brak treści wiadomości lub nazwy użytkownika" });
  }

  const chatMessage = { username, message, timestamp: new Date().toISOString() };
  chatMessages.push(chatMessage);
  io.emit("message", `${username}: ${message}`);
  res.json({ message: "Wiadomość wysłana", chatMessage });
});

// Pobranie historii wiadomości
app.get("/chat/messages", (req, res) => {
  res.json({ messages: chatMessages });
});

// Opuszczenie chatu
app.delete("/chat/leave", (req, res) => {
  const { username, passwd } = req.cookies;
  if (!users[username]) {
    return res.status(404).json({ message: "Użytkownik nie jest na czacie" });
  }

  delete users[username];
  io.emit("message", `❌ ${username} opuścił chat.`);
  res.json({ message: "Użytkownik opuścił chat" });
});

server.listen(port, () => {
  console.log(`Serwer HTTPS działa na https://localhost:${port}`);
});
