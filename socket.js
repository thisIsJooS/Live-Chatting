const SocketIO = require("socket.io");
const { removeRoom } = require("./services");

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: "/socket.io" });
  app.set("io", io);

  const room = io.of("/room");
  const chat = io.of("/chat");
  const wrap = (middleware) => (socket, next) =>
    middleware(socket.request, {}, next);
  chat.use(wrap(sessionMiddleware));

  room.on("connection", (socket) => {
    console.log("room 네임스페이스에 접속");
    socket.on("disconnect", () => {
      console.log("room 네임스페이스 접속 해제");
    });
  });

  chat.on("connection", function (socket) {
    console.log("chat 네임스페이스에 접속");
    let roomId;

    socket.on("join", (data) => {
      socket.join(data);
      chat.to(data).emit("join", {
        user: "system",
        chat: `${socket.request.session.color}님이 입장하셨습니다.`,
      });
      this.roomId = data;
    });

    socket.on("disconnect", async () => {
      console.log("chat 네임스페이스 접속 해제");
      const { rooms } = chat.adapter;
      const currentRoom = rooms.get(this.roomId);
      const userCount = currentRoom?.size || 0;
      if (userCount === 0) {
        await removeRoom(this.roomId);
        room.emit("removeRoom", this.roomId);
        console.log("방 제거 요청 성공");
      } else {
        chat.to(this.roomId).emit("exit", {
          user: "system",
          chat: `${socket.request.session.color}님이 퇴장하셨습니다.`,
        });
      }
      socket.leave(roomId);
    });
  });
};
