'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import cartelasData from '../../data/cartelas.json';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
import { PLAYER_GAME_DATA, SELECTED_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';

export default function CardsPage() {
  const router = useRouter();
  const [selectedCards, setSelectedCards] = useState<number[]>([]);
  const [previewCardNumber, setPreviewCardNumber] = useState<number | null>(null);
  const [cartelasList, setCartelasList] = useState<Cartela[]>(cartelasData as Cartela[]);
  const [joining, setJoining] = useState(false);
  const [activeBet, setActiveBet] = useState<number>(10);

  const { connected } = useSocket();
  const { user, currentGame, joinGame, watchGame } = useGames();

  // Subscribe and sync stake whenever connected or parameters change
  useEffect(() => {
    let betVal = 10;
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const queryBet = urlParams.get('bet') || urlParams.get('stake');

      if (queryBet && !isNaN(Number(queryBet))) {
        betVal = Number(queryBet);
      } else {
        const storedGameData = sessionStorage.getItem(SELECTED_GAME_DATA);
        if (storedGameData) {
          try {
            const parsed = JSON.parse(storedGameData) as { bet?: number };
            if (parsed.bet) betVal = parsed.bet;
          } catch {}
        }
      }
      sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({ bet: betVal }));
    }

    setActiveBet(betVal);
    if (connected) {
      watchGame(betVal);
    }
  }, [connected, watchGame]);

  // Attempt to load fresh cartelas list from backend API
  useEffect(() => {
    fetch('/api/cartelas')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setCartelasList(data as Cartela[]);
        }
      })
      .catch(() => {
        // Fallback to bundled cartelas
      });
  }, []);

  const chosenCartela =
    previewCardNumber != null
      ? cartelasList.find((c) => c.id === previewCardNumber) ?? null
      : null;

  const handleBack = () => router.push('/');

  const handleCardSelect = (number: number) => {
    setSelectedCards((prev) => {
      if (prev.includes(number)) {
        const next = prev.filter((n) => n !== number);
        setPreviewCardNumber(next.length > 0 ? next[next.length - 1] : null);
        return next;
      } else {
        if (prev.length >= 4) {
          toast.info("Maximum 4 cards per game");
          return prev;
        }
        const totalStake = (prev.length + 1) * (currentGame?.bet || 0);
        if ((user?.balance ?? 0) < totalStake) {
          toast.error("Insufficient balance for another card");
          return prev;
        }
        setPreviewCardNumber(number);
        return [...prev, number];
      }
    });
  };

  const handleJoinGame = async () => {
    if (!connected || !currentGame || !user || joining || selectedCards.length === 0) return;

    setJoining(true);

    try {
      const playerName = getDisplayName(user);
      const playerId = user.id;

      const result = await joinGame(currentGame.bet, {
        gameId: currentGame.id,
        playerName,
        playerId,
        cardNumber: selectedCards[0],
        cardNumbers: selectedCards,
        userId: user.id,
        telegramId: user.telegramId || undefined,
      });

      if (result.success) {
        const resolvedCards = selectedCards
          .map(
            (num) =>
              cartelasList.find((c) => c.id === num) ||
              (cartelasData as Cartela[]).find((c) => c.id === num)
          )
          .filter(Boolean) as Cartela[];

        sessionStorage.setItem(
          PLAYER_GAME_DATA,
          JSON.stringify({
            gameId: currentGame.id,
            userId: user.id,
            telegramId: user.telegramId || user.id,
            playerName,
            playerId,
            cardNumber: selectedCards[0],
            cardNumbers: selectedCards,
            cards: resolvedCards,
            bet: currentGame.bet,
          })
        );
        router.replace('/game');
        return;
      }

      toast.error(result.error || am.failedToJoin);
      setJoining(false);
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error(am.failedToJoinRetry);
      setJoining(false);
    }
  };

  const handleRefresh = () => {
    setSelectedCards([]);
    setPreviewCardNumber(null);
  };

  const game = currentGame || {
    id: `temp-${activeBet}`,
    bet: activeBet,
    players: [],
    status: 'waiting' as const,
    calledNumbers: [] as number[],
    possibleWin: Math.floor(activeBet * 0.8),
    bonus: 0,
    maxPlayers: 10,
    countdown: { running: false, secondsLeft: 0 },
  };

  const totalCost = selectedCards.length * game.bet;
  const takenCardNumbers = new Set<number>();
  game.players.forEach((p) => {
    if (p.cardNumber) takenCardNumbers.add(p.cardNumber);
    if (p.cardNumbers) p.cardNumbers.forEach((cn) => takenCardNumbers.add(cn));
  });

  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col">
      {/* Live sync banner */}
      <div
        className={`sticky top-0 z-50 text-center py-2 text-xs font-black tracking-widest uppercase transition-colors duration-500 ${connected
          ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20 backdrop-blur-md'
          : 'bg-rose-500/10 text-rose-400 border-b border-rose-500/20 backdrop-blur-md'
          }`}
      >
        <div className="flex items-center justify-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 animate-pulse' : 'bg-current'
              }`}
          />
          {connected ? am.systemLive : am.disconnected}
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="sticky top-0 z-40 w-full bg-white/5 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="flex items-center justify-between p-3 gap-2">
          <button
            onClick={handleBack}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95 group"
          >
            <span className="text-brand-primary group-hover:-translate-x-0.5 transition-transform">
              ←
            </span>
            <span className="text-xs font-black uppercase tracking-widest">{am.back}</span>
          </button>

          <div className="flex gap-1.5 flex-1 ml-2">
            {[
              { label: am.stake, value: `${game.bet} ETB` },
              { label: am.win, value: `${game.possibleWin ?? 0} ETB` },
              { label: am.players, value: game.players.length },
              { label: "Balance", value: `${user?.balance ?? 0} ETB` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-1.5 text-center px-1"
              >
                <div className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">
                  {stat.label}
                </div>
                <div className="text-xs font-black tracking-tighter text-white">
                  {stat.value ?? '-'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-24">
        {/* Countdown / Game Status */}
        <div className="px-4 mt-3">
          <div className="py-1 bg-brand-primary/5 backdrop-blur-xl rounded-2xl border border-brand-primary/20 text-center">
            {game.status === 'waiting' ? (
              <div className="flex flex-row gap-3 items-center justify-center">
                <span className="text-xs font-black text-brand-primary uppercase tracking-widest">
                  {am.gameStartingIn}
                </span>
                <span className="text-2xl font-black text-white tracking-tighter animate-pulse">
                  {game.countdown?.running
                    ? `00:${game.countdown.secondsLeft.toString().padStart(2, '0')}`
                    : '--'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1 py-2">
                <span className="text-xs font-black text-brand-primary uppercase tracking-widest">
                  {am.gameStatus}
                </span>
                <span className="text-xl font-black text-white uppercase tracking-tighter">
                  {translateGameStatus(game.status)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Multi-Card Selection Bar */}
        <div className="px-5 mt-4 mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">
              Select Your Cartelas (Max 4)
            </h3>
            <p className="text-[10px] text-gray-500 font-bold">
              Tap to select or deselect. You can play multiple cards!
            </p>
          </div>
          <span className="text-xs font-black text-brand-secondary uppercase bg-brand-secondary/10 px-2.5 py-1 rounded-full border border-brand-secondary/20">
            {selectedCards.length} / 4 Selected
          </span>
        </div>

        {/* Selected Cards Chips */}
        {selectedCards.length > 0 && (
          <div className="px-4 mb-3 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-gray-400">
              Active:
            </span>
            {selectedCards.map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => setPreviewCardNumber(num)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border transition ${previewCardNumber === num
                  ? 'bg-brand-primary text-white border-brand-primary'
                  : 'bg-white/10 text-gray-300 border-white/10 hover:bg-white/15'
                  }`}
              >
                <span>#{num}</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardSelect(num);
                  }}
                  className="text-rose-400 hover:text-rose-200 ml-1 text-xs"
                >
                  ✕
                </span>
              </button>
            ))}
            <span className="text-xs font-black text-emerald-400 ml-auto">
              Total: {totalCost} ETB
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Card number grid 1-100 */}
          <div className="px-4 mb-4">
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 100 }, (_, i) => {
                const number = i + 1;
                const cardOccupied = takenCardNumbers.has(number);
                const isSelected = selectedCards.includes(number);
                const isPreview = previewCardNumber === number;

                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => handleCardSelect(number)}
                    disabled={cardOccupied || joining}
                    className={`
                      w-full aspect-square text-xs font-black rounded-lg transition-all duration-200 relative overflow-hidden flex items-center justify-center
                      ${isSelected
                        ? isPreview
                          ? 'bg-brand-primary text-white scale-110 shadow-lg ring-2 ring-white z-10'
                          : 'bg-brand-primary/80 text-white scale-105 z-10'
                        : cardOccupied
                          ? 'bg-rose-950/40 text-rose-800 cursor-not-allowed border border-rose-900/30'
                          : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    {number}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cartela Preview */}
          {chosenCartela && (
            <div className="px-4 pb-6">
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-5 border border-white/10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                  {am.previewCard}{' '}
                  <span className="text-brand-accent ml-2">#{chosenCartela.id}</span>
                </h3>

                <div className="flex justify-center">
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 5 }, (_, row) =>
                      chosenCartela.numbers.map((column, colIdx) => {
                        const currentNum = column[row];
                        return (
                          <div
                            key={`${chosenCartela.id}-${row}-${colIdx}`}
                            className={`w-11 h-11 flex items-center justify-center rounded-xl text-xs font-black
                              ${currentNum === 0
                                ? 'bg-brand-primary text-white shadow-lg animate-pulse'
                                : 'bg-white/5 text-gray-300 border border-white/5'
                              }
                            `}
                          >
                            {currentNum === 0 ? 'X' : currentNum}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Join Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-bg/95 backdrop-blur-md border-t border-white/10 px-4 py-3 z-50">
        <div className="flex gap-3 max-w-lg mx-auto items-center">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={joining}
            className="py-3.5 px-4 bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={handleJoinGame}
            disabled={
              selectedCards.length === 0 ||
              joining ||
              !connected ||
              game.status === 'started' ||
              (user?.balance ?? 0) < totalCost
            }
            className={`
              flex-1 py-3.5 font-black uppercase tracking-widest text-xs rounded-2xl active:scale-95 transition-all relative overflow-hidden shadow-xl
              ${selectedCards.length === 0 ||
                joining ||
                !connected ||
                game.status === 'started' ||
                (user?.balance ?? 0) < totalCost
                ? 'bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed'
                : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-brand-primary/20'
              }
            `}
          >
            {joining ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                {am.initializing}
              </div>
            ) : !connected ? (
              am.linkError
            ) : selectedCards.length === 0 ? (
              "Select At Least 1 Card"
            ) : (user?.balance ?? 0) < totalCost ? (
              "Insufficient Balance"
            ) : (
              `Confirm Entry (${selectedCards.length} ${selectedCards.length === 1 ? 'Card' : 'Cards'
              } • ${totalCost} ETB)`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
