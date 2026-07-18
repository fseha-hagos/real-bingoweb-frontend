"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { io, Socket } from "socket.io-client";
import { GameSession, Player } from "../types/game";
import { PLAYER_GAME_DATA } from "../constants/configurations";

interface SocketContextType {
  socket: Socket | null;
  connected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError?: string;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  connected: false,
  connectionStatus: 'disconnected',
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [lastError, setLastError] = useState<string | undefined>();

  useEffect(() => {
    // Prefer explicit env; fall back to same host as the page API in local/dev
    const envUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
    const isBrowserLocal =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1");

    // If someone left a production wss URL while browsing localhost, force local backend
    const looksRemote =
      !!envUrl &&
      (envUrl.includes("onrender.com") || envUrl.startsWith("wss://"));

    const serverUrl =
      isBrowserLocal && (!envUrl || looksRemote)
        ? "http://localhost:3001"
        : envUrl || "http://localhost:3001";

    console.log("🔌 Socket connecting to:", serverUrl);
    setConnectionStatus('connecting');

    // Attempt to get stored player ID for identifying the socket connection
    const query: Record<string, unknown> = {};
    try {
      const stored = sessionStorage.getItem(PLAYER_GAME_DATA);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.playerId) {
          query.playerId = parsed.playerId;
        } else if (parsed.userId) {
          query.playerId = parsed.userId;
        } else if (parsed.telegramId) {
          query.playerId = parsed.telegramId;
        }
      }
    } catch (e) {
      console.error("Failed to parse stored game data for socket init", e);
    }

    // Create socket with automatic reconnection options
    const socketInstance = io(serverUrl, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      transports: ['websocket', 'polling'],
      withCredentials: true,
      query: query,
    });

    setSocket(socketInstance);

    // Connection event handlers
    socketInstance.on("connect", () => {
      console.log("🟢 Socket connected:", socketInstance.id);
      setConnected(true);
      setConnectionStatus('connected');
      setLastError(undefined);
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("🔴 Socket disconnected:", reason);
      setConnected(false);
      setConnectionStatus('disconnected');
    });

    socketInstance.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      setConnected(false);
      setConnectionStatus('error');
      setLastError(error.message);
    });

    socketInstance.on("reconnect", (attemptNumber) => {
      console.log("🔄 Socket reconnected after", attemptNumber, "attempts");
      setConnected(true);
      setConnectionStatus('connected');
      setLastError(undefined);
    });

    socketInstance.on("reconnect_attempt", (attemptNumber) => {
      console.log("🔄 Socket reconnection attempt", attemptNumber);
      setConnectionStatus('connecting');
    });

    socketInstance.on("reconnect_error", (error) => {
      console.error("❌ Socket reconnection error:", error);
      setConnectionStatus('error');
      setLastError(error.message);
    });

    socketInstance.on("reconnect_failed", () => {
      console.error("💀 Socket reconnection failed - giving up");
      setConnectionStatus('error');
      setLastError("Failed to reconnect to server");
    });

    // Game-specific event handlers for debugging
    socketInstance.on("gamesUpdate", (games: Record<number, GameSession>) => {
      console.log("📡 Games update received:", Object.keys(games).length, "games");
    });

    socketInstance.on("gameUpdate", (game: GameSession) => {
      console.log("🎮 Game update received for game:", game.id, "status:", game.status);
    });


    socketInstance.on("countdownStart", (secondsLeft: number) => {
      console.log(`Countdown started (${secondsLeft}s)!`);
    });

    socketInstance.on("countdownUpdate", (secondsLeft: number) => {
      console.log(`Countdown started (${secondsLeft}s)!`);
    });

    socketInstance.on("numberCalled", (data: { gameId: string; number: number; calledNumbers: number[] }) => {
      console.log("🔢 Number called:", data.number, "in game:", data.gameId);
    });

    socketInstance.on("gameStarted", (data: { gameId: string; game: GameSession }) => {
      console.log("🚀 Game started:", data.gameId);
    });

    socketInstance.on("gameFinished", (data: { gameId: string; winner?: Player; game: GameSession }) => {
      console.log("🏁 Game finished:", data.gameId, "winner:", data.winner?.name);
    });

    socketInstance.on("playerJoined", (data: { gameId: string; player: Player; game: GameSession }) => {
      console.log("👤 Player joined:", data.player.name, "in game:", data.gameId);
    });

    socketInstance.on("playerLeft", (data: { gameId: string; playerId: string; game: GameSession }) => {
      console.log("👋 Player left:", data.playerId, "from game:", data.gameId);
    });

    return () => {
      console.log("🧹 Cleaning up socket connection");
      socketInstance.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, connected, connectionStatus, lastError }}>
      {children}
    </SocketContext.Provider>
  );
};
