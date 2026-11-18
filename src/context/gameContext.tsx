"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from "react";
import { useSocket } from "./SocketContext";
import { GameSession, Player, GameJoinRequest, UserSafeType, Cartela, BingoWinEventPayload, BingoWinPattern } from "../types/game";
import { ApiClient, apiClient } from "../lib/api";
import { useRouter } from "next/navigation";
// import toast from "react-hot-toast";
import { toast } from "react-toastify";
import { am } from "../constants/amharic";
import { useAuth } from "./AuthContext";

import { PLAYER_GAME_DATA, SELECTED_GAME_DATA } from "../constants/configurations";

import { useAmharicBingoVoice } from "../lib/useAmharicBIngoVoice";
import { gamesToRecord } from "../lib/games";
import cartelas from "../data/cartelas.json";

const getLetter = (num: number) => {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  return 'O';
};

const normalizeCardNumbers = (
  card?: Cartela | number[][] | { numbers?: number[][] } | null
): number[][] => {
  if (!card) return [];
  if (Array.isArray(card)) return card;
  if (Array.isArray((card as Cartela).numbers)) return (card as Cartela).numbers;
  if (Array.isArray((card as { numbers?: number[][] }).numbers)) {
    return (card as { numbers: number[][] }).numbers;
  }
  return [];
};

export type BingoResultDataType = {
  cartela: {
    id: number;               // cardNumber from backend
    numbers: number[][];      // 5x5 bingo grid
  };
  calledNumbers: number[];
  won: boolean;
  pattern: BingoWinPattern | null;
  bet: number | null;
  winnerName: string | null;
  winnerUsername: string | null;
} | null;

interface GameContextType {
  games: Record<number, GameSession>;
  currentGame: GameSession | null;
  gameLoading: boolean;
  userLoading: boolean;
  error: string | null;
  user: UserSafeType | null;
  setCurrentGame: (game: GameSession | null) => void;

  resultOverlayOpen: boolean;
  bingoResultData: BingoResultDataType;
  setResultOverlayOpen: (open: boolean) => void;
  setBingoResultData: (data: BingoResultDataType) => void;
  // Actions
  refreshGames: () => void;
  joinGame: (bet: number, joinData: Omit<GameJoinRequest, 'bet'>) => Promise<{ success: boolean; error?: string; gameId?: string; card?: Cartela; cards?: Cartela[] }>;
  removeCard: (bet: number, data: { gameId: string; playerId: string; cardNumber: number; userId?: string; telegramId?: string }) => Promise<{ success: boolean; error?: string }>;
  watchGame: (bet: number) => void;
  leaveGame: () => void;
  // markNumber: (gameId: string, number: number,bet :number, playerId: string) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { socket, connected } = useSocket();
  const { user, status: authStatus, setUser } = useAuth();
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [games, setGames] = useState<Record<number, GameSession>>({});
  const [currentGame, setCurrentGame] = useState<GameSession | null>(null);
  const [gameLoading, setGameLoading] = useState(false);
  const userLoading = authStatus === "loading";
  const { speak } = useAmharicBingoVoice();

  const [resultOverlayOpen, setResultOverlayOpen] = useState(false);
  const [bingoResultData, setBingoResultData] = useState<{
    cartela: {
      id: number;               // cardNumber from backend
      numbers: number[][];      // 5x5 bingo grid
    };
    calledNumbers: number[];
    won: boolean;
    pattern: BingoWinPattern | null;
    bet: number | null;
    winnerName: string | null;
    winnerUsername: string | null;
  } | null>(null);

  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const api = new ApiClient();


  // User comes from AuthProvider (phone OTP session) — no Telegram verify
  useEffect(() => {
    // no-op: auth handled by AuthProvider
  }, []);

  //✅ initial games state
  useEffect(() => {
    const init = async () => {
      // 1️⃣ Fetch initial snapshot
      const res = await api.getGames();
      if (res.success && res.data) {
        setGames(gamesToRecord(res.data));
      }
    }
    init();
  }, []);


  //✅ Refresh games from server
  const refreshGames = useCallback(async () => {
    if (!connected || !socket) return;

    try {
      setGameLoading(true);
      setError(null);

      // Try socket first, fallback to REST API
      socket.emit("getGames");

      // Also try REST API as backup
      const apiResult = await apiClient.getGames();
      if (apiResult.success && apiResult.data) {
        setGames(gamesToRecord(apiResult.data));
      }
    } catch (err) {
      console.error("Failed to refresh games:", err);
      setError(am.failedToLoadGames);
    } finally {
      setGameLoading(false);
    }
  }, [socket, connected]);



