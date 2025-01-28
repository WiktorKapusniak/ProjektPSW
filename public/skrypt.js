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

// Po załadowaniu strony dołącz do chatu
window.addEventListener("load", async () => {
  try {
    const response = await axios.get("/users/auth", { withCredentials: true });
    if (response.data.message === "Zalogowany") {
      socket.emit("joinChat", response.data.username);
    }
  } catch (error) {
    console.error("Nie można dołączyć do chatu:", error);
  }
});

// Obsługa wysyłania wiadomości
document.getElementById("chat-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const msgInput = document.getElementById("msg");
  const message = msgInput.value.trim();

  if (message !== "") {
    socket.emit("chatMessage", message);
    msgInput.value = "";
  }
});

// Odbieranie wiadomości i dodawanie do listy
socket.on("message", (message) => {
  const chatBox = document.getElementById("messages");
  const msgElement = document.createElement("li");
  msgElement.textContent = message;
  chatBox.appendChild(msgElement);
  chatBox.scrollTop = chatBox.scrollHeight;
});
