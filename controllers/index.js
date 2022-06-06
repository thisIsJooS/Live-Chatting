const Room = require("../schemas/room");
const Chat = require("../schemas/chat");

exports.renderMain = async (req, res, next) => {
  try {
    const rooms = await Room.find({});
    res.render("main", { rooms, title: "GIF 채팅방" });
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.renderRoom = (req, res, next) => {
  res.render("room", { title: "GIF 채팅방 생성" });
};

exports.createRoom = async (req, res, next) => {
  try {
    const newRoom = await Room.create({
      title: req.body.title,
      max: req.body.max,
      owner: req.session.color,
      password: req.body.password,
    });
    const io = req.app.get("io");
    io.of("/room").emit("newRoom", newRoom);
    res.redirect(`/room/${newRoom._id}?password=${req.body.password}`);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.enterRoom = async (req, res, next) => {
  try {
    const room = await Room.findOne({ _id: req.params.id });
    if (!room) {
      return res.redirect("/?error=존재하지 않는 방입니다.");
    }
    if (room.password && room.password !== req.query.password) {
      return res.redirect("/?error=비밀번호가 틀렸습니다.");
    }
    const io = req.app.get("io");
    const { rooms } = io.of("/chat").adapter;
    if (room.max <= rooms.get(req.params.id)?.size) {
      return res.redirect("/?error=허용 인원이 초과하였습니다.");
    }

    const chats = await Chat.find({ room: room._id }).sort("createdAt");
    return res.render("chat", {
      room,
      title: room.title,
      chats,
      user: req.session.color,
    });
  } catch (error) {
    console.error(error);
    return next(error);
  }
};

exports.removeRoom = async (req, res, next) => {
  try {
    await Room.remove({ _id: req.params.id });
    await Chat.remove({ room: req.params.id });
    res.send("ok");
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.sendChat = async (req, res, next) => {
  try {
    await Chat.create({
      room: req.params.id,
      user: req.session.color,
      chat: req.body.chat,
    });
    req.app.get("io").of("/chat").to(req.params.id).emit("chat", {
      socketID: req.body.sid,
      room: req.params.id,
      user: req.session.color,
      chat: req.body.chat,
    });
    res.send("ok");
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.sendSys = async (req, res, next) => {
  try {
    const msg =
      req.body.type === "join"
        ? `${req.session.color}님이 입장하셨습니다.`
        : `${req.session.color}님이 퇴장하셨습니다.`;

    await Chat.create({
      room: req.params.id,
      user: "system",
      chat: msg,
    });

    req.app.get("io").of("/chat").to(req.params.id).emit(req.body.type, {
      user: "system",
      chat: msg,
      participantsCount: req.body.participantsCount,
    });
    res.send("ok");
  } catch (error) {
    console.error(error);
    next(error);
  }
};

exports.sendGif = async (req, res, next) => {
  try {
    await Chat.create({
      room: req.params.id,
      user: req.session.color,
      gif: req.file.filename,
    });
    req.app.get("io").of("/chat").to(req.params.id).emit("chat", {
      socketID: req.body.sid,
      room: req.params.id,
      user: req.session.color,
      gif: req.file.filename,
    });
  } catch (error) {
    console.error(error);
    next(error);
  }
};
