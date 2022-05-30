const SocketIO = require("socket.io");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const cookie = require("cookie-signature");

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: "/socket.io" });

  app.set("io", io);
  const room = io.of("/room");
  const chat = io.of("/chat");

  // socket.request 객체 안에 socket.request.session 객체가 생성된다
  io.use((socket, next) => {
    cookieParser(process.env.COOKIE_SECRET)(
      socket.request,
      socket.request.res,
      next
    );
    sessionMiddleware(socket.request, socket.request.res, next);
  });

  room.on("connection", (socket) => {
    console.log("room 네임스페이스에 접속");
    socket.on("disconnect", () => {
      console.log("room 네임스페이스 접속 해제");
    });
  });

  chat.on("connection", (socket) => {
    console.log("chat 네임스페이스에 접속");
    let roomId;

    socket.on("join", (data) => {
      roomId = data;
      socket.join(data);
      socket.to(data).emit("join", {
        user: "system",
        chat: `${socket.request.session.color}님이 입장하셨습니다.`,
      });
    });

    socket.on("disconnect", async () => {
      console.log("chat 네임스페이스 접속 해제");

      const currentRoom = io.of("/chat").adapter.rooms[roomId];
      const userCount = currentRoom?.size || 0;

      if (userCount === 0) {
        const signedCookie = socket.request.signedCookies["connect.sid"];
        const connectSID = cookie.sign(
          `${signedCookie}`,
          process.env.COOKIE_SECRET
        );
        await axios
          .delete(`http://localhost:8005/room/${roomId}`, {
            headers: {
              Cookie: `connect.sid=s%3A${connectSID}}`,
            },
          })
          .then(() => {
            console.log("방 제거 요청 성공");
          })
          .catch((error) => {
            console.error(error);
          });
      } else {
        socket.to(roomId).emit("exit", {
          user: "system",
          chat: `${req.session.color}님이 퇴장하셨습니다.`,
        });
      }
    });
  });
};
