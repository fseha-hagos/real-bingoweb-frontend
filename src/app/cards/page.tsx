'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
  const { user, games, currentGame, joinGame, watchGame } = useGames();

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
      const allCardNums = myExistingPlayer
        ? (myExistingPlayer.cardNumbers && myExistingPlayer.cardNumbers.length > 0
            ? myExistingPlayer.cardNumbers
            : myExistingPlayer.cardNumber ? [myExistingPlayer.cardNumber] : [])
        : [];

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

  const handleGoToGame = useCallback(() => {
    goToGame();
  }, [goToGame]);

  const handleCardSelect = (number: number) => {
    // If the card is already committed by this player, clicking previews it
    if (myExistingPlayer && (myExistingPlayer.cardNumbers?.includes(number) || myExistingPlayer.cardNumber === number)) {
      setPreviewCardNumber(number);
      return;
    }

    setSelectedCards((prev) => {
      if (prev.includes(number)) {
        const next = prev.filter((n) => n !== number);
        setPreviewCardNumber(next.length > 0 ? next[next.length - 1] : null);
        return next;
      } else {
        const alreadyCount = (myExistingPlayer?.cardNumbers?.length || (myExistingPlayer?.cardNumber ? 1 : 0));
        const totalCards = alreadyCount + prev.length + 1;
        if (totalCards > 4) {
          toast.info('Maximum 4 cards per game');
          return prev;
        }
        const totalStake = (prev.length + 1) * (currentGame?.bet || 0);
        if ((user?.balance ?? 0) < totalStake) {
          toast.error('Insufficient balance for another card');
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
        toast.success(
          myExistingPlayer
            ? `🎉 ተጨማሪ ${selectedCards.length} ካርቴላ በተሳካ ሁኔታ ተጨምሯል!`
            : am.joinedWithCard(selectedCards.join(', '))
        );

        const existingCardNums = myExistingPlayer
          ? (myExistingPlayer.cardNumbers && myExistingPlayer.cardNumbers.length > 0
              ? myExistingPlayer.cardNumbers
              : myExistingPlayer.cardNumber ? [myExistingPlayer.cardNumber] : [])
          : [];

        const allCardNums = Array.from(new Set([...existingCardNums, ...selectedCards]));
        const resolvedCards = allCardNums
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
            cardNumber: allCardNums[0],
            cardNumbers: allCardNums,
            cards: resolvedCards,
            bet: currentGame.bet,
          })
        );

        setSelectedCards([]);
        setJoining(false);
        goToGame();
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



  const totalCost = selectedCards.length * game.bet;

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

  // Separate cards: My own already-selected cards vs taken by OTHER players
  const takenByOthers = new Set<number>();
  const myCardsSet = new Set<number>();

  game.players.forEach((p) => {
    const isMe =
      user &&
      ((user.id && p.id === user.id) ||
        (user.telegramId &&
          (p.id === user.telegramId || p.telegramId === user.telegramId)));

    if (isMe) {
      if (p.cardNumber) myCardsSet.add(p.cardNumber);
      if (p.cardNumbers) p.cardNumbers.forEach((cn) => myCardsSet.add(cn));
    } else {
      if (p.cardNumber) takenByOthers.add(p.cardNumber);
      if (p.cardNumbers) p.cardNumbers.forEach((cn) => takenByOthers.add(cn));
    }
  });

  const isAlreadyJoined = myCardsSet.size > 0 || Boolean(myExistingPlayer);

  return (
    <div className="min-h-screen bg-brand-bg text-white flex flex-col">
      {/* Live sync banner */}
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
              connected ? 'bg-emerald-400 animate-pulse' : 'bg-current'
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
        {/* Already Joined Alert Banner */}
        {isAlreadyJoined && (
          <div className="mx-4 mt-3 p-3 rounded-2xl bg-indigo-950/80 border border-indigo-500/50 flex items-center justify-between shadow-xl">
            <div>
              <p className="text-xs font-black text-indigo-300">
                🎉 እርስዎ አስቀድመው በዚህ ጨዋታ ተመዝግበዋል!
              </p>
              <p className="text-[11px] text-slate-400">
                የመረጧቸው ካርቴላዎች፦ {Array.from(myCardsSet).join(', ') || 'Active'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.replace('/game')}
              className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-wider transition active:scale-95 shadow-md shadow-indigo-500/40"
            >
              ቀጥል
            </button>
          </div>
        )}



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
              Tap to select or deselect. You can play multiple cards!
            </p>
          </div>
          <span className="text-xs font-black text-brand-secondary uppercase bg-brand-secondary/10 px-2.5 py-1 rounded-full border border-brand-secondary/20">
            {myCardsSet.size + selectedCards.length} / 4 Selected
          </span>
        </div>

        {/* Selected / Registered Cards Chips */}
        {(myCardsSet.size > 0 || selectedCards.length > 0) && (
          <div className="px-4 mb-3 flex flex-wrap gap-2 items-center">
            {myCardsSet.size > 0 && (
              <>
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400">
                  Joined:
                </span>
                {Array.from(myCardsSet).map((num) => (
                  <button
                    key={`my-${num}`}
                    type="button"
                    onClick={() => setPreviewCardNumber(num)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border transition ${
                      previewCardNumber === num
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <span>#{num}</span>
                    <span className="text-[10px] text-emerald-300">✓</span>
                  </button>
                ))}
              </>
            )}

            {selectedCards.length > 0 && (
              <>
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 ml-1">
                  Adding:
                </span>
                {selectedCards.map((num) => (
                  <button
                    key={`new-${num}`}
                    type="button"
                    onClick={() => setPreviewCardNumber(num)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black border transition ${
                      previewCardNumber === num
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
                <span className="text-xs font-black text-amber-300 ml-auto">
                  +{totalCost} ETB
                </span>
              </>
            )}
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
                const isSelected = selectedCards.includes(number);
                const isPreview = previewCardNumber === number;

                return (
                  <button
                    key={number}
                    type="button"
                    onClick={() => {
                      if (!isMyRegisteredCard && !isTakenByOther) {
                        handleCardSelect(number);
                      } else {
                        setPreviewCardNumber(number);
                      }
                    }}
                    disabled={isTakenByOther || joining}
                    className={`
                      w-full aspect-square text-xs font-black rounded-lg transition-all duration-200 relative overflow-hidden flex items-center justify-center
                      ${
                        isMyRegisteredCard
                          ? 'bg-emerald-500/25 text-emerald-300 border-2 border-emerald-400 ring-2 ring-emerald-400/30 z-10 scale-105'
                          : isSelected
                            ? isPreview
                              ? 'bg-brand-primary text-white scale-110 shadow-lg ring-2 ring-white z-10'
                              : 'bg-brand-primary/80 text-white scale-105 z-10'
                            : isTakenByOther
                              ? 'bg-rose-950/40 text-rose-800 cursor-not-allowed border border-rose-900/30'
                              : 'bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white'
                      }
                    `}
                  >
                    {number}
                    {isMyRegisteredCard && (
                      <span className="absolute top-0 right-0 w-1.5 h-1.5 bg-emerald-400 rounded-full" />
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
                              ${
                                currentNum === 0
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

      {/* Sticky Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-bg/95 backdrop-blur-md border-t border-white/10 px-4 py-3 z-50">
        <div className="flex gap-2 max-w-lg mx-auto items-center">
          {selectedCards.length > 0 ? (
            <>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={joining}
                className="py-3 px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 font-black uppercase tracking-wider text-xs rounded-xl transition-all active:scale-95"
              >
                Clear
              </button>

              <button
                type="button"
                onClick={handleJoinGame}
                disabled={
                  joining ||
                  !connected ||
                  game.status === 'started' ||
                  (user?.balance ?? 0) < totalCost
                }
                className={`flex-1 py-3.5 px-3 font-black uppercase tracking-wider text-xs rounded-xl active:scale-95 transition-all shadow-xl ${
                  joining || !connected || game.status === 'started' || (user?.balance ?? 0) < totalCost
                    ? 'bg-white/5 text-gray-500 border border-white/5 cursor-not-allowed'
                    : 'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-brand-primary/30'
                }`}
              >
                {joining ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{am.initializing}</span>
                  </div>
                ) : !connected ? (
                  am.linkError
                ) : (user?.balance ?? 0) < totalCost ? (
                  'Insufficient Balance'
                ) : isAlreadyJoined ? (
                  `+ Confirm +${selectedCards.length} Additional Cards (${totalCost} ETB)`
                ) : (
                  `Confirm Entry (${selectedCards.length} ${
                    selectedCards.length === 1 ? 'Card' : 'Cards'
                  } • ${totalCost} ETB)`
                )}
              </button>

              {isAlreadyJoined && (
                <button
                  type="button"
                  onClick={handleGoToGame}
                  className="py-3 px-3 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/40 text-emerald-300 font-black text-xs rounded-xl transition-all active:scale-95 whitespace-nowrap"
                >
                  🎮 ወደ ሰሌዳ
                </button>
              )}
            </>
          ) : isAlreadyJoined ? (
            <button
              type="button"
              onClick={handleGoToGame}
              className="w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/40 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <span>🎮 ወደ ጨዋታው ሰሌዳ ሂድ (Go to Game Board)</span>
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest bg-white/5 text-gray-600 border border-white/5 cursor-not-allowed"
            >
              Select At Least 1 Card
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
