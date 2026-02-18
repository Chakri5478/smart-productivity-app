const express = require("express");
const session = require("express-session");
const bodyParser = require("body-parser");
const { admin, db } = require("./firebase");

const app = express();

/* ===============================
   BASIC SETUP
=================================*/

app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(bodyParser.urlencoded({ extended: true }));

app.use(
  session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false,
  })
);

/* ===============================
   AUTH MIDDLEWARE
=================================*/

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

/* ===============================
   SIGNUP ROUTES
=================================*/

app.get("/signup", (req, res) => {
  res.render("signup");
});

app.post("/signup", async (req, res) => {
  const { email, password } = req.body;

  try {
    await admin.auth().createUser({
      email,
      password,
    });

    res.redirect("/login");
  } catch (error) {
    res.send(error.message);
  }
});

/* ===============================
   LOGIN ROUTES
=================================*/

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email } = req.body;

  try {
    const user = await admin.auth().getUserByEmail(email);

    req.session.user = {
      uid: user.uid,
      email: user.email,
    };

    res.redirect("/dashboard");
  } catch (error) {
    res.send("Invalid credentials");
  }
});

/* ===============================
   DASHBOARD
=================================*/

app.get("/dashboard", isAuthenticated, async (req, res) => {
  try {
    const snapshot = await db
      .collection("tasks")
      .where("userId", "==", req.session.user.uid)
      .orderBy("createdAt", "desc")
      .get();

    const tasks = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.render("dashboard", {
      tasks,
      user: req.session.user,
    });
  } catch (error) {
    res.send(error.message);
  }
});

/* ===============================
   ADD TASK
=================================*/

app.post("/add-task", isAuthenticated, async (req, res) => {
  try {
    const { title, description, category, priority, dueDate } = req.body;

    const taskData = {
      userId: req.session.user.uid,
      title: title || "",
      description: description || "",
      category: category || "General",
      priority: priority || "Medium",
      dueDate: dueDate || null,
      status: "Pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await db.collection("tasks").add(taskData);

    res.redirect("/dashboard");
  } catch (error) {
    res.send(error.message);
  }
});

/* ===============================
   DELETE TASK
=================================*/

app.post("/delete/:id", isAuthenticated, async (req, res) => {
  try {
    await db.collection("tasks").doc(req.params.id).delete();
    res.redirect("/dashboard");
  } catch (error) {
    res.send(error.message);
  }
});

/* ===============================
   LOGOUT
=================================*/

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

/* ===============================
   SERVER
=================================*/

app.listen(3000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});
