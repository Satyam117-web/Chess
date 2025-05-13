const express = require("express");
const socket = require("socket.io");
const { Chess } = require("chess.js");
const http = require("http");
const path = require("path");

const port = process.env.PORT || 8080;

const app = express();
const server = http.createServer(app);
const io = socket(server);

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

const chess = new Chess();
let players = {
  white: null,
  black: null
};

io.on("connection", function (uniquesocket) {
  console.log("User connected:", uniquesocket.id);

  // Assign roles
  if (!players.white) {
    players.white = uniquesocket.id;
    uniquesocket.emit("playerRole", "w");
    io.emit("boardState", chess.fen());
  } else if (!players.black) {
    players.black = uniquesocket.id;
    uniquesocket.emit("playerRole", "b");
    io.emit("boardState", chess.fen());
  } else {
    uniquesocket.emit("spectatorRole");
    uniquesocket.emit("spectatingMessage", "You are spectating a live game.");
    uniquesocket.emit("boardState", chess.fen());
  }

  // Move handler
  uniquesocket.on("move", (move) => {
    if (
      (chess.turn() === "w" && uniquesocket.id !== players.white) ||
      (chess.turn() === "b" && uniquesocket.id !== players.black)
    ) return;

    const result = chess.move(move);
    if (result) {
      io.emit("move", move);
      io.emit("boardState", chess.fen());
    } else {
      uniquesocket.emit("invalid move", move);
    }
  });

  // Disconnect handler
  uniquesocket.on("disconnect", () => {
    let shouldReset = false;

    if (uniquesocket.id === players.white) {
      players.white = null;
      shouldReset = true;
    } else if (uniquesocket.id === players.black) {
      players.black = null;
      shouldReset = true;
    }

    if (shouldReset) {
      chess.reset();
      io.emit("gameReset", "A player left. Starting a new game.");
      io.emit("boardState", chess.fen());
    }
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(3000, function () {
  console.log("Server listening at port 3000");
});