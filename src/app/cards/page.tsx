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

export default function CardsPage() {
  const router = useRouter();

  // --- Stable card selection state (no flicker) ---
  // myCardsRef is the authoritative set; myCards is the React state derived from it
  const myCardsRef = useRef<Set<number>>(new Set());
  const [myCards, setMyCards] = useState<number[]>([]);
  // Count of in-flight add/remove operations — while > 0, server gameUpdate is ignored
  const inFlightRef = useRef(0);

  const addCard = useCallback((n: number) => {
    myCardsRef.current.add(n);
    setMyCards(Array.from(myCardsRef.current));
  }, []);

  const removeCardLocal = useCallback((n: number) => {
    myCardsRef.current.delete(n);
    setMyCards(Array.from(myCardsRef.current));
  }, []);

  const setCardsFromServer = useCallback((nums: number[]) => {
    // Only sync from server when no in-flight operations
    if (inFlightRef.current > 0) return;
    const next = new Set(nums);
    // Skip if unchanged to avoid unnecessary re-renders
    const cur = myCardsRef.current;
    if (cur.size === next.size && [...next].every((n) => cur.has(n))) return;
    myCardsRef.current = next;
    setMyCards(Array.from(next));
  }, []);

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

  const navigatingRef = useRef(false);

  const goToGame = useCallback(() => {
    if (navigatingRef.current) return;
    navigatingRef.current = true;

    if (currentGame && user) {
      const serverCards = myExistingPlayer
        ? (myExistingPlayer.cardNumbers && myExistingPlayer.cardNumbers.length > 0
          ? myExistingPlayer.cardNumbers
          : myExistingPlayer.cardNumber ? [myExistingPlayer.cardNumber] : [])
        : [];
      const allCardNums = Array.from(new Set([...serverCards, ...myCardsRef.current]));

      if (allCardNums.length > 0) {
        const resolvedCards = allCardNums
          .map(
            (cn) =>
              cartelasList.find((c) => c.id === cn) ||
              (cartelasData as Cartela[]).find((c) => c.id === cn)
          )
          .filter(Boolean) as Cartela[];

        sessionStorage.setItem(
          PLAYER_GAME_DATA,
          JSON.stringify({
            gameId: currentGame.id,
            userId: user.id,
            telegramId: user.telegramId || user.id,
            playerName: getDisplayName(user),
            playerId: user.id,
            cardNumber: allCardNums[0],
            cardNumbers: allCardNums,
            cards: resolvedCards,
            bet: currentGame.bet,
          })
        );
      }
    }

    router.push('/game');
    setTimeout(() => {
      navigatingRef.current = false;
    }, 3000);
  }, [currentGame, user, myExistingPlayer, cartelasList, router]);

  // If game is already active and started, navigate to game page immediately
  useEffect(() => {
    if (game.status === 'started') {
      goToGame();
    }
  }, [game.status, goToGame]);

  // When countdown timer reaches 0 during session, route to /game
  const pageMountTimeRef = useRef(Date.now());
  useEffect(() => {
    if (
      game.countdown?.running &&
      game.countdown.secondsLeft === 0 &&
      Date.now() - pageMountTimeRef.current > 1500
    ) {
      goToGame();
    }
  }, [game.countdown?.running, game.countdown?.secondsLeft, goToGame]);

  // Sync card list from server — skipped while any operation is in-flight
  useEffect(() => {
    if (!user) return;
    if (inFlightRef.current > 0) return; // Don't overwrite while add/remove is in-progress

    const serverCardNums: number[] = [];
    game.players.forEach((p) => {
      const isMe =
        (user.id && p.id === user.id) ||
        (user.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId));
      if (isMe) {
        if (p.cardNumber) serverCardNums.push(p.cardNumber);
        if (p.cardNumbers) serverCardNums.push(...p.cardNumbers);
      }
    });

    setCardsFromServer(serverCardNums);
  }, [game.players, user, setCardsFromServer]);

  const myCardsSet = useMemo(() => new Set(myCards), [myCards]);

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

  const handleCardSelect = async (number: number) => {
    setPreviewCardNumber(number);

    const isAlreadySelected = myCardsSet.has(number);
    const currentBet = currentGame?.bet || game.bet || 10;

    // --- CASE A: Already selected -> deselect ---
    if (isAlreadySelected) {
      inFlightRef.current += 1;
      removeCardLocal(number);

      try {
        const result = await removeCard(currentBet, {
          gameId: currentGame?.id || game.id,
          playerId: user?.id || '',
          cardNumber: number,
          userId: user?.id,
          telegramId: user?.telegramId || undefined,
        });

        if (!result.success) {
          addCard(number); // revert
          toast.error(result.error || 'Failed to remove card');
        } else {
          const remaining = Array.from(myCardsRef.current);
          const resolved = remaining
            .map((num) =>
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
        addCard(number); // revert
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
      }
      return;
    }

    // --- CASE B: Not selected -> select ---

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

    inFlightRef.current += 1;
    addCard(number);

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
        removeCardLocal(number); // revert
        toast.error(result.error || am.failedToJoin);
      } else {
        const allCardNums = Array.from(myCardsRef.current);
        const resolvedCards = allCardNums
          .map((num) =>
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
      removeCardLocal(number); // revert
      toast.error(am.failedToJoinRetry);
    } finally {
      inFlightRef.current = Math.max(0, inFlightRef.current - 1);
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
                const isTakenByOther = takenByOthers.has(number);
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
