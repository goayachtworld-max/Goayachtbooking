import { io } from "socket.io-client";
const BASE_URL = import.meta.env.VITE_SOCKET_URL;

export const socket = io(BASE_URL, {
  auth: {
    token: localStorage.getItem("token"),
  },
  autoConnect: false, // important
});
