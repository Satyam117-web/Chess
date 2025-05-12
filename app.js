const express = require("express");
const socket = require("socket.io");
const { Chess } = require("chess.js");
const http = require("http");
const path = require("path");
const port=process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);

const io = socket(server);
const chess = new Chess();
let players = {};
let currentPlayer = "w";

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

io.on("connection", function (uniquesocket) {
  console.log("connected");

  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
  } else {
    uniquesocket.emit("spectatorRole");
    uniquesocket.emit("spectatingMessage", "You are spectating a live game.");
  }

uniquesocket.on("disconnect", function () {
  let shouldReset = false;

  if (uniquesocket.id === players.white) {
    delete players.white;
    shouldReset = true;
  } else if (uniquesocket.id === players.black) {
    delete players.black;
    shouldReset = true;
  }

  if (shouldReset) {
    chess.reset();
    currentPlayer = "w";
    io.emit("gameReset", "A player left. Starting a new game.");
    io.emit("boardState", chess.fen());
  }
});


  uniquesocket.on("move", (move) => {
    try {
      if (chess.turn() == "w" && uniquesocket.id != players.white) return;
      if (chess.turn() == "b" && uniquesocket.id != players.black) return;

      const result = chess.move(move);
      if (result) {
        currentPlayer = chess.turn();
        io.emit("move", move);
        io.emit("boardState", chess.fen());
      } else {
        console.log("Invalid move :", move);
        uniquesocket.emit("invalid move", move);
      }
    } catch (err) {
      console.log(err);
      uniquesocket.emit("InvalidMove", move);
    }
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(3000, function () {
  console.log("Server listining at port 3000");
});
