'use client';
import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import BingoBallStrip from './components/bingoBallStrip';
import BingoResult from './components/bingoResult';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
import cartelas from '../../data/cartelas.json';
import { PLAYER_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';

const getLetter = (num: number) => {
  if (num >= 1 && num <= 15) return 'B';
  if (num >= 16 && num <= 30) return 'I';
  if (num >= 31 && num <= 45) return 'N';
  if (num >= 46 && num <= 60) return 'G';
  return 'O';
};

const checkBingoWin = (calledNumbers: number[], card: Cartela): boolean => {
  const grid = card.numbers; // column-wise 5x5
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

const colorMap: Record<string, string> = {
  B: 'from-red-400 via-red-500 to-red-600',
  I: 'from-yellow-400 via-yellow-500 to-yellow-600',
  N: 'from-green-400 via-green-500 to-green-600',
  G: 'from-blue-400 via-blue-500 to-blue-600',
  O: 'from-purple-400 via-purple-500 to-purple-600',
};

const bingoLetters = ['B', 'I', 'N', 'G', 'O'];

export default function GamePage() {
  const router = useRouter();
  const { socket, connected } = useSocket();
  const { currentGame, bingoResultData, resultOverlayOpen, setResultOverlayOpen, games, setCurrentGame, user, userLoading, gameLoading, leaveGame } = useGames();

  const [selectedNumbers, setSelectedNumbers] = useState<number[]>([0]);


  const [current, setCurrent] = useState<number | null>(null);

  const [bingoClaiming, setBingoClaiming] = useState(false);
  const [isRemoved, setIsRemoved] = useState(false);
  const [playerCard, setPlayerCard] = useState<Cartela | null>(null);
  const [playerData, setPlayerData] = useState<{
    gameId: string;
    userId?: string;
    telegramId?: string;
    cardNumber: number;
    playerName: string;
    playerId: string;
    bet: number;
  } | null>(null);


  useEffect(() => {
    // 1. Wait for critical data
    if (userLoading || gameLoading) return;

    // ✅ CRITICAL: Do NOT redirect if the result overlay is open.
    // This maintains the view even if the backend resets the game state.
    if (resultOverlayOpen) return;

    if (!user) {
      // If user info failed to load (after loading is done), redirect
      router.push('/');
      return;
    }

    const matchesPlayer = (p: { id?: string; telegramId?: string | null }) =>
      p.id === user.id ||
      (!!user.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId));

    // 2. Strict Check: Is the user in any active game on the server?
    // We check all games to find one where the player exists.
    // This handles "rejoin", "reload", and "access control" all in one.
    if (games) {
      const activeGame = Object.values(games).find(g =>
        g.players.some(matchesPlayer)
        // ✅ Allow 'finished' status so the user can see the results before being redirected
      );

      if (activeGame) {
        const player = activeGame.players.find(matchesPlayer);

        if (player && player.cardNumber) {
          console.log("✅ User validated in game:", activeGame.id);

          // Only update state if needed to avoid loops
          if (!currentGame || currentGame.id !== activeGame.id) {
            setCurrentGame(activeGame);
          }

          // Restore player data logic
          const restoredData = {
            gameId: activeGame.id,
            userId: user.id,
            telegramId: user.telegramId || user.id,
            cardNumber: player.cardNumber,
            playerName: getDisplayName(user),
            playerId: user.id,
            bet: activeGame.bet
          };

          // Update local state if different
          if (!playerData || playerData.gameId !== activeGame.id) {
            setPlayerData(restoredData);
            // Sync storage
            sessionStorage.setItem(PLAYER_GAME_DATA, JSON.stringify(restoredData));
          }

          // Update card if needed
          if (!playerCard || playerCard.id !== player.cardNumber) {
            const card = cartelas.find((c) => c.id === player.cardNumber);
            if (card) setPlayerCard(card);
          }
          return; // Access Granted
        }
      }
    }

    // 3. Access Denied: User is not in any active game
    console.warn("⛔ Access Denied: User not found in any active game.");
    sessionStorage.removeItem(PLAYER_GAME_DATA); // Clear invalid session
    router.push('/');

  }, [router, currentGame, playerCard, userLoading, gameLoading, user, games, setCurrentGame, playerData]);

  // ✅ Fix: Restore current game from context if we have player data but no current game object (e.g. after reload)
  useEffect(() => {
    if (playerData && !currentGame && games) {
      const foundGame = Object.values(games).find(g => g.id === playerData.gameId);
      if (foundGame) {
        console.log("🔄 Restoring game state after reload:", foundGame.id);
        setCurrentGame(foundGame);
      }
    }
  }, [playerData, currentGame, games, setCurrentGame]);

  useEffect(() => {
    if (!currentGame || !playerCard) return;
    const calledNumbers = currentGame.calledNumbers || [];
    setCurrent(calledNumbers[calledNumbers.length - 1] || null);
  }, [currentGame, playerCard])

  // ✅ Redirect after game finishes (unless result overlay is showing)
  // useEffect(() => {
  //   // We only redirect if the game is finished AND the overlay is NOT open.
  //   // This allows the user to see the winning result until they explicitly dismiss it.
  //   if (currentGame?.status === "finished" && !resultOverlayOpen) {
  //     const timer = setTimeout(() => {
  //       sessionStorage.removeItem(PLAYER_GAME_DATA);
  //       router.push('/');
  //     }, 5000); // Increased to 5s as a fallback, but the overlay should prevent this
  //     return () => clearTimeout(timer);
  //   }
  // }, [currentGame?.status, resultOverlayOpen, router]);



  useEffect(() => {
    if (!socket) return;
    socket.on("bingoClaimError", handleBingoClaimError);
    return () => {
      socket.off("bingoClaimError", handleBingoClaimError);
    };
  }, [socket, connected]);


  const handleNumberSelect = (num: number) => {
    const isSelected = calledNumbers.includes(num);
    if (isSelected) {
      setSelectedNumbers((prev) =>
        prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]
      );
    }
  };

  const handleBingoClaimError = useCallback(({ message, removed }: { message: string; removed: boolean }) => {
    console.log("Bingo claim error:", message);
    toast.error(message);
    if (removed) {
      setIsRemoved(true); // disable claim button in your state
      setBingoClaiming(true);
      // leaveGameUI();
      toast.error(am.tooManyAttempts);

    }
  }, []);

  const handleBingoClick = () => {
    if (!currentGame || !playerCard) return;

    setBingoClaiming(true);
    socket.emit("claimBingo", {
      gameId: currentGame.id,
      playerId: playerData.playerId,
      bet: currentGame.bet,
    });

    // const won = checkBingoWin(currentGame.calledNumbers, playerCard);
    // setHasWon(won);
    // setResultOverlayOpen(true);

    // if (won && playerData) {
    //   markNumber(playerData.gameId, -1, playerData.playerId);
    // }

    setBingoClaiming(false);
  };

  const calledNumbers = currentGame?.calledNumbers || [];

  if (!currentGame || !playerCard || !playerData) {
    return (
      <div className="flex items-center justify-center h-screen text-white">
        {am.loadingGame}
      </div>
    );
  }

  if (!playerData || !playerCard) {
    return <div>{am.loadingPlayer}</div>;
  }


  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col items-center">
      {/* Header */}
      <div className="sticky top-0 z-50 w-full bg-white/[0.02] backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="flex items-center justify-between p-2 gap-2 max-w-lg mx-auto">
          {/* Back Button */}
          <button
            onClick={() => router.push('/')}
            className="flex items-center justify-center bg-white/5 border border-white/5 h-12 w-12 rounded-xl hover:bg-white/10 active:scale-95 transition-all group"
          >
            <ArrowLeft className="text-brand-primary w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>

          <div className="flex gap-1.5 flex-1">
            {[
              { label: am.stake, value: currentGame.bet },
              { label: am.players, value: currentGame.players?.length || 0 },
              { label: am.status, value: translateGameStatus(currentGame.status), color: currentGame.status === 'started' ? 'text-emerald-400' : 'text-brand-accent' }
            ].map((stat, i) => (
              <div key={i} className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl py-2 text-center">
                <div className="text-[7px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">{stat.label}</div>
                <div className={`text-[11px] font-black tracking-tighter ${stat.color || 'text-white'}`}>{stat.value}</div>
              </div>
            ))}
          </div>

          {currentGame.winType && (
            <button
              onClick={() => {
                if (currentGame.winType === 'fullhouse') {
                  toast.info(am.fullHouseHint);
                } else {
                  toast.info(am.standardHint);
                }
              }}
              className={`flex-1 h-12 rounded-xl border transition-all active:scale-95 hover:brightness-110 cursor-pointer flex flex-col items-center justify-center ${currentGame.winType === 'fullhouse' ? 'bg-brand-primary/10 border-brand-primary/20 text-brand-primary' : 'bg-brand-secondary/10 border-brand-secondary/20 text-brand-secondary'}`}
            >
              <div className="text-[7px] font-black uppercase tracking-widest leading-none mb-1">{am.winType}</div>
              <div className="text-[9px] font-black uppercase tracking-tight">
                {currentGame.winType === 'fullhouse' ? am.fullHouse : am.standard}
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Game Body */}
      <div className="pt-1 w-[98%] flex gap-2 flex-wrap">


        {/* Center: Player card & controls */}
        <div className="flex-[3] bg-white/[0.03] backdrop-blur-2xl p-4 rounded-3xl border border-white/10 flex flex-col items-center order-1 sm:order-2 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-[60px]" />

          <BingoBallStrip lastThree={calledNumbers.slice(-3)} current={current} getLetter={getLetter} />

          {/* Status Indicators */}
          <div className="my-4 text-center">
            {currentGame.status === 'waiting' && (
              <div className="bg-amber-500/10 text-amber-400 px-4 py-2 rounded-xl border border-amber-500/20 text-[11px] font-black uppercase tracking-widest animate-pulse">
                {currentGame.countdown?.running
                  ? am.commencingIn(currentGame.countdown.secondsLeft)
                  : am.waitingForPlayers(currentGame.players?.length || 0)}
              </div>
            )}
            {currentGame.status === 'started' && (
              <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl border border-emerald-500/20 text-[11px] font-black uppercase tracking-widest">
                {am.boardActive(calledNumbers.length)}
              </div>
            )}
          </div>

          {/* Player Card Container */}
          <div className={`relative p-4 rounded-3xl transition-all duration-500 ${currentGame.winType === 'fullhouse'
            ? 'bg-brand-primary/10 border-2 border-brand-primary/30 shadow-[0_0_40px_rgba(99,102,241,0.2)]'
            : 'bg-white/[0.02] border border-white/5 shadow-xl'
            }`}>
            {currentGame.winType === 'fullhouse' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-brand-primary text-white text-[8px] font-black px-4 py-1.5 rounded-full shadow-lg tracking-widest uppercase">
                {am.grandFullHouse}
              </div>
            )}

            <div className="grid grid-cols-5 gap-2 my-2">
              {bingoLetters.map((letter) => (
                <div
                  key={letter}
                  className={`w-8 h-8 flex items-center justify-center rounded-xl text-white font-black text-lg shadow-lg ${colorMap[letter].includes('red') ? 'bg-red-500' : colorMap[letter].includes('yellow') ? 'bg-amber-500' : colorMap[letter].includes('green') ? 'bg-emerald-500' : colorMap[letter].includes('blue') ? 'bg-sky-500' : 'bg-brand-primary'}`}
                >
                  {letter}
                </div>
              ))}
              {playerCard.numbers[0].map((_, row) =>
                playerCard.numbers.map((colArr, col) => {
                  const num = colArr[row];
                  const isSelected = selectedNumbers.includes(num);
                  const isCalled = calledNumbers.includes(num);
                  return (
                    <button
                      key={`${col}-${row}`}
                      onClick={() => handleNumberSelect(num)}
                      className={`w-8 h-8 flex items-center justify-center rounded-xl text-xs font-black cursor-pointer transition-all duration-300 relative overflow-hidden
                        ${num === 0
                          ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/40 scale-110 z-10'
                          : isSelected
                            ? 'bg-brand-secondary text-white shadow-lg shadow-brand-secondary/40 scale-110 z-10'
                            : 'bg-white/[0.05] text-gray-400 border border-white/5 hover:bg-white/[0.1] hover:text-white'
                        }`}
                    >
                      {num === 0 ? am.free : num}
                      {isSelected && <div className="absolute inset-0 bg-white/10 animate-ping opacity-20" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-4 mb-6 text-[9px] font-black text-gray-500 uppercase tracking-[0.3em]">{am.boardId} #{playerCard.id}</div>

          {/* Actions */}
          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={handleBingoClick}
              disabled={isRemoved || bingoClaiming}
              className={`relative overflow-hidden py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] transition-all transform active:scale-[0.98] shadow-2xl ${bingoClaiming || isRemoved ? 'bg-white/5 text-gray-700' : 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20'}`}
            >
              {am.bingo}
              {!bingoClaiming && !isRemoved && <div className="absolute inset-0 bg-white/10 translate-x-[-100%] animate-[shine_2s_infinite]" />}
            </button>
            <div className="flex gap-3">
              <button
                onClick={leaveGame}
                className="flex-1 bg-white/5 border border-white/5 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest text-rose-400 hover:bg-brand-bg transition-all active:scale-95"
              >
                {am.quitGame}
              </button>
              <div
                className={`flex-1 py-4 rounded-2xl font-black text-[9px] uppercase tracking-widest text-center border transition-all ${connected ? 'bg-white/5 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-rose-500/20 text-rose-400'}`}
              >
                {connected ? am.liveSync : am.offline}
              </div>
            </div>
          </div>
        </div>


        {/* Right: All numbers */}
        <div className="flex-[2] bg-white/[0.02] backdrop-blur-xl p-2 rounded-2xl border border-white/5 order-2 sm:order-1">
          <div className="grid grid-cols-5 gap-1 text-[10px] text-center">
            {bingoLetters.map((letter) => (
              <div
                key={letter}
                className={`flex items-center justify-center rounded-lg text-white font-black py-2 shadow-lg mb-2 ${colorMap[letter].includes('red') ? 'bg-red-500' : colorMap[letter].includes('yellow') ? 'bg-amber-500' : colorMap[letter].includes('green') ? 'bg-emerald-500' : colorMap[letter].includes('blue') ? 'bg-sky-500' : 'bg-brand-primary'}`}
              >
                {letter}
              </div>
            ))}

            {bingoLetters.map((letter, colIdx) => {
              const start = colIdx * 15 + 1;
              return (
                <div key={letter} className="flex flex-col gap-1">
                  {Array.from({ length: 15 }, (_, i) => {
                    const number = start + i;
                    const isCalled = calledNumbers.includes(number);
                    return (
                      <div
                        key={number}
                        className={`p-1 rounded-md font-black transition-all duration-300 ${isCalled
                          ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 scale-105'
                          : 'bg-white/[0.03] text-gray-600'
                          }`}
                      >
                        {number}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

      </div>





      {
        bingoResultData && (
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
        )
      }


      <div className="mt-4 text-center text-xs text-white/70">@winner_bingo_bot</div>
    </div>
  );
}
