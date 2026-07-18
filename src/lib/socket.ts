import { io } from "socket.io-client";

// ✅ Always use HTTPS / WSS on Render
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// Note: This static instance might not have the playerId query param if it relies on client-side storage
export const socket = io(API_BASE_URL, {
  transports: ["websocket"], // ensure it connects via WebSocket directly
});

