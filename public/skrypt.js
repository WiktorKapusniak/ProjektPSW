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
