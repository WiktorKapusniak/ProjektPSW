async function register() {
  const username = document.getElementById("register-username").value;
  const password = document.getElementById("register-password").value;

  try {
    const response = await axios.post("/users", { username, password });
    document.getElementById("register-message").innerText = response.data.message;
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
    if (response.data.message === "Logowanie udane!") {
      localStorage.setItem("username", username);
      document.getElementById("login-container").style.display = "none";
      document.getElementById("main-container").style.display = "block";
    }
  } catch (error) {
    document.getElementById("login-message").innerText = error.response.data.message;
  }
}
// async function search() {
//   const username = document.getElementById("user-search").value
//   try{
//     const response = await axiost.post("/users/search", {username})

//   }
// }

async function remove() {
  const username = localStorage.getItem("username")
  try {
    const response = await axios.delete(`users/${username}`)
    localStorage.removeItem("username")
  }
}
