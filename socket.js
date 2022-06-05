const { default: axios } = require("axios");
const SocketIO = require("socket.io");
const { removeRoom } = require("./services");
const cookie = require("cookie-signature");
const cookieParser = require("cookie-parser");

module.exports = (server, app, sessionMiddleware) => {
  const io = SocketIO(server, { path: "/socket.io" });
  app.set("io", io);

  const room = io.of("/room");
  const chat = io.of("/chat");

  // socket.request 객체 안에 socket.request.session 객체 생성
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

  chat.on("connection", function (socket) {
    console.log("chat 네임스페이스에 접속");
    let roomId;

    const signedCookie = getCookie(
      socket.request.headers.cookie,
      "connect.sid"
    );

    // 브라우저에서 axios 요청을 보낼 떄는 자동으로 쿠키를 같이 넣어서 보내지만, 서버에서 axios 요청을 보낼 때는 쿠키가 같이 보내지지 않는다.
    // 따라서 express-session이 요청자가 누구인지 판단할 수 없다.
    // express-session이 판단할 수 있게 하려면 내가 요청 헤더에 세션 쿠키를 직접 넣어야 한다.
    const headers = {
      headers: {
        Cookie: `connect.sid=${signedCookie}`,
      },
    };

    socket.on("join", (data) => {
      socket.join(data);
      this.roomId = data;

      axios.post(
        `http://127.0.0.1/room/${this.roomId}/sys`,
        {
          type: "join",
          participantsCount: chat.adapter.rooms.get(this.roomId).size,
        },
        headers
      );

      room.emit("participate", {
        roomId: this.roomId,
        participantsCount: chat.adapter.rooms.get(this.roomId).size,
      });
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
        axios.post(
          `http://127.0.0.1/room/${this.roomId}/sys`,
          {
            type: "exit",
            participantsCount: chat.adapter.rooms.get(this.roomId).size,
          },
          headers
        );

        room.emit("exit", {
          roomId: this.roomId,
          participantsCount: chat.adapter.rooms.get(this.roomId).size,
        });
      }

      socket.leave(roomId);
    });
  });
};

const getCookie = (ck, name) => {
  return ck.split("; ").reduce((r, v) => {
    const parts = v.split("=");
    return parts[0] === name ? parts[1] : r;
  }, "");
};
