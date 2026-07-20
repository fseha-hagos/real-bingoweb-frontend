'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import cartelas from '../../data/cartelas.json';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
import { PLAYER_GAME_DATA, SELECTED_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';

export default function CardsPage() {
  const router = useRouter();
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [chosenCartela, setChosenCartela] = useState<Cartela | null>(null);
  const [joining, setJoining] = useState(false);

  const { connected } = useSocket();
  const { user, currentGame, joinGame, watchGame } = useGames();

  // Subscribe once on mount — do not re-run on every currentGame socket update
  useEffect(() => {
    const storedGameData = sessionStorage.getItem(SELECTED_GAME_DATA);

    if (!storedGameData) {
      router.replace('/');
      return;
    }

    try {
      const parsed = JSON.parse(storedGameData) as { bet?: number };
      if (parsed.bet) {
        watchGame(parsed.bet);
      } else {
        router.replace('/');
      }
    } catch {
      router.replace('/');
    }
  }, [router, watchGame]);

  useEffect(() => {
    if (selectedCard != null) {
      setChosenCartela(cartelas[selectedCard - 1] ?? null);
    } else {
      setChosenCartela(null);
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
        // Navigate without flipping joining back — avoids unmount + setState race
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
    setSelectedCard(null);
    setChosenCartela(null);
  };

  if (!currentGame) {
    return (
      <div className="min-h-screen bg-brand-bg text-white flex items-center justify-center">
        <div className="text-center text-gray-400 animate-pulse">
          <p className="text-sm font-bold">{am.initializing}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col">
      <div
        className={`sticky top-0 z-50 text-center py-2 text-xs font-black tracking-widest uppercase transition-colors duration-500 ${
          connected
            ? 'bg-emerald-500/10 text-emerald-400 border-b border-emerald-500/20 backdrop-blur-md'
            : 'bg-rose-500/10 text-rose-400 border-b border-rose-500/20 backdrop-blur-md'
        }`}
      >
        <div className="flex items-center justify-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              connected
                ? 'bg-emerald-400 animate-pulse'
                : 'bg-current'
            }`}
          />
          {connected ? am.systemLive : am.disconnected}
        </div>
      </div>

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
              { label: am.stake, value: currentGame.bet },
              { label: am.win, value: currentGame.possibleWin },
              { label: am.players, value: currentGame.players.length },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex-1 bg-white/5 border border-white/5 rounded-xl py-1.5 text-center px-1"
              >
                <div className="text-xs text-gray-500 font-black uppercase tracking-widest leading-none mb-1">
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

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        <div className="px-4 mt-3">
          <div className="py-1 bg-brand-primary/5 backdrop-blur-xl rounded-2xl border border-brand-primary/20 text-center">
            {currentGame.status === 'waiting' ? (
              <div className="flex flex-row gap-3 items-center justify-center">
                <span className="text-xs font-black text-brand-primary uppercase tracking-widest">
                  {am.gameStartingIn}
                </span>
                <span className="text-2xl font-black text-white tracking-tighter animate-pulse">
                  {currentGame.countdown?.running
                    ? `00:${currentGame.countdown.secondsLeft.toString().padStart(2, '0')}`
                    : '--'}
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-1 py-2">
                <span className="text-xs font-black text-brand-primary uppercase tracking-widest">
                  {am.gameStatus}
                </span>
                <span className="text-xl font-black text-white uppercase tracking-tighter">
                  {translateGameStatus(currentGame.status)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 mt-8 mb-4 flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">
            {am.selectYourNumber}
          </h3>
          <span className="text-xs font-black text-brand-secondary uppercase bg-brand-secondary/5 px-2 py-0.5 rounded-full border border-brand-secondary/10">
            1 - 100
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="px-4 mb-8">
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 100 }, (_, i) => {
                const number = i + 1;
                const cardOccupied = currentGame.players.some(
                  (p) => p.cardNumber === number
                );
                const isSelected = selectedCard === number;

                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => handleCardSelect(number)}
                    disabled={cardOccupied || joining}
                    className={`
                      w-full aspect-square text-xs font-black rounded-lg transition-all duration-200 relative overflow-hidden flex items-center justify-center
                      ${
                        isSelected
                          ? 'bg-brand-primary text-white scale-110 shadow-lg z-10'
                          : cardOccupied
                            ? 'bg-red-600 text-gray-300 cursor-not-allowed border border-white/5'
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

          {selectedCard != null && chosenCartela && (
            <div className="px-4 pb-12">
              <div className="bg-white/5 backdrop-blur-2xl rounded-3xl p-6 border border-white/10 text-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl pointer-events-none" />

                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-6">
                  {am.previewCard}{' '}
                  <span className="text-brand-accent ml-2">#{selectedCard}</span>
                </h3>

                <div className="flex justify-center">
                  <div className="grid grid-cols-5 gap-1.5">
                    {Array.from({ length: 5 }, (_, row) =>
                      chosenCartela.numbers.map((column, colIdx) => {
                        const currentNum = column[row];
                        return (
                          <div
                            key={`${selectedCard}-${row}-${colIdx}`}
                            className={`w-11 h-11 flex items-center justify-center rounded-xl text-xs font-black
                              ${
                                currentNum === 0
                                  ? 'bg-brand-primary text-white shadow-lg animate-pulse'
                                  : 'bg-white/5 text-gray-400 border border-white/5'
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

      <div className="sticky bottom-0 bg-brand-bg/80 backdrop-blur-md border-t border-white/5 px-4 pb-8 pt-4">
        <div className="flex gap-3 max-w-lg mx-auto">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={joining}
            className="flex-1 py-4 bg-white/5 border border-white/5 hover:bg-white/10 text-gray-400 font-black uppercase tracking-widest text-xs rounded-2xl transition-all active:scale-95"
          >
            {am.refresh}
          </button>

          <button
            type="button"
            onClick={() => selectedCard != null && handleJoinGame(selectedCard)}
            disabled={
              selectedCard == null ||
              joining ||
              !connected ||
              currentGame.status === 'started'
            }
            className={`
              flex-[2] py-4 font-black uppercase tracking-widest text-xs rounded-2xl active:scale-95 transition-all relative overflow-hidden
              ${
                selectedCard == null ||
                joining ||
                !connected ||
                currentGame.status === 'started'
                  ? 'bg-white/5 text-gray-700 border border-white/5 cursor-not-allowed'
                  : 'bg-brand-primary text-white hover:bg-brand-primary/90'
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
            ) : (
              am.confirmEntry
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
