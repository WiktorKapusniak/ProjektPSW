const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const https = require("https");
const { Server } = require("socket.io");
const axios = require("axios");
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

const axiosInstance = axios.create({
  baseURL: "http://localhost:3000",
  timeout: 5000,
});

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
const chatHistory = [];

// Pobieranie historii wiadomości
app.get("/chat", (req, res) => {
  res.json({ messages: chatHistory });
});

// Wysyłanie wiadomości
app.post("/chat", (req, res) => {
  const { username, message } = req.body;
  if (!username || !message) {
    return res.status(400).json({ message: "Brak danych" });
  }

  const newMessage = { username, message };
  chatHistory.push(newMessage);

  // 🔹 Ograniczamy historię do 50 wiadomości
  if (chatHistory.length > 50) {
    chatHistory.shift();
  }

  res.status(201).json({ message: "Wiadomość zapisana", newMessage });
});

// Czyszczenie historii chatu
app.delete("/chat", (req, res) => {
  chatHistory.length = 0;
  res.json({ message: "Historia czatu wyczyszczona" });
});

//Obsługa chatu w czasie rzeczywistym
io.on("connection", (socket) => {
  console.log("Nowe połączenie:", socket.id);

  // 🔹 Pobieranie username z cookies
  socket.on("joinChat", async (cookies) => {
    const username = cookies.username;
    if (!username) {
      return socket.emit("error", "Brak nazwy użytkownika");
    }

    socket.username = username;
    console.log(`✅ ${username} dołączył do chatu`);

    // Wysyłamy historię wiadomości nowemu użytkownikowi
    socket.emit("chatHistory", chatHistory);

    // Powiadamiamy innych użytkowników
    io.emit("message", { username: "System", message: `${username} dołączył do chatu` });
  });

  // Obsługa wysyłania wiadomości
  socket.on("chatMessage", async (message) => {
    if (!socket.username) return;

    const newMessage = { username: socket.username, message };
    chatHistory.push(newMessage);
    io.emit("message", newMessage);

    // 🔹 Zapisujemy wiadomość w REST API
    try {
      await axiosInstance.post("/chat", newMessage);
    } catch (error) {
      console.error("Błąd zapisu wiadomości w REST API:", error.message);
    }
  });
  socket.on("leaveChat", () => {
    if (socket.username) {
      io.emit("message", { username: "System", message: `${socket.username} opuścił czat` });
      console.log(`❌ ${socket.username} opuścił czat`);
    }

    socket.leave("globalChat"); // Opcjonalnie opuszczamy pokój
  });
  //Obsługa rozłączenia
  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("message", { username: "System", message: `${socket.username} opuścił czat` });
      console.log(`❌ ${socket.username} opuścił czat`);
    }
  });
});

server.listen(port, () => {
  console.log(`Serwer HTTPS działa na https://localhost:${port}`);
});
