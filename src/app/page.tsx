'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { SELECTED_GAME_DATA, PLAYER_GAME_DATA } from '../constants/configurations';
import { useGames } from '../context/gameContext';

/**
 * Root "/" page — smart redirect hub.
 *
 * Rules (checked in priority order):
 *  1. If the player has PLAYER_GAME_DATA in session AND the matching game is
 *     currently "started"  → /game
 *  2. If the player has PLAYER_GAME_DATA but the game is "waiting" (countdown)
 *     → /game  (they'll see the waiting banner there)
 *  3. If ANY game is "started" but the player has no session data
 *     → /cards?bet=X  (spectator; cards page handles the "game live" banner)
 *  4. Otherwise (waiting lobby, finished, or no active game)
 *     → /cards?bet=X
 *
 * We wait at most 2 s for the context to settle before falling through to /cards.
 */
export default function RootPage() {
  const router = useRouter();
  const { games, currentGame, userLoading, gameLoading } = useGames();
  const redirectedRef = useRef(false);

  // Helper: resolve the target bet from URL params → session storage → localStorage
  const resolveBet = (): number => {
    if (typeof window === 'undefined') return 20;
    const params = new URLSearchParams(window.location.search);
    const queryBet = params.get('bet') || params.get('stake');
    if (queryBet && !isNaN(Number(queryBet))) return Number(queryBet);

    try {
      const stored =
        sessionStorage.getItem(SELECTED_GAME_DATA) ||
        localStorage.getItem('lastBet');
      if (stored) {
        const parsed = stored.startsWith('{') ? JSON.parse(stored) : null;
        if (parsed?.bet && !isNaN(Number(parsed.bet))) return Number(parsed.bet);
        if (!isNaN(Number(stored))) return Number(stored);
      }
    } catch { }
    return 20;
  };

  const navigate = (path: string) => {
    if (redirectedRef.current) return;
    redirectedRef.current = true;
    router.replace(path);
  };

  useEffect(() => {
    // Still loading auth/games — wait
    if (userLoading || gameLoading) return;

    const betVal = resolveBet();

    // Persist bet choice
    try {
      sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({ bet: betVal }));
      localStorage.setItem('lastBet', String(betVal));
    } catch { }

    // ── Check PLAYER_GAME_DATA (player has previously joined a game) ──
    let playerSession: { gameId?: string; bet?: number } | null = null;
    try {
      const raw = sessionStorage.getItem(PLAYER_GAME_DATA);
      if (raw) playerSession = JSON.parse(raw);
    } catch { }

    if (playerSession?.gameId) {
      // Find the matching game in live state
      const allGames = Object.values(games || {});
      const matchedGame =
        allGames.find(g => g.id === playerSession!.gameId) ||
        currentGame;

      if (matchedGame) {
        if (matchedGame.status === 'started' || matchedGame.status === 'waiting') {
          // Player is mid-game or in countdown — go to game page
          navigate('/game');
          return;
        }
        if (matchedGame.status === 'finished') {
          // Game just finished — clear stale session and go to cards
          sessionStorage.removeItem(PLAYER_GAME_DATA);
          navigate(`/cards?bet=${matchedGame.bet || betVal}`);
          return;
        }
      } else {
        // Game not in live state yet (still loading or ended) — go to game page
        // The game page will handle the "no active game" redirect itself
        navigate('/game');
        return;
      }
    }

    // ── No player session: check if any game is currently running ──
    const allGames = Object.values(games || {});
    const startedGame = allGames.find(g => g.status === 'started');
    if (startedGame) {
      // A game is live — send to cards with the right bet so they can at least watch
      navigate(`/cards?bet=${startedGame.bet}`);
      return;
    }

    // Default: go to cards page with the resolved bet
    navigate(`/cards?bet=${betVal}`);
  }, [userLoading, gameLoading, games, currentGame, router]);

  // Fallback: if context takes > 2 s, just go to cards (avoid endless spinner)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!redirectedRef.current) {
        const betVal = resolveBet();
        navigate(`/cards?bet=${betVal}`);
      }
    }, 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex-1 min-h-screen bg-brand-bg text-white flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 rounded-full border-[3px] border-emerald-500/20 border-t-emerald-400 animate-spin mb-3" />
      <p className="text-xs font-bold text-gray-400 tracking-wider">
        ወደ ጨዋታ በመሸጋገር ላይ...
      </p>
    </div>
  );
}
