async function register() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  try {
    const response = await axios.post("/users", { username, password });
    document.getElementById("register-message").innerText = response.data.message;
    checkAuth();
  } catch (error) {
    document.getElementById("register-message").innerText = error.response.data.message;
  }
}

async function login() {
  const username = document.getElementById("login-username").value;
  const password = document.getElementById("login-password").value;

  try {
    const response = await axios.post("/users/login", { username, password });
    document.getElementById("login-message").innerText = response.data.message;
    checkAuth();
  } catch (error) {
    document.getElementById("login-message").innerText = error.response.data.message;
  }
}

async function checkAuth() {
  try {
    const response = await axios.get("/users/auth");
    if (response.data.message === "Zalogowany") {
      document.getElementById("login-container").style.display = "none";
      document.getElementById("main-container").style.display = "block";
    }
  } catch (error) {
    document.getElementById("login-container").style.display = "block";
    document.getElementById("main-container").style.display = "none";
  }
}
window.addEventListener("load", () => {
  checkAuth();
});

async function remove() {
  try {
    const response = await axios.delete("/users");
    if (response.data.message === "Użytkownik usunięty") {
      checkAuth();
    }
  } catch (error) {
    document.getElementById("profile").innerText = error.response.data.message;
  }
}

async function logout() {
  try {
    await axios.post("/users/logout");
    checkAuth();
  } catch (error) {
    console.error("Błąd przy wylogowywaniu");
  }
}

async function search() {
  const query = document.getElementById("user-search").value;

  try {
    const response = await axios.get(`/users/search?query=${query}`);

    const usersList = response.data.users;
    const resultsContainer = document.getElementById("search-results");

    resultsContainer.innerHTML = "";

    if (usersList.length === 0) {
      resultsContainer.innerText = "Brak wyników";
      return;
    }

    usersList.forEach((user) => {
      const userElement = document.createElement("p");
      userElement.innerText = user.username;
      resultsContainer.appendChild(userElement);
    });
  } catch (error) {
    document.getElementById("search-results").innerText = error.response?.data?.message || "Błąd wyszukiwania";
  }
}

async function changeUsername() {
  const newUsername = document.getElementById("nickname-input").value.trim();
  document.getElementById("profile-message").innerHTML = "";
  try {
    const response = await axios.patch("/users/update", { newUsername });

    document.getElementById("profile-message").innerText = response.data.message;
  } catch (error) {
    document.getElementById("profile-message").innerText = error.response?.data?.message || "Błąd zmiany nazwy użytkownika";
  }
}
//CHAT
const socket = io();

function joinChat() {
  document.getElementById("chat-container").style.display = "block";
  document.getElementById("join-chat").style.display = "none";
  axios
    .get("/users/auth")
    .then((res) => {
      socket.emit("joinChat", { username: res.data.username });
    })
    .catch(() => {
      alert("Musisz być zalogowany!");
    });
}

function sendMessage() {
  const messageInput = document.getElementById("message-input");
  const message = messageInput.value.trim();
  if (!message) return;

  socket.emit("chatMessage", message);
  messageInput.value = "";
}

function leaveChat() {
  document.getElementById("chat-container").style.display = "none";
  document.getElementById("join-chat").style.display = "block";
  socket.emit("leaveChat");
}
socket.on("message", (data) => {
  const messagesDiv = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  msgDiv.textContent = `${data.username}: ${data.message}`;
  messagesDiv.appendChild(msgDiv);
});

socket.on("chatHistory", (history) => {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";
  history.forEach((msg) => {
    const msgDiv = document.createElement("div");
    msgDiv.textContent = `${msg.username}: ${msg.message}`;
    messagesDiv.appendChild(msgDiv);
  });
});
//GRA
let room = "";
let diceValues = [];
let selectedDice = new Set();

function joinGame() {
  room = document.getElementById("room-input").value.trim();
  if (!room) {
    alert("Podaj numer pokoju!");
    return;
  }

  document.getElementById("game-lobby").style.display = "none";
  document.getElementById("game-room").style.display = "block";
  document.getElementById("room-name").innerText = room;

  socket.emit("joinGame", { room });
}

function startGame() {
  socket.emit("startGame", { room });
}

function leaveGame() {
  socket.emit("leaveGame", { room });
  document.getElementById("game-lobby").style.display = "block";
  document.getElementById("game-room").style.display = "none";
}

socket.on("gameStatus", (status) => {
  document.getElementById("game-status").innerText = status;
});

socket.on("enableStartGame", () => {
  document.getElementById("start-game").disabled = false;
});

socket.on("yourTurn", (message) => {
  document.getElementById("game-status").innerText = message;
  document.getElementById("dice-area").style.display = "block";
  document.getElementById("reroll-btn").disabled = false;
  document.getElementById("end-turn-btn").disabled = false;
});

socket.on("rollDice", (data) => {
  diceValues = data.dice;
  updateDiceDisplay();
});

function updateDiceDisplay() {
  const diceDiv = document.getElementById("dice");
  diceDiv.innerHTML = "";

  diceValues.forEach((value, index) => {
    const dice = document.createElement("div");
    dice.textContent = value;
    dice.className = "dice";

    if (selectedDice.has(index)) {
      dice.classList.add("selected");
    }

    dice.onclick = () => {
      toggleDiceSelection(index);
      updateDiceDisplay();
    };

    diceDiv.appendChild(dice);
  });
}

function toggleDiceSelection(index) {
  if (selectedDice.has(index)) {
    selectedDice.delete(index);
  } else {
    selectedDice.add(index);
  }
  updateDiceDisplay();
}

function rerollDice() {
  if (selectedDice.size === 0) return;
  socket.emit("rerollDice", { room, selected: Array.from(selectedDice) });
  selectedDice.clear();

  document.getElementById("reroll-btn").disabled = true;
}

function endTurn() {
  socket.emit("endTurn", { room });
  document.getElementById("reroll-btn").disabled = true;
  document.getElementById("end-turn-btn").disabled = true;
}

socket.on("gameResult", (result) => {
  document.getElementById("game-result").innerText = result;
});
