const { auth } = require("../firebaseAdmin");

// Wires up Socket.io: clients join a room per group/chat id, and messages
// broadcast instantly to everyone in that room. Firestore stays the source
// of truth (via the REST routes) — sockets are just for live delivery.
function registerChatSocket(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No auth token"));
      const decoded = await auth.verifyIdToken(token);
      socket.userId = decoded.uid;
      next();
    } catch (err) {
      next(new Error("Auth failed"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.userId}`);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
    });

    socket.on("leave-room", (roomId) => {
      socket.leave(roomId);
    });

    // payload: { roomId, message: { id, senderId, text, createdAt } }
    // The REST endpoint (/api/groups/:id/messages) writes to Firestore;
    // the client also emits this right after a successful POST so everyone
    // in the room sees it instantly without waiting on a Firestore listener.
    socket.on("send-message", (payload) => {
      socket.to(payload.roomId).emit("new-message", payload.message);
    });

    socket.on("typing", ({ roomId, userId, isTyping }) => {
      socket.to(roomId).emit("user-typing", { userId, isTyping });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.userId}`);
    });
  });
}

module.exports = { registerChatSocket };
