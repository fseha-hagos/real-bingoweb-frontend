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

// Cartela Column badge styling
const cartelaHeaders: { letter: string; bg: string; shadow: string }[] = [
  { letter: 'B', bg: 'bg-[#ef4444]', shadow: 'shadow-red-500/40' },
  { letter: 'I', bg: 'bg-[#f97316]', shadow: 'shadow-orange-500/40' },
  { letter: 'N', bg: 'bg-[#10b981]', shadow: 'shadow-emerald-500/40' },
  { letter: 'G', bg: 'bg-[#0ea5e9]', shadow: 'shadow-sky-500/40' },
  { letter: 'O', bg: 'bg-[#c084fc]', shadow: 'shadow-purple-500/40' },
];

export default function CardsPage() {
  const router = useRouter();
  const appNav = useAppNavigation(); // null when accessed via /cards directly

  // Single authoritative state for player's selected cards (instant 0ms response, zero flicker)
  const [selectedCards, setSelectedCards] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = sessionStorage.getItem(PLAYER_GAME_DATA);
        if (raw) {
          const parsed = JSON.parse(raw);
          const nums = parsed.cardNumbers || (parsed.cardNumber ? [parsed.cardNumber] : []);
          if (Array.isArray(nums) && nums.length > 0) return new Set(nums);
        }
      } catch { }
    }
    return new Set<number>();
  });

  // Track in-flight operations per card number: 'adding' | 'removing'
  const inFlightOps = useRef<Map<number, 'adding' | 'removing'>>(new Map());
  // Promise chains per card to serialize sequential add/remove clicks safely
  const inFlightChains = useRef<Map<number, Promise<void>>>(new Map());

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

  // Robust player identity check matching id, userId, and telegramId
  const isMe = useCallback((p: { id?: string; userId?: string; telegramId?: string | null }) => {
    if (!user) return false;
    if (user.id && (p.id === user.id || p.userId === user.id)) return true;
    if (user.telegramId && (p.id === user.telegramId || p.telegramId === user.telegramId || p.userId === user.telegramId)) return true;
    return false;
  }, [user]);

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
  const myExistingPlayer = currentGame?.players.find(isMe);

  const chosenCartela =
    previewCardNumber != null
      ? cartelasList.find((c) => c.id === previewCardNumber) ?? null
      : null;

  // Selected cards or currently previewed card for the showcase
  const cardsToShow = useMemo(() => {
    if (previewCardNumber != null && chosenCartela) {
      if (selectedCards.has(previewCardNumber)) {
        return Array.from(selectedCards)
          .map(
            (num) =>
              cartelasList.find((c) => c.id === num) ||
              (cartelasData as Cartela[]).find((c) => c.id === num)
          )
          .filter(Boolean) as Cartela[];
      }
      return [chosenCartela];
    }
    if (selectedCards.size > 0) {
      return Array.from(selectedCards)
        .map(
          (num) =>
            cartelasList.find((c) => c.id === num) ||
            (cartelasData as Cartela[]).find((c) => c.id === num)
        )
        .filter(Boolean) as Cartela[];
    }
    const first = cartelasList[0] || (cartelasData as Cartela[])[0];
    return first ? [first] : [];
  }, [previewCardNumber, chosenCartela, selectedCards, cartelasList]);

  // Server state synchronization (protects local in-flight actions from blinking)
  useEffect(() => {
    if (!user) return;

    const confirmed: number[] = [];
    game.players.forEach((p) => {
      if (isMe(p)) {
        if (p.cardNumber) confirmed.push(p.cardNumber);
        if (p.cardNumbers) confirmed.push(...p.cardNumbers);
      }
    });

    const serverConfirmed = new Set(confirmed);

    setSelectedCards(prev => {
      let changed = false;
      const next = new Set(prev);

      // 1. Add cards confirmed by server, unless player is actively removing them
      serverConfirmed.forEach(num => {
        if (inFlightOps.current.get(num) !== 'removing') {
          if (!next.has(num)) {
            next.add(num);
            changed = true;
          }
        }
      });

      // 2. Remove cards missing on server, unless player is actively adding them
      prev.forEach(num => {
        if (!serverConfirmed.has(num)) {
          if (inFlightOps.current.get(num) !== 'adding') {
            next.delete(num);
            changed = true;
          }
        }
      });

      return changed ? next : prev;
    });
  }, [game.players, user, isMe]);

  // Cards taken by OTHER players
  const takenByOthers = useMemo(() => {
    const taken = new Set<number>();
    game.players.forEach((p) => {
      if (!isMe(p)) {
        if (p.cardNumber) taken.add(p.cardNumber);
        if (p.cardNumbers) p.cardNumbers.forEach((cn) => taken.add(cn));
      }
    });
    return taken;
  }, [game.players, isMe]);

  // Synchronize PLAYER_GAME_DATA in session storage whenever selectedCards updates
  useEffect(() => {
    if (!currentGame || !user) return;
    const allCardNums = Array.from(selectedCards);
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
    } else {
      sessionStorage.removeItem(PLAYER_GAME_DATA);
    }
  }, [selectedCards, currentGame, user, cartelasList]);

  // Keep a ref to selectedCards so saveAndNavigate doesn't recreate on every render
  const selectedCardsRef = useRef(selectedCards);
  useEffect(() => { selectedCardsRef.current = selectedCards; }, [selectedCards]);

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
      const allCardNums = Array.from(new Set([...serverNums, ...selectedCardsRef.current]));

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

    if (appNav) {
      appNav.navigateTo('/game');
    } else {
      router.push('/game');
    }
  }, [currentGame, user, cartelasList, router, appNav]);

  // Reset navigation lock when game goes back to waiting for a new round
  useEffect(() => {
    if (game.status === 'waiting') {
      hasNavigatedRef.current = false;
    }
  }, [game.status]);

  // Navigate when game starts or is already started
  useEffect(() => {
    if (game.status === 'started') {
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

  // ---- Zero-Blink Card Selection / Deselection Handler ----
  const handleCardSelect = (number: number) => {
    setPreviewCardNumber(number);

    const isCurrentlySelected = selectedCards.has(number);
    const currentBet = currentGame?.bet || game.bet || 10;

    // --- CASE A: Deselect (instant 0ms visual update) ---
    if (isCurrentlySelected) {
      setSelectedCards(prev => {
        const next = new Set(prev);
        next.delete(number);
        return next;
      });
      inFlightOps.current.set(number, 'removing');

      // Sequence behind any pending action on this card
      const prevPromise = inFlightChains.current.get(number) || Promise.resolve();
      const currentPromise = prevPromise.then(async () => {
        if (inFlightOps.current.get(number) !== 'removing') return;
        try {
          await removeCard(currentBet, {
            gameId: currentGame?.id || game.id,
            playerId: user?.id || '',
            cardNumber: number,
            userId: user?.id,
            telegramId: user?.telegramId || undefined,
          });
        } catch (err) {
          console.error('Error removing card:', err);
        } finally {
          if (inFlightOps.current.get(number) === 'removing') {
            inFlightOps.current.delete(number);
          }
        }
      });
      inFlightChains.current.set(number, currentPromise);
      return;
    }

    // --- CASE B: Select (instant 0ms visual update) ---
    if (takenByOthers.has(number)) {
      toast.error('ይህ ካርቴላ በሌላ ተጫዋች ተይዟል (Card already taken)');
      return;
    }
    if (game.status === 'started') {
      toast.error('ጨዋታው ቀድሞውኑ ተጀምሯል');
      return;
    }
    if (selectedCards.size >= 4) {
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

    setSelectedCards(prev => new Set([...prev, number]));
    inFlightOps.current.set(number, 'adding');

    const prevPromise = inFlightChains.current.get(number) || Promise.resolve();
    const currentPromise = prevPromise.then(async () => {
      if (inFlightOps.current.get(number) !== 'adding') return;
      try {
        const result = await joinGame(currentBet, {
          gameId: currentGame.id,
          playerName: getDisplayName(user),
          playerId: user.id,
          cardNumber: number,
          cardNumbers: [number],
          userId: user.id,
          telegramId: user.telegramId || undefined,
        });

        if (!result.success) {
          if (inFlightOps.current.get(number) === 'adding') {
            setSelectedCards(prev => {
              const next = new Set(prev);
              next.delete(number);
              return next;
            });
            toast.error(result.error || am.failedToJoin);
          }
        }
      } catch (err) {
        console.error('Error confirming card:', err);
        if (inFlightOps.current.get(number) === 'adding') {
          setSelectedCards(prev => {
            const next = new Set(prev);
            next.delete(number);
            return next;
          });
          toast.error(am.failedToJoinRetry);
        }
      } finally {
        if (inFlightOps.current.get(number) === 'adding') {
          inFlightOps.current.delete(number);
        }
      }
    });
    inFlightChains.current.set(number, currentPromise);
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
    <div className="min-h-screen bg-[#070b14] text-white flex flex-col max-w-lg mx-auto select-none">
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

      {/* Top Header Bar (players = total cards chosen) */}
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

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-36">
        {/* Countdown / Game Status */}
        <div className="px-3 mt-3">
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
        <div className="px-4 mt-4 mb-2 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-black uppercase tracking-widest text-gray-300">
              Select Your Cartelas (Max 4)
            </h3>
            <p className="text-[10px] text-gray-500 font-bold">
              Tap a card to select or deselect. You can play up to 4 cards!
            </p>
          </div>
          <span className="text-xs font-black text-brand-secondary uppercase bg-brand-secondary/10 px-2.5 py-1 rounded-full border border-brand-secondary/20">
            {selectedCards.size} / 4 Selected
          </span>
        </div>

        {/* Card number grid 1-100 */}
        <div className="px-3 mb-4">
          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {Array.from({ length: 100 }, (_, i) => {
              const number = i + 1;
              const isMyRegisteredCard = selectedCards.has(number);
              const isTakenByOther = !isMyRegisteredCard && takenByOthers.has(number);
              const isPreview = previewCardNumber === number;

              return (
                <button
                  key={number}
                  type="button"
                  onClick={() => handleCardSelect(number)}
                  disabled={isTakenByOther}
                  className={`
                    w-full aspect-square text-xs font-black rounded-lg transition-all duration-150 relative overflow-hidden flex items-center justify-center
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

        {/* Cartela Showcase — Styled identically to game board cards in a row of two */}
        {cardsToShow.length > 0 && (
          <div className="px-3 pb-6">
            <div className="text-center mb-2.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {cardsToShow.length === 1 && previewCardNumber != null && !selectedCards.has(previewCardNumber)
                  ? 'ካርቴላ ቅድመ ዕይታ (CARD PREVIEW)'
                  : 'የተመረጡ ካርቴላዎች (SELECTED CARDS)'}
              </span>
            </div>

            <div
              className={`w-full ${cardsToShow.length === 1
                ? 'w-[calc(50%-0.25rem)] mx-auto'
                : 'grid grid-cols-2 gap-2 sm:gap-2.5'
                }`}
            >
              {cardsToShow.map((card) => {
                const isSelected = selectedCards.has(card.id);

                return (
                  <div
                    key={`showcase-${card.id}`}
                    className="w-full bg-[#0c1220] border border-slate-800/90 rounded-2xl p-2 sm:p-2.5 shadow-2xl relative flex flex-col justify-between"
                  >
                    {/* Card Header: BOARD #ID & 5x5 */}
                    <div className="flex items-center justify-between pb-1.5 text-[10px] sm:text-xs font-black uppercase tracking-wider">
                      <span className="text-slate-300 flex items-center gap-1">
                        {isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        )}
                        BOARD #{card.id}
                      </span>
                      <span className="text-slate-500 text-[9px]">5x5</span>
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
                          const isFree = num === 0;

                          return (
                            <div
                              key={`card-${card.id}-${col}-${row}`}
                              className={`aspect-square w-full rounded-lg font-black text-xs sm:text-sm flex items-center justify-center transition-all relative overflow-hidden ${isFree
                                ? 'bg-gradient-to-br from-[#8b5cf6] to-[#a855f7] text-white shadow-sm border border-purple-400/50'
                                : 'bg-[#121a2d] text-white border border-slate-800/80'
                                }`}
                            >
                              {isFree ? (
                                <span className="text-[9px] sm:text-[10px] font-black">
                                  ★ ነፃ
                                </span>
                              ) : (
                                <span>{num}</span>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#070b14]/95 backdrop-blur-md border-t border-slate-800 px-3 py-2.5 z-50">
        <div className="max-w-lg mx-auto flex flex-col gap-2">
          {/* Selected Cards Chips on the bottom */}
          {selectedCards.size > 0 && (
            <div className="flex flex-wrap gap-1.5 items-center">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 mr-0.5">
                የተመረጡ:
              </span>
              {Array.from(selectedCards).map((num) => (
                <button
                  key={`bottom-my-${num}`}
                  type="button"
                  onClick={() => handleCardSelect(num)}
                  title="Click to remove or preview card"
                  className={`flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-xs font-black border transition active:scale-95 ${previewCardNumber === num
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-sm'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30'
                    }`}
                >
                  <span>#{num}</span>
                  <span className="text-[10px] text-rose-300 ml-0.5 hover:text-white">✕</span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-black">
            <div className="flex items-center gap-2">
              <span className="text-gray-400 uppercase tracking-wider">ካርቴላዎች:</span>
              <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                {selectedCards.size} / 4
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
    </div>
  );
}
