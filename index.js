require("dotenv").config();
const express = require("express");
const http = require("http");
require("dotenv").config();
const port = process.env.PORT;
const DBURL = process.env.DBURL;
const app = express();
const mongodb = require("mongodb").MongoClient;
var ObjectId = require("mongodb").ObjectId;
const cors = require("cors");
const bcrypt = require("bcrypt");
app.use(cors({}));
app.use(express.json());
const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});
// To allow in server https://eager-jang-15b24f.netlify.app
// To allow in Local "http://localhost:3000/
mongodb
  .connect(DBURL)
  .then(() => {
    console.log("Connected to Database");
  })
  .catch((err) => {
    console.log("Not Connected to Database ERROR ");
  });

var users = {};

io.on("connection", function (socket) {
  socket.emit("me", socket.id);

  socket.on("disconnect", () => {
    socket.broadcast.emit("callEnded");
  });

  socket.on("callUser", (data) => {
    io.to(data.userToCall).emit("callUser", {
      signal: data.signalData,
      from: data.from,
      name: data.name,
    });
  });

  socket.on("callSearchUser", async (data) => {
    const client = await mongodb.connect(DBURL);
    const db = client.db("VideoCall");
    const receiver = await db
      .collection("users")
      .findOne({ _id: ObjectId(data.userToCall) });

    if (receiver != null) {
      const sender = await db
        .collection("users")
        .findOne({ _id: ObjectId(data.myCall) });
      if (sender != null) {
        var message = "Working";
        io.to(users[receiver._id]).emit("callSearchUser", {
          signal: data.signalData,
          from: data.from,
          name: data.name,
          message: message,
        });
      }
    }
  });

  socket.on("answerCall", (data) => {
    // console.log(data)
    io.to(data.to).emit("callAccepted", data.signal);
  });

  socket.on("currentUser", function (userId) {
    users[userId] = socket.id;
  });

  // socket.on("sendEvent") goes here
  socket.on("sendEvent", async function (data) {
    const client = await mongodb.connect(DBURL);
    const db = client.db("VideoCall");
    const receiver = await db
      .collection("users")
      .findOne({ _id: ObjectId(data.userId) });

    if (receiver != null) {
      const sender = await db
        .collection("users")
        .findOne({ _id: ObjectId(data.myId) });
      if (sender != null) {
        var message =
          "New message received from: " +
          sender.firstName +
          ". Message: " +
          data.message;
        io.to(users[receiver._id]).emit("messageReceived", message);
      }
    }
  });
});

// To Register a User

app.post("/register", async (req, res) => {
  var user = req.body;
  var hash = await bcrypt.hash(user.password, 10);
  user.password = hash;
  try {
    const client = await mongodb.connect(DBURL);
    const db = client.db("VideoCall");
    const data = await db.collection("users").insertOne(user);
    await client.close();
    res.json({ message: "registration successful", data: data });
  } catch (err) {
    console.log(err);
    res.json({ message: "failed" });
  }
});

// TO Login the Registed User and Get The Registered Time

app.post("/login", async (req, res) => {
  try {
    const client = await mongodb.connect(DBURL);
    const db = client.db("VideoCall");
    const data = await db
      .collection("users")
      .findOne({ email: req.body.email });
    if (data) {
      var match = await bcrypt.compare(req.body.password, data.password);
      if (match) {
        const timelog={
          time:new Date().toLocaleString(),
          firstName:data.firstName,
          email:data.email
        }
        await db.collection("timeLogs").insertOne(timelog);
         await client.close();
        res.json({ message: "login successful", data: data });
      } else {
        res.status(401).json({
          message: "password did not match",
        });
      }
    } else {
      res.status(400).json({
        message: "Email not found",
      });
    }
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "failed" });
  }
});

// To get the Registerd Users

app.get("/registers", async (req, res) => {
  try {
    const client = await mongodb.connect(DBURL);
    const db = client.db("VideoCall");
    const data = await db.collection("users").find().toArray();
    res.json(data);
  } catch (err) {
    res.json({ message: "failed", err });
  }
});

// To get the Time Logs of Logged in  Users

app.get("/timelogs", async (req, res) => {
  try {
    const client = await mongodb.connect(DBURL);
    const db = client.db("VideoCall");
    const data = await db.collection("timeLogs").find().toArray();
    await client.close();
    res.json(data);
  } catch (err) {
    res.json({ message: "failed", err });
  }
});

server.listen(port, () => console.log("server is running on port " + port));
