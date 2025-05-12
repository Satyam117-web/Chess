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

let gameRooms = [];

io.on("connection", function (uniquesocket) {
  console.log("User connected:", uniquesocket.id);
  let assigned = false;

  for (let room of gameRooms) {
    const playerCount = [room.white, room.black].filter(Boolean).length;
    if (playerCount < 2) {
      if (!room.white) {
        room.white = uniquesocket.id;
        uniquesocket.emit("playerRole", "w");
      } else {
        room.black = uniquesocket.id;
        uniquesocket.emit("playerRole", "b");
      }
      uniquesocket.join(room.id);
      uniquesocket.roomId = room.id;
      uniquesocket.chess = room.chess;
      io.to(room.id).emit("boardState", room.chess.fen());
      assigned = true;
      break;
    }
  }

  if (!assigned) {
    const newRoom = {
      id: `room-${gameRooms.length + 1}`,
      white: uniquesocket.id,
      black: null,
      chess: new Chess()
    };
    gameRooms.push(newRoom);
    uniquesocket.join(newRoom.id);
    uniquesocket.roomId = newRoom.id;
    uniquesocket.chess = newRoom.chess;
    uniquesocket.emit("playerRole", "w");
  }

  const currentRoom = gameRooms.find(r => r.id === uniquesocket.roomId);
  const clientsInRoom = io.sockets.adapter.rooms.get(currentRoom.id)?.size || 0;

  if (clientsInRoom > 2 && uniquesocket.id !== currentRoom.white && uniquesocket.id !== currentRoom.black) {
    uniquesocket.emit("spectatorRole");
    uniquesocket.emit("spectatingMessage", "You are spectating a live game.");
  }

  uniquesocket.on("move", (move) => {
    const room = gameRooms.find(r => r.id === uniquesocket.roomId);
    if (!room) return;

    if (room.chess.turn() === "w" && uniquesocket.id !== room.white) return;
    if (room.chess.turn() === "b" && uniquesocket.id !== room.black) return;

    const result = room.chess.move(move);
    if (result) {
      io.to(room.id).emit("move", move);
      io.to(room.id).emit("boardState", room.chess.fen());
    } else {
      uniquesocket.emit("invalid move", move);
    }
  });

  uniquesocket.on("disconnect", () => {
    const room = gameRooms.find(r => r.id === uniquesocket.roomId);
    if (!room) return;

    if (uniquesocket.id === room.white) room.white = null;
    if (uniquesocket.id === room.black) room.black = null;

    if (!room.white && !room.black) {
      gameRooms = gameRooms.filter(r => r.id !== room.id);
    } else {
      room.chess.reset();
      io.to(room.id).emit("gameReset", "A player left. Starting a new game.");
      io.to(room.id).emit("boardState", room.chess.fen());
    }
  });
});

app.get("/", (req, res) => {
  res.render("index");
});

server.listen(3000, function () {
  console.log("Server listening at port 3000");
});
