
'use client'
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import cartelas from '../../data/cartelas.json';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
// import toast from 'react-hot-toast';
import { PLAYER_GAME_DATA, SELECTED_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';

export default function CardsPage() {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [chosenCartela, setChosenCartela] = useState<Cartela | null>(null);
  const [joining, setJoining] = useState(false);

  const { socket, connected } = useSocket();
  const { user, currentGame, setCurrentGame, joinGame, watchGame } = useGames();

  // Subscribe to the game updates on mount
  useEffect(() => {
    const storedGameData = sessionStorage.getItem(SELECTED_GAME_DATA);

    if (storedGameData) {
      const parsed = JSON.parse(storedGameData);
      if (parsed.bet) {
        watchGame(parsed.bet); // start watching
      } else {
        router.push('/');
      }
    } else {
      router.push('/');
    }
  }, [router, watchGame, currentGame]);


  // Update chosen cartela if selectedCard changes
  useEffect(() => {
    if (selectedCard != null) {
      setChosenCartela(cartelas[selectedCard - 1]);
    }
  }, [selectedCard]);

  const handleBack = () => router.push('/');

  const handleCardSelect = (number: number) => {
    setSelectedCard(number);
  };

  const handleJoinGame = async (cardNumber: number) => {
    if (!connected || !currentGame || !user || joining) return;

    setJoining(true);

    try {
      const playerName = getDisplayName(user);
      const playerId = user.id;

      const result = await joinGame(currentGame.bet, {
        gameId: currentGame.id,
        playerName,
        playerId,
        cardNumber,
        userId: user.id,
        telegramId: user.telegramId || undefined,
      });

      if (result.success) {
        sessionStorage.setItem(
          PLAYER_GAME_DATA,
          JSON.stringify({
            gameId: currentGame.id,
            userId: user.id,
            telegramId: user.telegramId || user.id,
            playerName,
            playerId,
            cardNumber,
            bet: currentGame.bet,
          })
        );
        router.push(`/game`);
      } else {
        toast.error(result.error || am.failedToJoin);
      }
    } catch (error) {
      console.error('Error joining game:', error);
      toast.error(am.failedToJoinRetry);
    } finally {
      setJoining(false);
    }
  };

  const handleRefresh = () => {
    setSelectedCard(null);
    setChosenCartela(null);
  };

  // Force re-render if currentGame.id changes to avoid stale state
  if (!currentGame) return null;

  return (
    <div key={currentGame.id} className="min-h-screen bg-brand-bg text-white flex flex-col">
      {/* Top Status */}
      <div
        className={`sticky top-0 z-50 text-center py-2 text-[10px] font-black tracking-widest uppercase transition-colors duration-500 ${connected
          ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20 backdrop-blur-md'
          : 'bg-rose-500/10 text-rose-400 border-b border-rose-500/20 backdrop-blur-md'
          }`}
      >
        <div className="flex items-center justify-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse' : 'bg-current'}`} />
          {connected ? am.systemLive : am.disconnected}
        </div>
      </div>

      {/* Header */}
      <div className="sticky top-0 z-40 w-full bg-white/[0.02] backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="flex items-center justify-between p-3 gap-2">
          <button onClick={handleBack} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all active:scale-95 group">
            <span className="text-brand-primary group-hover:-translate-x-0.5 transition-transform">←</span>
            <span className="text-[10px] font-black uppercase tracking-widest">{am.back}</span>
          </button>

          <div className="flex gap-1.5 flex-1 ml-2">
            {[
              { label: am.stake, value: currentGame.bet },
              { label: am.win, value: currentGame.possibleWin },
              { label: am.players, value: currentGame.players.length }
            ].map((stat, i) => (
              <div key={i} className="flex-1 bg-white/[0.03] border border-white/5 rounded-xl py-1.5 text-center px-1">
                <div className="text-[7px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">{stat.label}</div>
                <div className="text-[11px] font-black tracking-tighter text-white">{stat.value ?? '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Countdown */}
        <div className="px-4 mt-3">
          <div className="py-1 bg-brand-primary/5 backdrop-blur-xl rounded-2xl border border-brand-primary/20 text-center shadow-[0_0_20px_rgba(99,102,241,0.1)]">
            {currentGame.status === 'waiting' ? (
              <div className="flex flex-row gap-3 items-center justify-center">
                <span className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em]">{am.gameStartingIn}</span>
                <span className="text-2xl font-black text-white tracking-tighter animate-pulse">
                  {currentGame.countdown?.running ? `00:${currentGame.countdown.secondsLeft.toString().padStart(2, '0')}` : '--'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em]">{am.gameStatus}</span>
                <span className="text-xl font-black text-white uppercase tracking-tighter">{translateGameStatus(currentGame.status)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Number Grid Label */}
        <div className="px-5 mt-8 mb-4 flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">{am.selectYourNumber}</h3>
          <span className="text-[9px] font-black text-brand-secondary uppercase bg-brand-secondary/5 px-2 py-0.5 rounded-full border border-brand-secondary/10">1 - 100</span>
        </div>

        {/* Number Grid */}
        <div className="px-4 mb-8">
          <div className="grid grid-cols-10 gap-1.5">
            {Array.from({ length: 100 }, (_, i) => {
              const number = i + 1;
              const cardOccupied = currentGame.players.some((p) => p.cardNumber === number);
              const isSelected = selectedCard === number;

              return (
                <button
                  key={number}
                  onClick={() => handleCardSelect(number)}
                  disabled={cardOccupied}
                  className={`
                    w-full aspect-square text-[11px] font-black rounded-lg transition-all duration-300 relative overflow-hidden flex items-center justify-center
                    ${isSelected
                      ? 'bg-brand-primary text-white scale-110 shadow-lg shadow-brand-primary/40 z-10'
                      : cardOccupied
                        ? 'bg-white/[0.02] text-gray-700 cursor-not-allowed border border-white/[0.02]'
                        : 'bg-white/[0.05] text-gray-400 border border-white/[0.05] hover:bg-white/[0.1] hover:text-white'}
                  `}
                >
                  {number}
                  {isSelected && <div className="absolute inset-0 bg-white/10 animate-[pulse_1s_infinite]" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Show Selected Card Details */}
        {selectedCard && chosenCartela && (
          <div className="px-4 pb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.03] backdrop-blur-2xl rounded-3xl p-6 border border-white/10 shadow-3xl text-center relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-[40px]" />

              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-6">
                {am.previewCard} <span className="text-brand-accent ml-2">#{selectedCard}</span>
              </h3>

              <div className="flex justify-center">
                <div className="grid grid-cols-5 gap-1.5">
                  {Array.from({ length: 5 }, (_, row) =>
                    chosenCartela.numbers.map((array, idx) => {
                      const currentNum = array[row];
                      return (
                        <div
                          key={idx}
                          className={`w-11 h-11 flex items-center justify-center rounded-xl text-xs font-black transition-all duration-500
                            ${currentNum === 0
                              ? 'bg-brand-primary text-white shadow-lg shadow-brand-primary/20 animate-pulse'
                              : 'bg-white/[0.05] text-gray-400 border border-white/5'}
                          `}
                        >
                          {currentNum === 0 ? 'X' : currentNum}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="sticky bottom-0 bg-brand-bg/80 backdrop-blur-md border-t border-white/5 px-4 pb-8 pt-4">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            onClick={handleRefresh}
            className="flex-1 py-4 bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 font-black uppercase tracking-widest text-[10px] rounded-2xl transition-all active:scale-95 shadow-xl"
          >
            {am.refresh}
          </button>

          <button
            onClick={() => selectedCard && handleJoinGame(selectedCard)}
            disabled={!selectedCard || joining || !connected || currentGame.status === 'started'}
            className={`
              flex-[2] py-4 font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl active:scale-[0.98] transition-all relative overflow-hidden shadow-2xl
              ${!selectedCard || joining || !connected || currentGame.status === 'started'
                ? 'bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed'
                : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-brand-primary/20'}
            `}
          >
            {joining ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                {am.initializing}
              </div>
            ) : !connected ? (
              am.linkError
            ) : (
              am.confirmEntry
            )}
            {!(!selectedCard || joining || !connected || currentGame.status === 'started') && (
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] animate-[shine_2s_infinite]" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
