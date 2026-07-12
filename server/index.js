require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");

const { router: groupsRouter, ensureDefaultGroup } = require("./routes/groups");
const { router: storiesRouter } = require("./routes/stories");
const { router: adminRouter } = require("./routes/admin");
const { router: usersRouter } = require("./routes/users");
const { router: aiRouter } = require("./routes/ai");
const { router: friendsRouter } = require("./routes/friends");
const { router: rootRouter } = require("./routes/root");
const { registerChatSocket } = require("./socket/chatSocket");

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "*";

app.use(cors({ origin: CLIENT_ORIGIN }));
app.use(express.json({ limit: "2mb" }));

app.get("/", (req, res) => res.json({ status: "ChatApp API running" }));
app.use("/api/groups", groupsRouter);
app.use("/api/stories", storiesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/users", usersRouter);
app.use("/api/ai", aiRouter);
app.use("/api/friends", friendsRouter);
app.use("/api/root", rootRouter);

const io = new Server(server, { cors: { origin: CLIENT_ORIGIN } });
registerChatSocket(io);

const PORT = process.env.PORT || 5000;

ensureDefaultGroup()
  .catch((err) => console.error("Failed to ensure default group:", err.message))
  .finally(() => {
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  });
