'use client';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Trophy } from 'lucide-react';
import MasterBoardView from './components/masterBoardView';
import BingoResult from './components/bingoResult';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
import cartelas from '../../data/cartelas.json';
import { PLAYER_GAME_DATA, SELECTED_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';
import { useAmharicBingoVoice } from '../../lib/useAmharicBIngoVoice';
import { useAppNavigation } from '../../context/NavigationContext';

const getLetter = (num: number) => {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  return 'O';
};

const checkBingoWin = (calledNumbers: number[], card: Cartela): boolean => {
  const grid = card.numbers;
  const isMarked = (val: number) => val === 0 || calledNumbers.includes(val);

  // Rows
  for (let row = 0; row < 5; row++) {
    if ([0, 1, 2, 3, 4].every((col) => isMarked(grid[col][row]))) return true;
  }
  // Columns
  for (let col = 0; col < 5; col++) {
    if (grid[col].every(isMarked)) return true;
  }
  // Diagonals
  if ([0, 1, 2, 3, 4].every((i) => isMarked(grid[i][i]))) return true;
  if ([0, 1, 2, 3, 4].every((i) => isMarked(grid[4 - i][i]))) return true;

  return false;
};

const cartelaHeaders: { letter: string; bg: string; shadow: string }[] = [
  { letter: 'B', bg: 'bg-[#ef4444]', shadow: 'shadow-red-500/40' },
  { letter: 'I', bg: 'bg-[#f97316]', shadow: 'shadow-orange-500/40' },
  { letter: 'N', bg: 'bg-[#10b981]', shadow: 'shadow-emerald-500/40' },
  { letter: 'G', bg: 'bg-[#0ea5e9]', shadow: 'shadow-sky-500/40' },
  { letter: 'O', bg: 'bg-[#c084fc]', shadow: 'shadow-purple-500/40' },
];

export default function GamePage() {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const appNav = useAppNavigation(); // null when accessed via /game directly
  const {
    currentGame,
    bingoResultData,
    resultOverlayOpen,
    setResultOverlayOpen,
    setBingoResultData,
    games,
    setCurrentGame,
    user,
    userLoading,
    gameLoading,
    leaveGame,
    watchGame,
  } = useGames();

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([0]);
  const [current, setCurrent] = useState<number | null>(null);

  const [bingoClaiming, setBingoClaiming] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  // Ref to read currentGame inside effects without adding it to deps
  const currentGameRef = useRef(currentGame);
  useEffect(() => { currentGameRef.current = currentGame; }, [currentGame]);

  // Multi-cartela states
  const [playerCards, setPlayerCards] = useState<Cartela[]>([]);

  // Auto-Bingo functionality & Amharic voice sound
  const { speak } = useAmharicBingoVoice();
  const [autoBingo, setAutoBingo] = useState<boolean>(true);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bingo_sound_enabled');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  const handleToggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('bingo_sound_enabled', String(next));
      }
      if (next && current) {
        speak(getLetter(current), current);
      }
      return next;
    });
  }, [current, speak]);

  const [playerData, setPlayerData] = useState<{
    gameId: string;
    userId?: string;
    telegramId?: string;
    cardNumber?: number;
    cardNumbers?: number[];
    playerName: string;
    playerId: string;
    bet: number;
  } | null>(null);

  // Keep socket room joined and synced to current game
  useEffect(() => {
    if (!connected) return;
    let betVal = currentGame?.bet;
    if (!betVal && typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem(PLAYER_GAME_DATA) || sessionStorage.getItem(SELECTED_GAME_DATA);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.bet) betVal = Number(parsed.bet);
        }
      } catch { }
    }
    if (betVal) {
      watchGame(betVal);
    }
  }, [connected, currentGame?.bet, watchGame]);

  // Restore player session on mount
  // Use a ref to ensure we only run this logic ONCE per game ID, not on every state change
  const lastRestoredGameId = useRef<string | null>(null);

  useEffect(() => {
    if (userLoading || gameLoading) return;
    if (resultOverlayOpen) return;
    if (!user) return;

    // Read session storage first (cheapest path)
    try {
      const savedData = sessionStorage.getItem(PLAYER_GAME_DATA);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.gameId && parsed.gameId !== lastRestoredGameId.current) {
          lastRestoredGameId.current = parsed.gameId;
          setPlayerData(parsed);
          if (Array.isArray(parsed.cards) && parsed.cards.length > 0) {
            setPlayerCards(parsed.cards);
          }
        }
      }
    } catch (e) {
      console.error('Error reading player game data from session:', e);
    }

    const matchesPlayer = (p: { id?: string; telegramId?: string | null }) =>
      p.id === user.id ||
      (!!user.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId));

    if (games) {
      const activeGame = Object.values(games).find((g) =>
        g.players.some(matchesPlayer)
      );

      if (activeGame) {
        const player = activeGame.players.find(matchesPlayer);

        if (player) {
          // Only update currentGame if it's a different game
          if (!currentGameRef.current || currentGameRef.current.id !== activeGame.id) {
            setCurrentGame(activeGame);
          }

          let resolvedCards: Cartela[] = [];
          if (Array.isArray(player.cards) && player.cards.length > 0) {
            resolvedCards = player.cards;
          } else if (player.card) {
            resolvedCards = [player.card];
          } else if (player.cardNumbers && player.cardNumbers.length > 0) {
            resolvedCards = player.cardNumbers
              .map((num) => cartelas.find((c) => c.id === num))
              .filter(Boolean) as Cartela[];
          } else if (player.cardNumber) {
            const found = cartelas.find((c) => c.id === player.cardNumber);
            if (found) resolvedCards = [found as Cartela];
          }

          if (resolvedCards.length > 0) {
            setPlayerCards((prev) => {
              // Only update if actually different (avoid re-renders)
              if (prev.length === resolvedCards.length &&
                prev.every((c, i) => c.id === resolvedCards[i].id)) return prev;
              return resolvedCards;
            });
          }

          // Only write playerData if this is a new game
          if (activeGame.id !== lastRestoredGameId.current) {
            lastRestoredGameId.current = activeGame.id;
            const restoredData = {
              gameId: activeGame.id,
              userId: user.id,
              telegramId: user.telegramId || user.id,
              cardNumber: player.cardNumber,
              cardNumbers: player.cardNumbers,
              playerName: getDisplayName(user),
              playerId: user.id,
              bet: activeGame.bet,
            };
            setPlayerData(restoredData);
            sessionStorage.setItem(
              PLAYER_GAME_DATA,
              JSON.stringify({ ...restoredData, cards: resolvedCards })
            );
          }
          return;
        }
      }
    }

    // No player in any active game — spectator mode
    const stored = sessionStorage.getItem(PLAYER_GAME_DATA);
    if (!stored && games) {
      let betVal = 20;
      try {
        const storedBet = sessionStorage.getItem(SELECTED_GAME_DATA);
        if (storedBet) {
          const parsed = JSON.parse(storedBet);
          if (parsed?.bet) betVal = Number(parsed.bet);
        }
      } catch { }

      const matchedGame =
        games[betVal] ||
        Object.values(games).find((g) => g.status === 'started') ||
        Object.values(games)[0];
      if (matchedGame) {
        if (!currentGameRef.current || currentGameRef.current.id !== matchedGame.id) {
          setCurrentGame(matchedGame);
        }
      }
    }
  }, [
    userLoading,
    gameLoading,
    user,
    games,
    setCurrentGame,
    resultOverlayOpen,
  ]); // ← No playerData or currentGame in deps — they caused the infinite loop

  useEffect(() => {
    if (playerData && !currentGame && games) {
      const foundGame = Object.values(games).find((g) => g.id === playerData.gameId);
      if (foundGame) {
        setCurrentGame(foundGame);
      }
    }
  }, [playerData, currentGame, games, setCurrentGame]);

  useEffect(() => {
    if (!currentGame) return;
    const called = currentGame.calledNumbers || [];
    setCurrent(called[called.length - 1] || null);
  }, [currentGame]);



  // Synchronize playerCards from currentGame.players if empty
  useEffect(() => {
    if (!currentGame || playerCards.length > 0) return;
    const matchesPlayer = (p: { id?: string; telegramId?: string | null }) =>
      (user && p.id === user.id) ||
      (!!user?.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId));

    const foundPlayer = currentGame.players?.find(matchesPlayer);
    if (foundPlayer) {
      let resolvedCards: Cartela[] = [];
      if (Array.isArray(foundPlayer.cards) && foundPlayer.cards.length > 0) {
        resolvedCards = foundPlayer.cards;
      } else if (foundPlayer.card) {
        resolvedCards = [foundPlayer.card];
      } else if (foundPlayer.cardNumbers && foundPlayer.cardNumbers.length > 0) {
        resolvedCards = foundPlayer.cardNumbers
          .map((num) => cartelas.find((c) => c.id === num))
          .filter(Boolean) as Cartela[];
      } else if (foundPlayer.cardNumber) {
        const found = cartelas.find((c) => c.id === foundPlayer.cardNumber);
        if (found) resolvedCards = [found as Cartela];
      }
      if (resolvedCards.length > 0) {
        setPlayerCards(resolvedCards);
      }
    }
  }, [currentGame, playerCards.length, user]);

  const claimSubmittedRef = React.useRef(false);

  useEffect(() => {
    claimSubmittedRef.current = false;
  }, [currentGame?.id]);

  // Socket error handler
  const handleBingoClaimError = useCallback(
    ({ message, removed }: { message: string; removed: boolean }) => {
      setBingoClaiming(false);
      // Suppress claim error if game is already finished or winner overlay is active
      if (currentGameRef.current?.status === 'finished' || resultOverlayOpen) return;
      toast.error(message, { toastId: 'bingo-claim-error' });
      if (removed) {
        setIsRemoved(true);
        toast.error(am.tooManyAttempts, { toastId: 'bingo-too-many' });
      }
    },
    [resultOverlayOpen]
  );

  useEffect(() => {
    if (!socket) return;
    socket.on('bingoClaimError', handleBingoClaimError);
    return () => {
      socket.off('bingoClaimError', handleBingoClaimError);
    };
  }, [socket, connected, handleBingoClaimError]);

  const handleBingoClick = useCallback(() => {
    if (!currentGame || !socket || bingoClaiming || claimSubmittedRef.current) return;

    claimSubmittedRef.current = true;
    setBingoClaiming(true);
    socket.emit('claimBingo', {
      gameId: currentGame.id,
      playerId: playerData?.playerId || user?.id,
      userId: user?.id,
      telegramId: user?.telegramId || playerData?.telegramId,
      bet: currentGame.bet,
    });
  }, [currentGame, playerData, user, socket, bingoClaiming]);

  // Auto-detect finished game directly from currentGame state (state-driven sync)
  useEffect(() => {
    if (!currentGame) return;

    if (currentGame.status === 'finished') {
      const winner = currentGame.winner;
      const isUserWinner = Boolean(
        user && winner && (winner.id === user.id || winner.id === user.telegramId)
      );

      let card = winner?.card;
      const cardNumber = winner?.cardNumber || card?.id;
      if ((!card || !card.numbers || card.numbers.length === 0) && cardNumber) {
        card = (cartelas as Cartela[]).find((c) => c.id === cardNumber);
      }
      if (!card || !card.numbers || card.numbers.length === 0) {
        card = (cartelas as Cartela[])[0];
      }

      const cardNumbers = card ? card.numbers : (cartelas as Cartela[])[0].numbers;

      setBingoResultData({
        cartela: {
          id: cardNumber || card?.id || 1,
          numbers: cardNumbers,
        },
        calledNumbers: [...(currentGame.calledNumbers || [])],
        won: isUserWinner,
        pattern: null,
        bet: currentGame.bet ?? null,
        winnerName: winner?.name ?? (isUserWinner ? (getDisplayName(user) || 'You') : 'Winner'),
        winnerUsername: winner?.username ?? null,
      });

      setResultOverlayOpen(true);
    }
  }, [currentGame?.status, currentGame?.winner, user, setResultOverlayOpen, setBingoResultData]);

  // Guard: If there is no active game and player hasn't joined -> Block and redirect to /cards
  // Skip if the result overlay is open or we have result data (winner screen must be visible)
  useEffect(() => {
    if (userLoading || gameLoading) return;
    if (resultOverlayOpen || bingoResultData) return; // Never redirect while showing winner overlay

    const timer = setTimeout(() => {
      const stored = typeof window !== 'undefined' ? sessionStorage.getItem(PLAYER_GAME_DATA) : null;
      const hasPlayerCards = playerCards.length > 0 || !!stored;
      const isGameLive = currentGame && (currentGame.status === 'started' || currentGame.status === 'waiting');

      if (!hasPlayerCards && !isGameLive) {
        if (appNav) {
          appNav.navigateTo('/cards');
        } else {
          router.replace('/cards');
        }
      }
    }, 1500); // give more time for state to settle

    return () => clearTimeout(timer);
  }, [userLoading, gameLoading, playerCards.length, currentGame, resultOverlayOpen, bingoResultData, router, appNav]);
  // Note: The BingoResult component handles its own 5s countdown + redirect to /cards.
  // No separate fallback timer needed here — it would conflict with BingoResult's handlePlayAgain.

  // Auto-Daub & Auto-Claim functionality
  useEffect(() => {
    if (!currentGame || playerCards.length === 0) return;
    const called = currentGame.calledNumbers || [];
    if (called.length === 0) return;

    if (autoBingo) {
      // 1. Auto-daub across all player cards
      setSelectedNumbers((prev) => {
        const next = new Set(prev);
        next.add(0);
        for (const card of playerCards) {
          for (const col of card.numbers) {
            for (const num of col) {
              if (num === 0 || called.includes(num)) {
                next.add(num);
              }
            }
          }
        }
        return Array.from(next);
      });

      // 2. Auto-claim Bingo when any card satisfies win pattern
      if (currentGame.status === 'started' && !claimSubmittedRef.current && !bingoClaiming && !isRemoved) {
        const winningCard = playerCards.find((card) => checkBingoWin(called, card));
        if (winningCard) {
          handleBingoClick();
        }
      }
    }
  }, [
    currentGame?.calledNumbers,
    autoBingo,
    playerCards,
    currentGame?.status,
    bingoClaiming,
    isRemoved,
    handleBingoClick,
  ]);

  const handleNumberSelect = (num: number) => {
    const isSelected = calledNumbers.includes(num);
    if (isSelected) {
      setSelectedNumbers((prev) =>
        prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
      );
    }
  };

  const calledNumbers = currentGame?.calledNumbers || [];

  // If result overlay is open, never show a loading screen — always render the overlay
  // If loading and no game yet (and no overlay)
  if (!resultOverlayOpen && !bingoResultData && !currentGame && (userLoading || gameLoading)) {
    return (
      <div className="flex items-center justify-center h-screen text-white bg-[#0a0f1d]">
        <div className="text-center animate-pulse">
          <p className="text-sm font-bold text-slate-300">{am.loadingGame}</p>
        </div>
      </div>
    );
  }

  // Calculate total cards chosen across all players
  const totalCardsCount = (currentGame?.players || []).reduce(
    (sum, p) =>
      sum +
      (Array.isArray(p.cards) && p.cards.length > 0
        ? p.cards.length
        : Array.isArray(p.cardNumbers) && p.cardNumbers.length > 0
          ? p.cardNumbers.length
          : p.cardNumber || p.card
            ? 1
            : 0),
    0
  );

  // Calculate derash/prize: 100% for solo, 80% for 2+ players
  const possibleWin =
    currentGame?.possibleWin ||
    (currentGame?.players && currentGame.players.length <= 1
      ? (totalCardsCount || 1) * (currentGame?.bet || 10)
      : Math.floor((currentGame?.bet || 10) * (totalCardsCount || 1) * 0.8));

  const isAnyCardWinning = playerCards.some((card) => checkBingoWin(calledNumbers, card));

  return (
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col justify-between max-w-lg mx-auto px-2.5 sm:px-3 py-2 select-none">
      {/* 1. Top Bar */}
      <div className="flex items-center justify-between gap-2 py-1">
        {/* Back Button: "← ተመለስ" */}
        <button
          onClick={() => {
            leaveGame();
            if (appNav) appNav.navigateTo('/cards');
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#111927] border border-slate-700/60 text-slate-200 hover:text-white hover:bg-slate-800 transition active:scale-95 text-xs font-bold shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
          <span>{am.back}</span>
        </button>

        {/* Prize Pool Pill: "🏆 16 ETB" */}
        <div className="flex items-center gap-1.5 bg-[#171407] border border-amber-500/60 px-3.5 py-1.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.2)]">
          <Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20" />
          <span className="text-xs font-black text-amber-300 tracking-tight">
            {possibleWin} ETB
          </span>
        </div>

        {/* Live Status indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-[#111927] border border-slate-800 text-[11px] font-bold text-slate-400">
          <div
            className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-red-500'
              }`}
          />
          <span>{connected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Countdown Waiting Banner */}
      {currentGame?.status === 'waiting' && currentGame?.countdown?.running && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/30 rounded-2xl py-2 px-4 text-center my-1 animate-pulse flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-xs font-black text-amber-300 uppercase tracking-widest">
            ጨዋታው በ {currentGame.countdown.secondsLeft || 0} ሰከንድ ይጀምራል...
          </span>
          <span className="text-xs text-amber-400 font-mono font-bold">
            ({Math.floor((currentGame.countdown.secondsLeft || 0) / 60)}:
            {String((currentGame.countdown.secondsLeft || 0) % 60).padStart(2, '0')})
          </span>
        </div>
      )}

      {/* 2. Top Section: Stats, Number Caller, Auto Switch & Horizontal 75 Board with Hide/Show */}
      <div className="my-1">
        <MasterBoardView
          possibleWin={possibleWin}
          playersCount={totalCardsCount || 1}
          stake={currentGame?.bet || 10}
          calledNumbers={calledNumbers}
          currentBall={current}
          getLetter={getLetter}
          autoBingo={autoBingo}
          onToggleAuto={() => setAutoBingo((prev) => !prev)}
          soundEnabled={soundEnabled}
          onToggleSound={handleToggleSound}
        />
      </div>

      {/* 3. Cartelas Section: Listed Directly on the Bottom of the 75 Board in a Row of Two */}
      <div className="flex-1 my-1 flex flex-col justify-center">
        {playerCards.length > 0 ? (
          <div
            className={`w-full ${playerCards.length === 1
              ? 'max-w-xs mx-auto'
              : 'grid grid-cols-2 gap-2 sm:gap-2.5'
              }`}
          >
            {playerCards.map((card) => {
              const isWin = checkBingoWin(calledNumbers, card);

              return (
                <div
                  key={card.id}
                  className="w-full bg-[#0c1220] border border-slate-800/90 rounded-2xl p-2 sm:p-2.5 shadow-2xl relative flex flex-col justify-between"
                >
                  {/* Card Header: BOARD #ID & WIN Badge */}
                  <div className="flex items-center justify-between pb-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                    <span className="text-slate-400">BOARD #{card.id}</span>
                    {isWin ? (
                      <span className="text-emerald-400 animate-pulse font-black">
                        ★ WIN!
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[9px]">5x5</span>
                    )}
                  </div>

                  {/* 5 Column Letter Headers: B I N G O */}
                  <div className="grid grid-cols-5 gap-1 mb-1">
                    {cartelaHeaders.map(({ letter, bg, shadow }) => (
                      <div
                        key={letter}
                        className={`h-5 sm:h-6 rounded-md ${bg} ${shadow} shadow flex items-center justify-center text-white font-black text-xs`}
                      >
                        {letter}
                      </div>
                    ))}
                  </div>

                  {/* 5 Rows x 5 Cols Number Grid */}
                  <div className="grid grid-cols-5 gap-1">
                    {card.numbers[0].map((_, row) =>
                      card.numbers.map((colArr, col) => {
                        const num = colArr[row];
                        const isSelected = selectedNumbers.includes(num);
                        const isCalled = calledNumbers.includes(num);
                        const isFree = num === 0;

                        return (
                          <button
                            key={`${card.id}-${col}-${row}`}
                            type="button"
                            onClick={() => handleNumberSelect(num)}
                            className={`aspect-square w-full rounded-lg font-black text-xs sm:text-sm flex items-center justify-center transition-all duration-150 relative overflow-hidden active:scale-95 ${isFree
                              ? 'bg-gradient-to-br from-[#8b5cf6] to-[#a855f7] text-white shadow-sm border border-purple-400/50'
                              : isSelected
                                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/40 border border-emerald-300 ring-1 ring-emerald-300'
                                : isCalled
                                  ? 'bg-[#1e293b] text-white border border-amber-400/60 animate-pulse'
                                  : 'bg-[#121a2d] text-white border border-slate-800/80 hover:bg-[#18233c]'
                              }`}
                          >
                            {isFree ? (
                              <span className="text-[9px] sm:text-[10px] font-black">
                                ★ ነፃ
                              </span>
                            ) : (
                              <span>{num}</span>
                            )}

                            {/* Daubed Ring Overlay */}
                            {isSelected && !isFree && (
                              <div className="absolute inset-0 bg-white/20 rounded-full scale-75 border border-white/40 pointer-events-none" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Spectator Waiting Notice */
          <div className="bg-[#0f172a] border border-slate-800 rounded-2xl p-4 text-center my-auto shadow-xl">
            <p className="text-xs sm:text-sm font-bold text-slate-200 leading-relaxed font-sans">
              የዚህ ዙር ጨዋታ ተጀምሯል:: አዲስ ዙር እስኪጀምር እዚህ ይጠብቁ::
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              (This round has started. Please wait here until the new round begins.)
            </p>
          </div>
        )}
      </div>

      {/* 4. Giant Green BINGO Button (Always Accessible if Player has Cards) */}
      {playerCards.length > 0 && (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={handleBingoClick}
            disabled={isRemoved || bingoClaiming}
            className={`w-full py-3.5 sm:py-4 rounded-2xl font-black text-lg sm:text-xl uppercase tracking-[0.2em] transition-all transform active:scale-[0.98] shadow-2xl relative overflow-hidden ${bingoClaiming || isRemoved
              ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
              : isAnyCardWinning
                ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 text-white shadow-emerald-500/50 ring-4 ring-emerald-400/30 animate-pulse'
                : 'bg-[#10b981] hover:bg-[#059669] text-white shadow-[0_4px_25px_rgba(16,185,129,0.45)]'
              }`}
          >
            BINGO
            {!bingoClaiming && !isRemoved && (
              <div className="absolute inset-0 bg-white/20 translate-x-[-100%] animate-[shine_2s_infinite]" />
            )}
          </button>
        </div>
      )}

      {/* 5. Bottom Utility Bar */}
      <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800/60 mt-2">
        <button
          type="button"
          onClick={() => {
            leaveGame();
            if (appNav) appNav.navigateTo('/cards');
          }}
          className="px-3.5 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 hover:bg-red-500/20 transition active:scale-95"
        >
          {am.quitGame}
        </button>

        <span className="text-[10px] font-bold text-slate-500 tracking-wider">
          WINNER BINGO
        </span>
      </div>

      {/* Bingo Win Overlay */}
      {(resultOverlayOpen || Boolean(bingoResultData)) && (
        <BingoResult
          isOpen={resultOverlayOpen}
          onClose={() => setResultOverlayOpen(false)}
          cartela={bingoResultData?.cartela}
          calledNumbers={bingoResultData?.calledNumbers || calledNumbers}
          won={bingoResultData?.won ?? false}
          bet={bingoResultData?.bet ?? currentGame?.bet ?? undefined}
          pattern={bingoResultData?.pattern}
          winnerName={bingoResultData?.winnerName}
          winnerUsername={bingoResultData?.winnerUsername}
        />
      )}
    </div>
  );
}