  const joinGame = useCallback(
    async (
      bet: number,
      joinData: Omit<GameJoinRequest, "bet">
    ): Promise<{ success: boolean; error?: string; gameId?: string; card?: Cartela; cards?: Cartela[] }> => {
      if (!connected || !socket) {
        return { success: false, error: am.notConnectedServer };
      }

      return new Promise<{ success: boolean; error?: string; gameId?: string; card?: Cartela; cards?: Cartela[] }>((resolve) => {
        let timeoutId: NodeJS.Timeout | null = null;

        // --- Event listeners ---
        const handleQueued = () => {
          // Silent - only rejections shown
        };

        const handleJoined = (data: {
          gameId?: string;
          card?: Cartela;
          cards?: Cartela[];
          cardNumber?: number;
          cardNumbers?: number[];
        }) => {
          cleanup();
          resolve({ success: true, gameId: data.gameId, card: data.card, cards: data.cards });
        };

        const handleError = ({ message }: { message: string }) => {
          toast.error(am.joinError(message));
          cleanup();
          resolve({ success: false, error: message });
        };

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          socket.off("joinQueued", handleQueued);
          socket.off("joinedGame", handleJoined);
          socket.off("joinError", handleError);
        };

        // Listen for server events
        socket.on("joinQueued", handleQueued);
        socket.on("joinedGame", handleJoined);
        socket.on("joinError", handleError);

        // Send the join request
        socket.emit("joinGame", { bet, ...joinData });

        // Fallback timeout (e.g., 15 seconds)
        timeoutId = setTimeout(() => {
          cleanup();
          resolve({ success: false, error: am.joinTimedOut });
        }, 15000);
      });
    },
    [socket, connected, games]
  );

  const removeCard = useCallback(
    async (
      bet: number,
      data: { gameId: string; playerId: string; cardNumber: number; userId?: string; telegramId?: string }
    ): Promise<{ success: boolean; error?: string }> => {
      if (!connected || !socket) return { success: false, error: am.notConnectedServer || 'Not connected' };

      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout | null = null;

        const handleSuccess = () => {
          cleanup();
          resolve({ success: true });
        };

        const handleError = ({ message }: { message: string }) => {
          toast.error(message);
          cleanup();
          resolve({ success: false, error: message });
        };

        const cleanup = () => {
          if (timeoutId) clearTimeout(timeoutId);
          socket.off("cardRemoved", handleSuccess);
          socket.off("leftGame", handleSuccess);
          socket.off("removeCardError", handleError);
        };

        timeoutId = setTimeout(() => {
          cleanup();
          resolve({ success: false, error: "Request timed out" });
        }, 8000);

        socket.once("cardRemoved", handleSuccess);
        socket.once("leftGame", handleSuccess);
        socket.once("removeCardError", handleError);

        socket.emit("removeCard", { ...data, bet });
      });
    },
    [socket, connected]
  );

  //✅ Watch a specific game
  const watchGame = useCallback((bet: number) => {
    if (!socket || !connected) return;

    console.log("👀 Watching game:", bet);
    socket.emit("watchGame", { bet });
  }, [socket, connected]);

  // Leave current game
  const leaveGame = useCallback(() => {
    if (!socket || !currentGame || !user) return;
    socket.emit('leaveGame', {
      gameId: currentGame.id,
      playerId: user.id,
      bet: currentGame.bet
    });
  }, [socket, currentGame, user]);


  // ✅ handle game update and sets current game - moved outside useEffect to prevent recreation
  const handleGameUpdate = useCallback((game: GameSession) => {
    if (!game) {
      return;
    }
    // Update the specific game in the games record
    setGames(prev => ({
      ...prev,
      [game.bet]: game
    }));

    setCurrentGame(prev => {
      if (!prev || prev.id !== game.id) {
        console.log("🔄 Switching current game to:", game.id);
        return game;
      }
      return game; // update even if same game
    });

    // Auto-detect finished game directly from game state updates
    if (game.status === 'finished' && game.winner) {
      const winner = game.winner;
      const currentUser = userRef.current;
      const isUserWinner = Boolean(
        currentUser && (winner.id === currentUser.id || winner.id === currentUser.telegramId)
      );

      let card = winner.card;
      const cardNumber = winner.cardNumber || card?.id;
      if ((!card || !card.numbers || card.numbers.length === 0) && cardNumber) {
        card = (cartelas as Cartela[]).find((c) => c.id === cardNumber);
      }
      if (!card || !card.numbers || card.numbers.length === 0) {
        card = (cartelas as Cartela[])[0];
      }

      const cardNumbers = card ? normalizeCardNumbers(card) : (cartelas as Cartela[])[0].numbers;

      setBingoResultData({
        cartela: {
          id: cardNumber || card?.id || 1,
          numbers: cardNumbers,
        },
        calledNumbers: [...(game.calledNumbers || [])],
        won: isUserWinner,
        pattern: null,
        bet: game.bet ?? null,
        winnerName: winner.name ?? null,
        winnerUsername:
          winner.username ??
          (winner as { telegramUsername?: string })?.telegramUsername ??
          null,
      });
      setResultOverlayOpen(true);
    }
  }, []);

  // Listen for game updates
  const handleGamesUpdate = useCallback((payload: GameSession[] | Record<string, GameSession>) => {
    console.log("📡 Games update received raw:", payload);
    const gamesRecord = gamesToRecord(payload);
    console.log("✅ Processed games record:", Object.keys(gamesRecord));
    setGames(gamesRecord);
    setGameLoading(false);
  }, []);

  const handleNumberCalled = useCallback((data: { gameId: string; number: number; calledNumbers: number[] }) => {
    console.log("🔢 Number called:", data.number, "in game:", data.gameId);
    // const { play } = useBingoSound();

    const letter = getLetter(data.number)
    speak(letter, data.number);

    // play();

    // Update the game with the new called number
    setGames(prev => {
      const updatedGames = { ...prev };
      Object.keys(updatedGames).forEach(bet => {
        if (updatedGames[Number(bet)].id === data.gameId) {
          updatedGames[Number(bet)] = {
            ...updatedGames[Number(bet)],
            calledNumbers: data.calledNumbers
          };
        }
      });
      return updatedGames;
    });

    // Update current game if it matches - use functional update to avoid dependency
    setCurrentGame(prev => {
      if (prev?.id === data.gameId) {
        return {
          ...prev,
          calledNumbers: data.calledNumbers
        };
      }
      return prev;
    });
  }, [speak]);

  const handleGameStarted = useCallback((data: { gameId: string; game: GameSession }) => {
    console.log("🚀 Game started:", data.gameId);
    handleGameUpdate(data.game);
  }, [handleGameUpdate]);

  const handleGameFinished = useCallback((data: {
    gameId: string;
    winner?: Player | null;
    game: GameSession;
  }) => {
    if (!data?.game) return;
    const { game, winner } = data;

    handleGameUpdate(game);

    if (winner) {
      let card = winner.card;
      const cardNumber = winner.cardNumber || card?.id;
      if (!card && cardNumber) {
        card = (cartelas as Cartela[]).find((c) => c.id === cardNumber);
      }
      if (!card) {
        card = (cartelas as Cartela[])[0];
      }
      const currentUser = userRef.current;
      const isUserWinner = Boolean(
        currentUser && (winner.id === currentUser.id || winner.id === currentUser.telegramId)
      );
      const cardNumbers = card ? normalizeCardNumbers(card) : (cartelas as Cartela[])[0].numbers;
      setBingoResultData({
        cartela: {
          id: cardNumber || card?.id || 1,
          numbers: cardNumbers,
        },
        calledNumbers: [...(game.calledNumbers || [])],
        won: isUserWinner,
        pattern: null,
        bet: game.bet ?? null,
        winnerName: winner.name ?? null,
        winnerUsername:
          winner.username ??
          (winner as { telegramUsername?: string })?.telegramUsername ??
          null,
      });
      setResultOverlayOpen(true);
    }
  }, []);

  const handleBingoWin = useCallback((data: BingoWinEventPayload) => {
    const { winner, game, pattern } = data;

    const currentUser = userRef.current;
    const isUserWinner = Boolean(
      currentUser && (winner?.id === currentUser.id || winner?.id === currentUser.telegramId)
    );

    let card = winner?.card;
    const cardNumber = winner?.cardNumber || card?.id;
    if (!card && cardNumber) {
      card = (cartelas as Cartela[]).find((c) => c.id === cardNumber);
    }
    if (!card) {
      card = (cartelas as Cartela[])[0];
    }

    const calledNumbers = game?.calledNumbers || [];

    handleGameUpdate(game);

    const winnerName = winner?.name ?? null;
    const winnerUsername =
      winner?.username ??
      (winner as { telegramUsername?: string })?.telegramUsername ??
      null;
    const cardNumbers = card ? normalizeCardNumbers(card) : (cartelas as Cartela[])[0].numbers;
    const calledNumbersSnapshot = [...calledNumbers];
    setBingoResultData({
      cartela: {
        id: cardNumber || card?.id || 1,
        numbers: cardNumbers,
      },
      calledNumbers: calledNumbersSnapshot,
      won: isUserWinner,
      pattern: pattern ?? null,
      bet: game?.bet ?? null,
      winnerName,
      winnerUsername,
    });

    setResultOverlayOpen(true);
  }, [handleGameUpdate]);

  const handleBalanceUpdate = useCallback((data: { balance: number }) => {
    const currentUser = userRef.current;
    if (currentUser) {
      setUser({ ...currentUser, balance: data.balance });
    }
  }, [setUser]);

  const handlePlayerJoined = useCallback((data: { gameId: string; player: Player; game: GameSession }) => {
    console.log("👤 Player joined:", data.player.name, "in game:", data.gameId);
    // handleGameUpdate(data.game);
  }, []);

  const handlePlayerLeft = useCallback((data: { gameId: string; playerId: string; game: GameSession }) => {
    console.log("👋 Player left:", data.playerId, "from game:", data.gameId);
    handleGameUpdate(data.game);
  }, [handleGameUpdate]);




  const handleLeaveGameError = useCallback(({ message }: { message: string }) => {
    toast.error(message);
  }, []);

  const handleLeftGame = useCallback(() => {
    setCurrentGame(null);
    sessionStorage.removeItem(PLAYER_GAME_DATA);
    let betVal = 20;
    try {
      const stored = sessionStorage.getItem(SELECTED_GAME_DATA);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.bet && !isNaN(Number(parsed.bet))) betVal = Number(parsed.bet);
      }
    } catch { }
    router.push(`/cards?bet=${betVal}`);
  }, [router]);


  const handleRejoinedGame = useCallback((data: {
    targetGame: GameSession;
    playerId: string;
    player: Player;
  }) => {
    console.log("🔄 Rejoined game event:", data.targetGame?.id);
    if (data.targetGame) {
      handleGameUpdate(data.targetGame);
      setCurrentGame(data.targetGame);
    }
  }, [handleGameUpdate]);

  useEffect(() => {
    if (!socket || !connected || !user) return;
    socket.emit("identifyPlayer", {
      playerId: user.id,
      telegramId: user.telegramId || user.id,
    });
  }, [socket, connected, user]);

  useEffect(() => {
    if (!socket) return;

    // Get initial games from backend when connected
    if (connected) {
      refreshGames();
    }

    socket.on("gamesUpdate", handleGamesUpdate);
    socket.on("gameUpdate", handleGameUpdate);
    socket.on("rejoinedGame", handleRejoinedGame);
    socket.on("numberCalled", handleNumberCalled);
    socket.on("gameStarted", handleGameStarted);
    socket.on("gameFinished", handleGameFinished);
    socket.on('bingoWin', handleBingoWin);
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);
    socket.on("balanceUpdate", handleBalanceUpdate);
    socket.on("leaveGameError", handleLeaveGameError);
    socket.on("leftGame", handleLeftGame);

    return () => {
      socket.off("gamesUpdate", handleGamesUpdate);
      socket.off("gameUpdate", handleGameUpdate);
      socket.off("rejoinedGame", handleRejoinedGame);
      socket.off("numberCalled", handleNumberCalled);
      socket.off("gameStarted", handleGameStarted);
      socket.off("gameFinished", handleGameFinished);
      socket.off('bingoWin', handleBingoWin);
      socket.off("playerJoined", handlePlayerJoined);
      socket.off("playerLeft", handlePlayerLeft);
      socket.off("balanceUpdate", handleBalanceUpdate);
      socket.off("leaveGameError", handleLeaveGameError);
      socket.off("leftGame", handleLeftGame);
    };
  }, [socket, connected, refreshGames, handleGamesUpdate, handleGameUpdate, handleNumberCalled, handleGameStarted, handleGameFinished, handleBingoWin, handlePlayerJoined, handlePlayerLeft, handleBalanceUpdate, handleLeaveGameError, handleLeftGame]);

  // Auto-refresh games periodically
  useEffect(() => {
    if (!connected) return;

    const interval = setInterval(() => {
      refreshGames();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [connected, refreshGames]);

  return (
    <GameContext.Provider value={{
      games,
      currentGame,
      gameLoading,
      userLoading,
      error,
      user,

      resultOverlayOpen,
      bingoResultData,
      setResultOverlayOpen,
      setBingoResultData,

      setCurrentGame,
      refreshGames,
      joinGame,
      removeCard,
      watchGame,
      leaveGame,
      // markNumber
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGames = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGames must be used inside GameProvider");
  return ctx;
};
