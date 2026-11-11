'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Sparkles, LayoutGrid, X, Trophy } from 'lucide-react';
import BingoBallStrip from './components/bingoBallStrip';
import BingoResult from './components/bingoResult';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
import cartelas from '../../data/cartelas.json';
import { PLAYER_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';

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

const columnHeaders: { letter: string; color: string; border: string; glow: string }[] = [
  { letter: 'B', color: 'from-rose-500 to-red-600', border: 'border-rose-400/30', glow: 'shadow-rose-500/30' },
  { letter: 'I', color: 'from-amber-400 to-orange-500', border: 'border-amber-300/30', glow: 'shadow-amber-500/30' },
  { letter: 'N', color: 'from-emerald-400 to-green-600', border: 'border-emerald-300/30', glow: 'shadow-emerald-500/30' },
  { letter: 'G', color: 'from-sky-400 to-blue-600', border: 'border-sky-300/30', glow: 'shadow-sky-500/30' },
  { letter: 'O', color: 'from-purple-400 to-fuchsia-600', border: 'border-purple-300/30', glow: 'shadow-purple-500/30' },
];

export default function GamePage() {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const {
    currentGame,
    bingoResultData,
    resultOverlayOpen,
    setResultOverlayOpen,
    games,
    setCurrentGame,
    user,
    userLoading,
    gameLoading,
    leaveGame,
  } = useGames();

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([0]);
  const [current, setCurrent] = useState<number | null>(null);

  const [bingoClaiming, setBingoClaiming] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);

  // Multi-cartela states
  const [playerCards, setPlayerCards] = useState<Cartela[]>([]);
  const [activeCardIndex, setActiveCardIndex] = useState<number>(0);

  // Auto-Bingo functionality
  const [autoBingo, setAutoBingo] = useState<boolean>(true);

  // Master board modal
  const [showMasterBoard, setShowMasterBoard] = useState<boolean>(false);

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

  // Restore player session on mount
  useEffect(() => {
    if (userLoading || gameLoading) return;
    if (resultOverlayOpen) return;

    if (!user) {
      router.push('/');
      return;
    }

    try {
      const savedData = sessionStorage.getItem(PLAYER_GAME_DATA);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.gameId) {
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
          if (!currentGame || currentGame.id !== activeGame.id) {
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
            setPlayerCards(resolvedCards);
          }

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

          if (!playerData || playerData.gameId !== activeGame.id) {
            setPlayerData(restoredData);
            sessionStorage.setItem(
              PLAYER_GAME_DATA,
              JSON.stringify({
                ...restoredData,
                cards: resolvedCards,
              })
            );
          }
          return;
        }
      }
    }

    const stored = sessionStorage.getItem(PLAYER_GAME_DATA);
    if (!stored) {
      router.push('/');
    }
  }, [
    router,
    currentGame,
    userLoading,
    gameLoading,
    user,
    games,
    setCurrentGame,
    playerData,
    resultOverlayOpen,
  ]);

  useEffect(() => {
    if (playerData && !currentGame && games) {
      const foundGame = Object.values(games).find((g) => g.id === playerData.gameId);
      if (foundGame) {
        setCurrentGame(foundGame);
      }
    }
  }, [playerData, currentGame, games, setCurrentGame]);

  const activeCard = playerCards[activeCardIndex] || playerCards[0] || null;

  useEffect(() => {
    if (!currentGame) return;
    const called = currentGame.calledNumbers || [];
    setCurrent(called[called.length - 1] || null);
  }, [currentGame]);

  // Socket error handler
  const handleBingoClaimError = useCallback(
    ({ message, removed }: { message: string; removed: boolean }) => {
      toast.error(message);
      if (removed) {
        setIsRemoved(true);
        setBingoClaiming(true);
        toast.error(am.tooManyAttempts);
      }
    },
    []
  );

  useEffect(() => {
    if (!socket) return;
    socket.on('bingoClaimError', handleBingoClaimError);
    return () => {
      socket.off('bingoClaimError', handleBingoClaimError);
    };
  }, [socket, connected, handleBingoClaimError]);

  const handleBingoClick = useCallback(() => {
    if (!currentGame || !playerData || !socket) return;

    setBingoClaiming(true);
    socket.emit('claimBingo', {
      gameId: currentGame.id,
      playerId: playerData.playerId,
      bet: currentGame.bet,
    });

    setBingoClaiming(false);
  }, [currentGame, playerData, socket]);

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
      if (currentGame.status === 'started' && !bingoClaiming && !isRemoved) {
        const winningCard = playerCards.find((card) => checkBingoWin(called, card));
        if (winningCard) {
          toast.success('🎉 BINGO! Submitting claim automatically...');
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

  if (!currentGame || !activeCard || !playerData) {
    return (
      <div className="flex items-center justify-center h-screen text-white bg-brand-bg">
        <div className="text-center animate-pulse">
          <p className="text-sm font-bold">{am.loadingGame}</p>
        </div>
      </div>
    );
  }

  const isCurrentCardWinning = checkBingoWin(calledNumbers, activeCard);

  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col justify-between max-w-md mx-auto px-3 py-2 select-none">
      {/* 1. Header Bar */}
      <div className="flex items-center justify-between gap-2 py-1.5 border-b border-white/10">
        <button
          onClick={leaveGame}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white transition active:scale-95 text-xs font-black uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-brand-primary" />
          <span>{am.back}</span>
        </button>

        {/* Prize Pool Pill */}
        <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/10 via-yellow-500/15 to-amber-500/10 border border-amber-400/30 px-3 py-1 rounded-full shadow-lg shadow-amber-500/10">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-black text-amber-300 tracking-tight">
            {currentGame.possibleWin ?? 0} ETB
          </span>
        </div>

        {/* Compact Auto-Bingo Toggle */}
        <button
          type="button"
          onClick={() => {
            const next = !autoBingo;
            setAutoBingo(next);
            toast.info(next ? '⚡ Auto-Bingo ON' : '✋ Auto-Bingo OFF');
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider transition ${
            autoBingo
              ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-md shadow-emerald-500/20'
              : 'bg-white/5 border-white/15 text-gray-400 hover:text-white'
          }`}
        >
          <Sparkles className={`w-3 h-3 ${autoBingo ? 'text-emerald-400 animate-spin' : 'text-gray-400'}`} />
          <span>Auto {autoBingo ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* 2. Ball Caller / Game Status Strip */}
      <div className="my-2">
        <BingoBallStrip
          lastThree={calledNumbers.slice(-4)}
          current={current}
          getLetter={getLetter}
          gameStatus={currentGame.status}
          countdownSeconds={currentGame.countdown?.secondsLeft}
          playersCount={currentGame.players?.length || 1}
        />
      </div>

      {/* 3. Multi-Card Tabs (if user has 2+ cards) */}
      {playerCards.length > 1 && (
        <div className="flex items-center justify-center gap-2 mb-2">
          {playerCards.map((card, idx) => {
            const isActive = idx === activeCardIndex;
            const isWin = checkBingoWin(calledNumbers, card);

            return (
              <button
                key={card.id}
                onClick={() => setActiveCardIndex(idx)}
                className={`relative px-3 py-1.5 rounded-xl text-xs font-black border transition ${
                  isActive
                    ? 'bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/30 ring-1 ring-white/30'
                    : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                }`}
              >
                <span>Card #{card.id}</span>
                {isWin && (
                  <span className="absolute -top-2 -right-1 bg-emerald-400 text-black text-[8px] font-black px-1.5 py-0.2 rounded-full shadow animate-bounce">
                    WIN!
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* 4. Bingo Card Board */}
      <div className="w-full bg-gradient-to-b from-white/[0.05] to-black/40 backdrop-blur-2xl p-2.5 sm:p-3 rounded-3xl border border-white/10 shadow-2xl relative my-auto">
        {/* Card Header Tag */}
        <div className="flex items-center justify-between px-2 pb-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
          <span>Board #{activeCard.id}</span>
          {playerCards.length > 1 && (
            <span className="text-brand-accent">
              Card {activeCardIndex + 1} of {playerCards.length}
            </span>
          )}
          {isCurrentCardWinning && (
            <span className="text-emerald-400 animate-pulse font-black">
              ★ BINGO READY!
            </span>
          )}
        </div>

        {/* 5x5 Grid */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          {/* B I N G O Header Balls */}
          {columnHeaders.map(({ letter, color, border, glow }) => (
            <div
              key={letter}
              className={`aspect-square max-h-10 rounded-xl bg-gradient-to-b ${color} border ${border} ${glow} shadow-md flex items-center justify-center text-white font-black text-base`}
            >
              {letter}
            </div>
          ))}

          {/* 5 Rows x 5 Cols Numbers */}
          {activeCard.numbers[0].map((_, row) =>
            activeCard.numbers.map((colArr, col) => {
              const num = colArr[row];
              const isSelected = selectedNumbers.includes(num);
              const isCalled = calledNumbers.includes(num);
              const isFree = num === 0;

              return (
                <button
                  key={`${activeCard.id}-${col}-${row}`}
                  type="button"
                  onClick={() => handleNumberSelect(num)}
                  className={`aspect-square w-full rounded-xl font-black text-sm sm:text-base flex items-center justify-center transition-all duration-200 relative overflow-hidden active:scale-95 ${
                    isFree
                      ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 border border-indigo-400/40'
                      : isSelected
                        ? 'bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/40 border border-emerald-300 ring-1 ring-emerald-300'
                        : isCalled
                          ? 'bg-white/15 text-white border border-amber-400/60 animate-pulse'
                          : 'bg-white/[0.05] text-gray-300 border border-white/10 hover:bg-white/[0.1] hover:text-white'
                  }`}
                >
                  {isFree ? (
                    <span className="text-xs">★ ነፃ</span>
                  ) : (
                    <span>{num}</span>
                  )}

                  {/* Stamp mark animation */}
                  {isSelected && !isFree && (
                    <div className="absolute inset-0 bg-white/15 rounded-full scale-75 border border-white/30 pointer-events-none" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 5. Bottom Controls (Always in view, never cut off) */}
      <div className="pt-2 flex flex-col gap-2">
        {/* Main BINGO Button */}
        <button
          type="button"
          onClick={handleBingoClick}
          disabled={isRemoved || bingoClaiming}
          className={`w-full py-3.5 rounded-2xl font-black text-sm uppercase tracking-[0.25em] transition-all transform active:scale-[0.98] shadow-2xl relative overflow-hidden ${
            bingoClaiming || isRemoved
              ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
              : isCurrentCardWinning
                ? 'bg-gradient-to-r from-emerald-400 via-green-500 to-emerald-600 text-white shadow-emerald-500/50 ring-4 ring-emerald-400/30 animate-pulse'
                : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 shadow-emerald-500/25'
          }`}
        >
          {am.bingo}
          {!bingoClaiming && !isRemoved && (
            <div className="absolute inset-0 bg-white/20 translate-x-[-100%] animate-[shine_2s_infinite]" />
          )}
        </button>

        {/* Sub-bar: Quit Game & Master Board Modal Button */}
        <div className="flex gap-2 items-center">
          <button
            type="button"
            onClick={leaveGame}
            className="flex-1 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-rose-400 hover:bg-rose-500/10 transition active:scale-95"
          >
            {am.quitGame}
          </button>

          {/* Master Board 75 Numbers Toggle */}
          <button
            type="button"
            onClick={() => setShowMasterBoard(true)}
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-wider text-gray-300 hover:bg-white/10 transition active:scale-95"
          >
            <LayoutGrid className="w-3 h-3 text-brand-primary" />
            <span>Board ({calledNumbers.length}/75)</span>
          </button>

          {/* Live Sync Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-emerald-400">
            <div className={`w-2 h-2 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span>{connected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {/* 6. Slide-up Modal for the 75-Number Master Board */}
      {showMasterBoard && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-3">
          <div className="w-full max-w-sm bg-neutral-900 border border-white/15 rounded-3xl p-4 shadow-2xl relative animate-in fade-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
              <div className="flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-brand-primary" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Called Numbers ({calledNumbers.length} / 75)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowMasterBoard(false)}
                className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1.5 text-center max-h-[60vh] overflow-y-auto">
              {columnHeaders.map(({ letter, color }) => (
                <div
                  key={letter}
                  className={`py-1 rounded-lg bg-gradient-to-b ${color} text-white font-black text-xs shadow`}
                >
                  {letter}
                </div>
              ))}

              {Array.from({ length: 15 }, (_, row) =>
                columnHeaders.map((_, col) => {
                  const num = col * 15 + row + 1;
                  const isCalled = calledNumbers.includes(num);

                  return (
                    <div
                      key={num}
                      className={`py-1 rounded-md text-[11px] font-black transition ${
                        isCalled
                          ? 'bg-brand-primary text-white shadow-md shadow-brand-primary/30 scale-105'
                          : 'bg-white/[0.04] text-gray-500'
                      }`}
                    >
                      {num}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bingo Win Overlay */}
      {bingoResultData && (
        <BingoResult
          isOpen={resultOverlayOpen}
          onClose={() => setResultOverlayOpen(false)}
          cartela={bingoResultData.cartela}
          calledNumbers={bingoResultData.calledNumbers}
          won={bingoResultData.won}
          bet={bingoResultData.bet ?? undefined}
          pattern={bingoResultData.pattern}
          winnerName={bingoResultData.winnerName}
          winnerUsername={bingoResultData.winnerUsername}
        />
      )}
    </div>
  );
}
