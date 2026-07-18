"use client";
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { useSocket } from "./SocketContext";
import { GameSession, Player, GameJoinRequest, UserSafeType, Cartela, BingoWinEventPayload, BingoWinPattern } from "../types/game";
import { ApiClient, apiClient } from "../lib/api";
import { useRouter } from "next/navigation";
// import toast from "react-hot-toast";
import { toast } from "react-toastify";
import { am } from "../constants/amharic";
import { useAuth } from "./AuthContext";

import { PLAYER_GAME_DATA } from "../constants/configurations";

import { useAmharicBingoVoice } from "../lib/useAmharicBIngoVoice";
import { gamesToRecord } from "../lib/games";

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

interface GameContextType {
  games: Record<number, GameSession>;
  currentGame: GameSession | null;
  gameLoading: boolean;
  userLoading: boolean;
  error: string | null;
  user: UserSafeType | null;
  setCurrentGame: (game: GameSession | null) => void;

  resultOverlayOpen: boolean;
  bingoResultData: {
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
  setResultOverlayOpen: (boolean) => void;
  // Actions
  refreshGames: () => void;
  joinGame: (bet: number, joinData: Omit<GameJoinRequest, 'bet'>) => Promise<{ success: boolean; error?: string; gameId?: string }>;
  watchGame: (bet: number) => void;
  leaveGame: () => void;
  // markNumber: (gameId: string, number: number,bet :number, playerId: string) => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider = ({ children }: { children: ReactNode }) => {
  const { socket, connected } = useSocket();
  const { user, status: authStatus, setUser } = useAuth();
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
    ): Promise<{ success: boolean; error?: string; gameId?: string }> => {
      if (!connected || !socket) {
        return { success: false, error: am.notConnectedServer };
      }

      return new Promise((resolve) => {
        let timeoutId: NodeJS.Timeout | null = null;

        // --- Event listeners ---
        const handleQueued = ({ message }: { message: string }) => {
          toast.success(am.queued(message));
        };

        const handleJoined = (data: GameJoinRequest) => {
          toast.success(am.joinedWithCard(data.cardNumber));
          cleanup();
          resolve({ success: true, gameId: data.gameId });
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
      toast.error(am.invalidGameUpdate);
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
  }, []);

  const handleGameStarted = useCallback((data: { gameId: string; game: GameSession }) => {
    console.log("🚀 Game started:", data.gameId);
    handleGameUpdate(data.game);
  }, [handleGameUpdate]);

  const handleGameFinished = useCallback((data: {
    gameId: string;
    winner?: Player | null;
    game: GameSession;
  }) => {
    // ✅ Minimal safety check
    if (!data?.game) return;

    const { game, winner } = data;

    // ✅ Safety checks for user
    if (!user || !user.id) {
      console.error("User not loaded");
      return;
    }

    const won = winner && (winner.id === user.id || winner.id === user.telegramId);
    const playerData = game.players.find(p => p.id === user.id || p.id === user.telegramId);
    const playerCard = playerData?.card;
    const playerCardNumber = playerData?.cardNumber;
    const calledNumbers = game.calledNumbers || [];

    console.log(
      "🏁 Game finished:",
      game.id,
      winner ? `Winner: ${winner.name}` : "No winner yet"
    );

    // ✅ First update
    handleGameUpdate(game);

    // ✅ Show toast with proper null check
    if (winner) {
      toast.success(am.winnerWon(winner.name));
    } else {
      toast.success(am.gameFinished);
    }

    // ✅ Only set result data if we have valid player data
    if (playerCardNumber && playerCard) {
      // ✅ Handle card structure: could be { id, numbers } or just numbers array
      type CardStructure = number[][] | { id?: number; numbers: number[][] };
      const cardStructure = playerCard as CardStructure;
      const cardNumbers = Array.isArray(cardStructure)
        ? cardStructure
        : cardStructure.numbers;

      //   setBingoResultData({
      //     cartela: {
      //       id: playerCardNumber,
      //       numbers: cardNumbers
      //     },
      //     calledNumbers,
      //     won: won || false,
      //   });
      //   setResultOverlayOpen(true);
    }

  }, [user, handleGameUpdate]);

  const handleBingoWin = useCallback((data: BingoWinEventPayload) => {
    const { winner, game, prize, pattern } = data;

    if (!user?.id) {
      console.error("User is not loaded.");
      return;
    }

    // -------------------------------
    // 1. Determine win state cleanly
    // -------------------------------
    const isUserWinner = winner?.id === user.id || winner?.id === user.telegramId;
    const card = winner?.card;
    const cardNumber = winner?.cardNumber;
    const calledNumbers = game.calledNumbers || [];

    // Update global game state (one re-render)
    handleGameUpdate(game);

    // -------------------------------
    // 2. Toast notification
    // -------------------------------
    if (winner?.name) {
      toast.success(am.winnerWonPrize(winner.name, prize));
    }

    // -------------------------------
    // 3. Validate card and show result
    // -------------------------------
    if (card && cardNumber) {
      const winnerName = winner?.name ?? null;
      const winnerUsername =
        winner?.username ??
        winner?.telegramUsername ??
        null;
      const cardNumbers = normalizeCardNumbers(card);
      const calledNumbersSnapshot = [...calledNumbers];
      setBingoResultData({
        cartela: {
          id: cardNumber,
          numbers: cardNumbers,
        },
        calledNumbers: calledNumbersSnapshot,
        won: isUserWinner,
        pattern,
        bet: game?.bet ?? null,
        winnerName,
        winnerUsername,
      });

      setResultOverlayOpen(true);
    }

  }, [user, handleGameUpdate]);

  const handleBalanceUpdate = useCallback((data: { balance: number }) => {
    setUser(user ? { ...user, balance: data.balance } : user);
  }, [setUser, user]);

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
    toast.success(am.leftGame);
    setCurrentGame(null);
    sessionStorage.removeItem(PLAYER_GAME_DATA);
    router.push('/');
  }, [router]);


  useEffect(() => {
    if (!socket) return;

    // Get initial games from backend when connected
    if (connected) {
      refreshGames();
    }

    socket.on("gamesUpdate", handleGamesUpdate);
    socket.on("gameUpdate", handleGameUpdate);
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

      setCurrentGame,
      refreshGames,
      joinGame,
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
