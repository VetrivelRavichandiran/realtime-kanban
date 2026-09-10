import { io, type Socket } from "socket.io-client";
import type { SocketEvents } from "@rk/shared";
import { getToken } from "./storage";

// Server -> client events
type ServerToClient = Pick<
  SocketEvents,
  "board:state" | "board:patch" | "presence:update" | "notification:new" | "error"
>;
// Client -> server events (everything the client may emit)
type ClientToServer = Omit<SocketEvents, keyof ServerToClient>;

export function createSocket(): Socket<ServerToClient, ClientToServer> {
  const url = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";
  const token = getToken();
  return io(url, { auth: { token }, transports: ["websocket", "polling"] });
}