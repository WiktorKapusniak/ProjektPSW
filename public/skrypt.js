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

const socket = io();

// ✅ Dołączenie do chatu
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

// Wysyłanie wiadomości
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
// Odbieranie wiadomości
socket.on("message", (data) => {
  const messagesDiv = document.getElementById("messages");
  const msgDiv = document.createElement("div");
  msgDiv.textContent = `${data.username}: ${data.message}`;
  messagesDiv.appendChild(msgDiv);
});

// Pobieranie historii wiadomości
socket.on("chatHistory", (history) => {
  const messagesDiv = document.getElementById("messages");
  messagesDiv.innerHTML = "";
  history.forEach((msg) => {
    const msgDiv = document.createElement("div");
    msgDiv.textContent = `${msg.username}: ${msg.message}`;
    messagesDiv.appendChild(msgDiv);
  });
});
