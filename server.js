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

app.get("/chat", (req, res) => {
  res.json({ messages: chatHistory });
});

app.post("/chat", (req, res) => {
  const { username, message } = req.body;
  if (!username || !message) {
    return res.status(400).json({ message: "Brak danych" });
  }

  const newMessage = { username, message };
  chatHistory.push(newMessage);

  if (chatHistory.length > 50) {
    chatHistory.shift();
  }

  res.status(201).json({ message: "Wiadomość zapisana", newMessage });
});

app.delete("/chat", (req, res) => {
  chatHistory.length = 0;
  res.json({ message: "Historia czatu wyczyszczona" });
});

io.on("connection", (socket) => {
  console.log("Nowe połączenie:", socket.id);

  socket.on("joinChat", async (cookies) => {
    const username = cookies.username;
    if (!username) {
      return socket.emit("error", "Brak nazwy użytkownika");
    }

    socket.username = username;
    console.log(`${username} dołączył do chatu`);

    socket.emit("chatHistory", chatHistory);

    io.emit("message", { username: "System", message: `${username} dołączył do chatu` });
  });

  socket.on("chatMessage", async (message) => {
    if (!socket.username) return;

    const newMessage = { username: socket.username, message };
    chatHistory.push(newMessage);
    io.emit("message", newMessage);

    try {
      await axiosInstance.post("/chat", newMessage);
    } catch (error) {
      console.error("Błąd zapisu wiadomości w REST API:", error.message);
    }
  });
  socket.on("leaveChat", () => {
    if (socket.username) {
      io.emit("message", { username: "System", message: `${socket.username} opuścił czat` });
      console.log(`${socket.username} opuścił czat`);
    }

    socket.leave("globalChat");
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      io.emit("message", { username: "System", message: `${socket.username} opuścił czat` });
      console.log(`${socket.username} opuścił czat`);
    }
  });
});

const gameRooms = {};

io.on("connection", (socket) => {
  console.log("Nowe połączenie:", socket.id);

  socket.on("joinGame", ({ room }) => {
    if (!gameRooms[room]) {
      gameRooms[room] = { players: [], scores: {}, dice: {}, currentTurn: null };
    }

    if (gameRooms[room].players.length >= 2) {
      socket.emit("error", "Pokój jest już pełny!");
      return;
    }
    gameRooms[room].players.push(socket.id);
    socket.join(room);

    io.to(room).emit("gameStatus", `Gracze w pokoju: ${gameRooms[room].players.length}/2`);

    if (gameRooms[room].players.length === 2) {
      gameRooms[room].currentTurn = gameRooms[room].players[0];
      io.to(room).emit("enableStartGame");
    }
  });

  socket.on("startGame", ({ room }) => {
    if (gameRooms[room] && gameRooms[room].players.length === 2) {
      gameRooms[room].scores = {};
      gameRooms[room].dice = {};

      gameRooms[room].players.forEach((playerId) => {
        rollDice(room, playerId);
      });

      io.to(room).emit("gameStatus", "Gra rozpoczęta! Pierwszy gracz rzuca kośćmi.");
      io.to(gameRooms[room].currentTurn).emit("yourTurn", "Twoja kolej!");
    }
  });

  function rollDice(room, playerId) {
    gameRooms[room].dice[playerId] = Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
    io.to(playerId).emit("rollDice", { dice: gameRooms[room].dice[playerId] });
  }

  socket.on("rerollDice", ({ room, selected }) => {
    const playerId = socket.id;
    if (!gameRooms[room] || !gameRooms[room].dice[playerId]) return;

    selected.forEach((index) => {
      gameRooms[room].dice[playerId][index] = Math.floor(Math.random() * 6) + 1;
    });

    io.to(playerId).emit("rollDice", { dice: gameRooms[room].dice[playerId] });
  });

  socket.on("endTurn", ({ room }) => {
    if (!gameRooms[room]) return;

    const playerId = socket.id;
    gameRooms[room].scores[playerId] = gameRooms[room].dice[playerId].reduce((sum, val) => sum + val, 0);

    const players = gameRooms[room].players;
    if (Object.keys(gameRooms[room].scores).length === 2) {
      const [player1, player2] = players;
      const score1 = gameRooms[room].scores[player1];
      const score2 = gameRooms[room].scores[player2];

      if (score1 > score2) {
        io.to(player1).emit("gameResult", "🏆 Wygrałeś!");
        io.to(player2).emit("gameResult", "😞 Przegrałeś!");
      } else if (score1 < score2) {
        io.to(player1).emit("gameResult", "😞 Przegrałeś!");
        io.to(player2).emit("gameResult", "🏆 Wygrałeś!");
      } else {
        io.to(room).emit("gameResult", "🤝 Remis!");
      }
    } else {
      gameRooms[room].currentTurn = players.find((id) => id !== playerId);
      io.to(gameRooms[room].currentTurn).emit("yourTurn", "Twoja kolej!");
    }
  });

  socket.on("leaveGame", ({ room }) => {
    socket.leave(room);
    gameRooms[room].players = gameRooms[room].players.filter((id) => id !== socket.id);

    if (gameRooms[room].players.length === 0) {
      delete gameRooms[room];
    } else {
      io.to(room).emit("gameStatus", "Drugi gracz opuścił pokój, czekamy na nowego...");
    }
  });
});
server.listen(port, () => {
  console.log(`Serwer HTTPS działa na https://localhost:${port}`);
});
