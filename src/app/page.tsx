'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Wallet, RefreshCw } from 'lucide-react';
import { useSocket } from '../context/SocketContext';
import { useGames } from '../context/gameContext';
import { useAuth } from '../context/AuthContext';
import { GameSession, UserSafeType } from '../types/game';
import { SELECTED_GAME_DATA } from '../constants/configurations';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../constants/amharic';
import TopBar from '../components/TopBar';
import { needsDisplayName } from '../lib/player';

export default function PlayPage() {
  const router = useRouter();
  const bets = [10, 50, 100, 300];
  const [rejoinData, setRejoinData] = useState<{ gameId: string; bet: number } | null>(null);
  const [balanceRefreshing, setBalanceRefreshing] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const { connected } = useSocket();
  const { refreshUser, user: authUser } = useAuth();
  const { user, games, gameLoading, userLoading, error, watchGame } = useGames() as {
    user: UserSafeType | null;
    games: Record<number, GameSession>;
    gameLoading: boolean;
    userLoading: boolean;
    error: string | null;
    watchGame: (bet: number) => void;
  };

  const player = user || authUser;
  const showNameBanner = needsDisplayName(player);

  useEffect(() => {
    if (player?.balance != null) {
      setWalletBalance(Number(player.balance));
    }
  }, [player?.balance]);

  const handleRefreshBalance = async () => {
    if (!player?.id || balanceRefreshing) return;
    setBalanceRefreshing(true);
    try {
      const next = await refreshUser();
      if (next) setWalletBalance(Number(next.balance ?? 0));
    } catch {
      toast.error(am.networkError);
    } finally {
      setBalanceRefreshing(false);
    }
  };

  useEffect(() => {
    if (player && games) {
      const activeGame = Object.values(games).find(
        (game) =>
          game.players.some(
            (p) =>
              p.id === player.id ||
              (!!player.telegramId &&
                (p.id === player.telegramId || p.telegramId === player.telegramId))
          ) && game.status !== 'finished'
      );

      if (activeGame) {
        setRejoinData({ gameId: activeGame.id, bet: activeGame.bet });
      } else {
        setRejoinData(null);
      }
    }
  }, [player, games]);

  const handleSelectBet = (gameId: string, bet: number) => {
    sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({ gameId, bet }));

    if (connected) {
      watchGame(bet);
    } else {
      toast.warn(am.notConnected);
    }

    router.push('/cards');
  };

  return (
    <div className="flex-1 min-h-screen bg-brand-bg text-white flex flex-col">
      <TopBar subtitle={am.playSubtitle} />

      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {showNameBanner && (
          <div className="px-4 pt-4">
            <Link
              href="/profile"
              className="block rounded-2xl border border-brand-accent/30 bg-brand-accent/10 px-4 py-3 hover:bg-brand-accent/15 transition"
            >
              <p className="text-sm font-black text-brand-accent">{am.needsNameBanner}</p>
              <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest font-bold">
                {am.viewProfile} →
              </p>
            </Link>
          </div>
        )}

        <div className="px-4 py-4">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex items-center justify-between shadow-2xl relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-brand-accent" />
              </div>
              <div>
                <span className="text-gray-400 text-xs font-bold uppercase tracking-wider block">
                  {am.walletBalance}
                </span>
                <span className="font-black text-white text-lg">
                  {userLoading || balanceRefreshing ? (
                    <span className="inline-block w-20 h-6 bg-white/10 rounded animate-pulse" />
                  ) : (
                    `${Number(walletBalance ?? player?.balance ?? 0).toLocaleString()} ${am.etb}`
                  )}
                </span>
              </div>
            </div>
            <div className="relative z-10 flex items-center gap-2">
              <button
                onClick={handleRefreshBalance}
                disabled={balanceRefreshing || userLoading}
                className="bg-white/5 hover:bg-white/10 p-2 rounded-xl transition-colors border border-white/5 disabled:opacity-50"
                aria-label={am.refresh}
              >
                <RefreshCw
                  className={`w-4 h-4 text-brand-accent ${balanceRefreshing ? 'animate-spin' : ''}`}
                />
              </button>
              <button
                onClick={() => router.push('/wallet')}
                className="bg-brand-primary/20 hover:bg-brand-primary/30 px-3 py-2 rounded-xl transition-colors border border-brand-primary/30 text-xs font-black uppercase tracking-widest text-brand-accent"
              >
                {am.walletTitle}
              </button>
            </div>
          </div>
        </div>

        <div className="px-4">
          <h2 className="text-lg font-black tracking-tight mb-3">{am.playHeadline}</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500 rounded-lg p-3 mb-3">
              <div className="text-red-300 text-sm">{error}</div>
            </div>
          )}

          <div className="mt-2 mb-6 space-y-3">
            {rejoinData && (
              <motion.button
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => router.push('/game')}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 p-3 rounded-xl flex items-center justify-between shadow-lg"
              >
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-white">{am.rejoinActiveGame}</span>
                  <span className="text-xs text-green-100">
                    {am.betLabel}: {rejoinData.bet} ETB
                  </span>
                </div>
                <div className="bg-white/20 p-2 rounded-lg text-sm font-black">→</div>
              </motion.button>
            )}

            <div className="lobby-table">
              <div className="lobby-table-header">
                <span>{am.colStake}</span>
                <span className="text-center">{am.colActive}</span>
                <span className="text-center">{am.colPlayers}</span>
                <span className="text-center">{am.colDerash}</span>
                <span className="text-right">{am.colPlay}</span>
              </div>

              <div className="space-y-2 p-2">
                {bets.map((betAmount) => {
                  const game = games[betAmount];
                  const id = game?.id || `offline-${betAmount}`;
                  const bet = game?.bet || betAmount;
                  const playersCount = game?.players?.length || 0;
                  const status = game?.status || 'offline';
                  const isOffline = !game;
                  const balance = Number(walletBalance ?? player?.balance ?? 0);
                  const isLowBalance = !isOffline && balance < bet;
                  const isActiveGame =
                    status === 'started' || !!game?.countdown?.running;
                  const derash =
                    game?.possibleWin ??
                    (playersCount > 0 ? Math.floor(playersCount * bet * 0.8) : 0);
                  const canPlay = status !== 'finished' && !isOffline;

                  return (
                    <div
                      key={id}
                      className={isOffline ? 'lobby-table-row is-offline' : 'lobby-table-row'}
                    >
                      <div className="font-bold text-sm sm:text-base text-white leading-tight">
                        {bet} <span className="text-xs font-semibold opacity-80">ETB</span>
                      </div>

                      <div className="flex flex-col items-center justify-center gap-1 min-h-10">
                        {isActiveGame && (
                          <span className="lobby-active-badge">
                            <span className="lobby-active-badge-label">
                              {am.activeGameBadge}
                            </span>
                            <span className="lobby-active-badge-dot">
                              <span />
                            </span>
                          </span>
                        )}
                        {isLowBalance && (
                          <span className="text-xs text-slate-400 font-medium">
                            {am.lowBalance}
                          </span>
                        )}
                        {!isActiveGame && !isLowBalance && (
                          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                            {status === 'offline'
                              ? am.offline
                              : translateGameStatus(status)}
                          </span>
                        )}
                      </div>

                      <div className="text-center font-bold text-sm sm:text-base text-white">
                        {playersCount}
                      </div>

                      <div className="text-center font-bold text-sm sm:text-base text-white leading-tight">
                        {derash.toLocaleString()}{' '}
                        <span className="text-xs font-semibold opacity-80">ETB</span>
                      </div>

                      <div className="flex justify-end">
                        <button
                          onClick={() => canPlay && handleSelectBet(id, bet)}
                          disabled={!canPlay}
                          className={canPlay ? 'lobby-play-btn is-ready' : 'lobby-play-btn'}
                        >
                          {status === 'finished'
                            ? am.finalized
                            : isOffline
                              ? am.unavailable
                              : am.play}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {(gameLoading || Object.keys(games).length === 0) && (
              <div className="text-center py-8 text-gray-400 animate-pulse">
                <div className="h-6 bg-gray-600/40 rounded w-48 mx-auto mb-2" />
                <div className="h-4 bg-gray-700/40 rounded w-32 mx-auto" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
