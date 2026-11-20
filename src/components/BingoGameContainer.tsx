'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppNavigationContext } from '../context/NavigationContext';
import { useGames } from '../context/gameContext';
import CardsView from '../app/cards/CardsView';
import GameView from '../app/game/GameView';

interface BingoGameContainerProps {
  initialView?: 'cards' | 'game';
}

/**
 * BingoGameContainer — Unified Single-Page Game Shell.
 *
 * Renders both CardsView (cartela selector) and GameView (active game board & winner)
 * inside the SAME component, driving the view directly from the live socket game state.
 *
 * - When game is 'waiting': Renders CardsView (0ms delay).
 * - When game is 'started' or 'finished': Renders GameView (0ms delay).
 * - When game ends and returns to 'waiting': Renders CardsView (0ms delay).
 * - Completely avoids Next.js route reloads (`router.push`) and network fetches.
 */
export default function BingoGameContainer({ initialView }: BingoGameContainerProps) {
  const { currentGame } = useGames();
  const [manualView, setManualView] = useState<'cards' | 'game' | null>(initialView ?? null);

  // Automatic view derived directly from active game status:
  const isGameActive = Boolean(
    currentGame && (currentGame.status === 'started' || currentGame.status === 'finished')
  );

  const activeView: 'cards' | 'game' =
    manualView !== null ? manualView : isGameActive ? 'game' : 'cards';

  // Whenever game transitions between statuses, reset manual override
  useEffect(() => {
    setManualView(null);
  }, [currentGame?.status, currentGame?.id]);

  const handleNavigate = useCallback((path: string) => {
    if (path === '/game' || path.startsWith('/game')) {
      setManualView('game');
    } else {
      setManualView('cards');
    }
  }, []);

  return (
    <AppNavigationContext.Provider value={{ navigateTo: handleNavigate }}>
      {activeView === 'game' ? <GameView /> : <CardsView />}
    </AppNavigationContext.Provider>
  );
}

