import { Server } from "socket.io";
import jwt from "jsonwebtoken";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: [
        "https://goaboat.com",
        "http://goaboat.com",
        "http://localhost:5173",
      ],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, type, company }
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const { id, company, type } = socket.user;

    socket.join(id);        // personal
    socket.join(company);   // company
    socket.join(type);      // admin / backdesk / onsite

    console.log("🔌 Socket connected:", id, type);

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected:", id);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized");
  return io;
};
