'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import cartelasData from '../../data/cartelas.json';
import { useSocket } from '../../context/SocketContext';
import { useGames } from '../../context/gameContext';
import { Cartela } from '../../types/game';
import { PLAYER_GAME_DATA, SELECTED_GAME_DATA } from '../../constants/configurations';
import { toast } from 'react-toastify';
import { am, translateGameStatus } from '../../constants/amharic';
import { getDisplayName } from '../../lib/player';
import { useAppNavigation } from '../../context/NavigationContext';

// Card states: 'idle' | 'pendingAdd' | 'confirmed' | 'pendingRemove'
type CardState = 'pendingAdd' | 'confirmed' | 'pendingRemove';

export default function CardsPage() {
  const router = useRouter();
  const appNav = useAppNavigation(); // null when accessed via /cards directly

  // Map of cardNumber -> state for cards the user has interacted with
  // Cards not in this map are 'idle'
  const [cardStates, setCardStates] = useState<Map<number, CardState>>(new Map());
  // Server-confirmed cards (ground truth from backend)
  const [serverCards, setServerCards] = useState<Set<number>>(new Set());
  // Track if we want to cancel an in-flight add (quick add then remove)
  const cancelAddRef = useRef<Set<number>>(new Set());

  const [previewCardNumber, setPreviewCardNumber] = useState<number | null>(null);
  const [cartelasList, setCartelasList] = useState<Cartela[]>(cartelasData as Cartela[]);
  const [activeBet, setActiveBet] = useState<number>(10);

  const { connected } = useSocket();
  const { user, games, currentGame, joinGame, removeCard, watchGame } = useGames();
  const activeGame = (activeBet && games && games[activeBet]) || currentGame;
  const game = activeGame || {
    id: `temp-${activeBet}`,
    bet: activeBet,
    players: [],
    status: 'waiting' as const,
    calledNumbers: [] as number[],
    possibleWin: activeBet,
    bonus: 0,
    maxPlayers: 10,
    countdown: { running: false, secondsLeft: 0 },
  };

  // The visible "my cards" is: serverCards + pendingAdds - pendingRemoves
  const myCardsSet = useMemo(() => {
    const result = new Set(serverCards);
    cardStates.forEach((state, num) => {
      if (state === 'pendingAdd') result.add(num);
      if (state === 'pendingRemove') result.delete(num);
    });
    return result;
  }, [serverCards, cardStates]);

  const setCardState = (num: number, state: CardState | null) => {
    setCardStates(prev => {
      const next = new Map(prev);
      if (state === null) next.delete(num);
      else next.set(num, state);
      return next;
    });
  };

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
          } catch { }
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

  // Check if current user is already registered in this active game session
  const myExistingPlayer = currentGame?.players.find(
    (p) =>
      (user?.id && p.id === user.id) ||
      (user?.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId))
  );

  const chosenCartela =
    previewCardNumber != null
      ? cartelasList.find((c) => c.id === previewCardNumber) ?? null
      : null;

  // Sync server-confirmed cards from game state
  // We track hasPendingOps to avoid overwriting in-flight local state
  const hasPendingOps = useMemo(() => {
    for (const [, state] of cardStates) {
      if (state === 'pendingAdd' || state === 'pendingRemove') return true;
    }
    return false;
  }, [cardStates]);

  useEffect(() => {
    if (!user) return;

    const confirmed: number[] = [];
    game.players.forEach((p) => {
      const isMe =
        (user.id && p.id === user.id) ||
        (user.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId));
      if (isMe) {
        if (p.cardNumber) confirmed.push(p.cardNumber);
        if (p.cardNumbers) confirmed.push(...p.cardNumbers);
      }
    });

    const confirmSet = new Set(confirmed);

    setServerCards(prev => {
      // Only update if actually changed (avoid unnecessary renders)
      if (prev.size === confirmSet.size && [...confirmSet].every(n => prev.has(n))) return prev;
      return confirmSet;
    });

    // Clear pendingAdd states for cards now confirmed by server
    // Clear pendingRemove states for cards now confirmed removed by server
    setCardStates(prev => {
      let changed = false;
      const next = new Map(prev);
      for (const [num, state] of prev) {
        if (state === 'pendingAdd' && confirmSet.has(num)) {
          next.delete(num);
          changed = true;
        }
        if (state === 'pendingRemove' && !confirmSet.has(num)) {
          next.delete(num);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [game.players, user]);

  // Cards taken by OTHER players
  const takenByOthers = useMemo(() => {
    const taken = new Set<number>();
    game.players.forEach((p) => {
      const isMe =
        user &&
        ((user.id && p.id === user.id) ||
          (user.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId)));
      if (!isMe) {
        if (p.cardNumber) taken.add(p.cardNumber);
        if (p.cardNumbers) p.cardNumbers.forEach((cn) => taken.add(cn));
      }
    });
    return taken;
  }, [game.players, user]);

  // Keep a ref to myCardsSet so saveAndNavigate doesn't recreate on every render
  const myCardsSetRef = useRef(myCardsSet);
  useEffect(() => { myCardsSetRef.current = myCardsSet; }, [myCardsSet]);

  // Keep a ref to myExistingPlayer to avoid stale closure in saveAndNavigate
  const myExistingPlayerRef = useRef(myExistingPlayer);
  useEffect(() => { myExistingPlayerRef.current = myExistingPlayer; }, [myExistingPlayer]);

  // ---- Navigation ----
  const hasNavigatedRef = useRef(false);

  const saveAndNavigate = useCallback(() => {
    if (hasNavigatedRef.current) return;
    hasNavigatedRef.current = true;

    if (currentGame && user) {
      const ep = myExistingPlayerRef.current;
      const serverNums = ep
        ? (ep.cardNumbers?.length
          ? ep.cardNumbers
          : ep.cardNumber ? [ep.cardNumber] : [])
        : [];
      // Merge server cards + any locally confirmed cards
      const allCardNums = Array.from(new Set([...serverNums, ...myCardsSetRef.current]));

      if (allCardNums.length > 0) {
        const resolvedCards = allCardNums
          .map(cn =>
            cartelasList.find((c) => c.id === cn) ||
            (cartelasData as Cartela[]).find((c) => c.id === cn)
          )
          .filter(Boolean) as Cartela[];

        sessionStorage.setItem(PLAYER_GAME_DATA, JSON.stringify({
          gameId: currentGame.id,
          userId: user.id,
          telegramId: user.telegramId || user.id,
          playerName: getDisplayName(user),
          playerId: user.id,
          cardNumber: allCardNums[0],
          cardNumbers: allCardNums,
          cards: resolvedCards,
          bet: currentGame.bet,
        }));
      }
    }

    // Use in-app navigation when inside the SPA root shell (instant, no fetch)
    // Fall back to Next.js router when accessed via /cards directly
    if (appNav) {
      appNav.navigateTo('/game');
    } else {
      router.push('/game');
    }
  }, [currentGame, user, cartelasList, router, appNav]);

  // Navigate when game starts or is already started
  useEffect(() => {
    if (game.status === 'started') {
      // Small delay to ensure session storage is written before navigation
      const t = setTimeout(() => saveAndNavigate(), 100);
      return () => clearTimeout(t);
    }
  }, [game.status, saveAndNavigate]);

  // Navigate when countdown hits 0
  const pageMountTimeRef = useRef(Date.now());
  useEffect(() => {
    if (
      game.countdown?.running &&
      game.countdown.secondsLeft === 0 &&
      Date.now() - pageMountTimeRef.current > 1500
    ) {
      saveAndNavigate();
    }
  }, [game.countdown?.running, game.countdown?.secondsLeft, saveAndNavigate]);

  // ---- Card selection handler ----
  const handleCardSelect = async (number: number) => {
    setPreviewCardNumber(number);

    const currentState = cardStates.get(number);
    const isConfirmed = serverCards.has(number);
    const currentBet = currentGame?.bet || game.bet || 10;

    // Block clicks on cards that are mid-flight
    if (currentState === 'pendingAdd') {
      // User wants to cancel an in-progress add — mark it for cancellation
      // The add handler will remove it after the server responds
      cancelAddRef.current.add(number);
      // Optimistically hide it immediately
      setCardState(number, 'pendingRemove');
      return;
    }
    if (currentState === 'pendingRemove') {
      // Already being removed — ignore
      return;
    }

    // --- CASE A: Confirmed by server -> Remove ---
    if (isConfirmed || currentState === 'confirmed') {
      setCardState(number, 'pendingRemove');

      try {
        const result = await removeCard(currentBet, {
          gameId: currentGame?.id || game.id,
          playerId: user?.id || '',
          cardNumber: number,
          userId: user?.id,
          telegramId: user?.telegramId || undefined,
        });

        if (!result.success) {
          setCardState(number, null); // revert — card is still there
          toast.error(result.error || 'Failed to remove card');
        } else {
          // Keep pendingRemove in state until server sync confirms it's removed
          setServerCards(prev => { const n = new Set(prev); n.delete(number); return n; });
          // Update session storage
          const remaining = Array.from(myCardsSet).filter(n => n !== number);
          const resolved = remaining
            .map(num =>
              cartelasList.find((c) => c.id === num) ||
              (cartelasData as Cartela[]).find((c) => c.id === num)
            )
            .filter(Boolean) as Cartela[];
          if (remaining.length > 0 && currentGame && user) {
            sessionStorage.setItem(PLAYER_GAME_DATA, JSON.stringify({
              gameId: currentGame.id,
              userId: user.id,
              telegramId: user.telegramId || user.id,
              playerName: getDisplayName(user),
              playerId: user.id,
              cardNumber: remaining[0],
              cardNumbers: remaining,
              cards: resolved,
              bet: currentBet,
            }));
          } else {
            sessionStorage.removeItem(PLAYER_GAME_DATA);
          }
        }
      } catch (err) {
        console.error('Error removing card:', err);
        setCardState(number, null); // revert
      }
      return;
    }

    // --- CASE B: Idle -> Add ---
    if (takenByOthers.has(number)) {
      toast.error('ይህ ካርቴላ በሌላ ተጫዋች ተይዟል (Card already taken)');
      return;
    }
    if (game.status === 'started') {
      toast.error('ጨዋታው ቀድሞውኑ ተጀምሯል');
      return;
    }
    if (myCardsSet.size >= 4) {
      toast.error('Maximum 4 cards per game');
      return;
    }
    if ((user?.balance ?? 0) < currentBet) {
      toast.error('Insufficient balance for another card');
      return;
    }
    if (!connected || !currentGame || !user) {
      toast.error(am.notConnectedServer || 'Not connected to game server');
      return;
    }

    setCardState(number, 'pendingAdd');

    try {
      const playerName = getDisplayName(user);
      const playerId = user.id;

      const result = await joinGame(currentBet, {
        gameId: currentGame.id,
        playerName,
        playerId,
        cardNumber: number,
        cardNumbers: [number],
        userId: user.id,
        telegramId: user.telegramId || undefined,
      });

      if (!result.success) {
        setCardState(number, null);
        cancelAddRef.current.delete(number);
        toast.error(result.error || am.failedToJoin);
      } else {
        // Check if user cancelled this card while it was being added
        if (cancelAddRef.current.has(number)) {
          cancelAddRef.current.delete(number);
          // Now actually remove it since the add succeeded
          setCardState(number, 'pendingRemove');
          try {
            await removeCard(currentBet, {
              gameId: currentGame.id,
              playerId: user.id,
              cardNumber: number,
              userId: user.id,
              telegramId: user.telegramId || undefined,
            });
          } catch { /* ignore */ }
          setCardState(number, null);
          setServerCards(prev => { const n = new Set(prev); n.delete(number); return n; });
          return;
        }

        // Add confirmed — keep pendingAdd until server sync verifies, but record in serverCards
        setServerCards(prev => new Set([...prev, number]));

        const allCardNums = Array.from(new Set([...myCardsSet, number]));
        const resolvedCards = allCardNums
          .map(num =>
            cartelasList.find((c) => c.id === num) ||
            (cartelasData as Cartela[]).find((c) => c.id === num)
          )
          .filter(Boolean) as Cartela[];

        sessionStorage.setItem(PLAYER_GAME_DATA, JSON.stringify({
          gameId: currentGame.id,
          userId: user.id,
          telegramId: user.telegramId || user.id,
          playerName,
          playerId,
          cardNumber: allCardNums[0],
          cardNumbers: allCardNums,
          cards: resolvedCards,
          bet: currentBet,
        }));
      }
    } catch (err) {
      console.error('Error confirming card:', err);
      setCardState(number, null);
      cancelAddRef.current.delete(number);
      toast.error(am.failedToJoinRetry);
    }
  };

  const totalCardsCount = (game.players || []).reduce(
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

  const displayWin =
    game.possibleWin ||
    (game.players.length <= 1
      ? (totalCardsCount || 1) * game.bet
      : Math.floor((totalCardsCount || 1) * game.bet * 0.8));

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

      {/* Top Header Bar (Temeles removed, players = total cards chosen) */}
      <div className="sticky top-0 z-40 w-full bg-white/5 backdrop-blur-2xl border-b border-white/5 shadow-2xl">
        <div className="p-3">
          <div className="flex gap-1.5 w-full">
            {[
              { label: am.stake, value: `${game.bet} ETB` },
              { label: am.win, value: `${displayWin} ETB` },
              { label: am.players, value: totalCardsCount },
              { label: 'Balance', value: `${user?.balance ?? 0} ETB` },
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

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-28">
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
                    ? `${Math.floor((game.countdown.secondsLeft || 0) / 60)
                      .toString()
                      .padStart(2, '0')}:${((game.countdown.secondsLeft || 0) % 60)
                        .toString()
                        .padStart(2, '0')}`
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
              Tap a card to select or deselect. You can play up to 4 cards!
            </p>
          </div>
          <span className="text-xs font-black text-brand-secondary uppercase bg-brand-secondary/10 px-2.5 py-1 rounded-full border border-brand-secondary/20">
            {myCardsSet.size} / 4 Selected
          </span>
        </div>

        {/* Registered Cards Chips */}
        {myCardsSet.size > 0 && (
          <div className="px-4 mb-3 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
              Selected:
            </span>
            {Array.from(myCardsSet).map((num) => (
              <button
                key={`my-${num}`}
                type="button"
                onClick={() => handleCardSelect(num)}
                title="Click to remove card"
                className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border transition ${previewCardNumber === num
                  ? 'bg-emerald-500 text-white border-emerald-400'
                  : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                  }`}
              >
                <span>#{num}</span>
                <span className="text-[10px] text-rose-300 ml-0.5">✕</span>
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Card number grid 1-100 */}
          <div className="px-4 mb-4">
            <div className="grid grid-cols-10 gap-1.5">
              {Array.from({ length: 100 }, (_, i) => {
                const number = i + 1;
                const isMyRegisteredCard = myCardsSet.has(number);
                const isTakenByOther = takenByOthers.has(number) && !isMyRegisteredCard;
                const isPreview = previewCardNumber === number;

                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => handleCardSelect(number)}
                    disabled={isTakenByOther}
                    className={`
                      w-full aspect-square text-xs font-black rounded-lg transition-all duration-200 relative overflow-hidden flex items-center justify-center
                      ${isMyRegisteredCard
                        ? 'bg-emerald-500/25 text-emerald-300 border-2 border-emerald-400 ring-2 ring-emerald-400/30 z-10 scale-105'
                        : isPreview
                          ? 'bg-white/15 text-white scale-105 border border-white/20'
                          : isTakenByOther
                            ? 'bg-rose-950/40 text-rose-800 cursor-not-allowed border border-rose-900/30'
                            : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    {number}
                    {isMyRegisteredCard && (
                      <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
                    )}
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

      {/* Sticky Bottom Status Bar (No action buttons needed) */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-bg/95 backdrop-blur-md border-t border-white/10 px-4 py-3 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between text-xs font-black">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 uppercase tracking-wider">የተመረጡ ካርቴላዎች:</span>
            <span className="text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              {myCardsSet.size} / 4
            </span>
          </div>
          <div className="text-amber-400 text-[11px] font-bold flex items-center gap-1.5">
            {game.countdown?.running ? (
              <>
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>
                  ጨዋታው በ {game.countdown.secondsLeft || 0}s ይጀምራል...
                </span>
              </>
            ) : (
              <span className="text-gray-400">ተጫዋቾችን በመጠበቅ ላይ...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
