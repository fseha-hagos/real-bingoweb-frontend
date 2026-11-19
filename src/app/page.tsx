'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AppNavigationContext } from '../context/NavigationContext';
import { useGames } from '../context/gameContext';
import CardsPage from './cards/page';
import GamePage from './game/page';

/**
 * Root "/" — State-driven Single-Page Bingo Container.
 *
 * Cards view (cartela selection) and Game view (active board & results)
 * exist on the SAME page as components, controlled directly by the live game state.
 *
 * - When game is 'waiting': Renders CardsPage (choose cartelas & countdown).
 * - When game is 'started' or 'finished': Renders GamePage (live numbers & winner overlay).
 * - Transitions happen in 0ms purely in React memory with NO full-page network fetch!
 */
export default function RootPage() {
  const { currentGame } = useGames();
  const [manualView, setManualView] = useState<'cards' | 'game' | null>(null);

  // Automatic view derived directly from active game status
  const isGameActive = Boolean(
    currentGame && (currentGame.status === 'started' || currentGame.status === 'finished')
  );

  const activeView: 'cards' | 'game' =
    manualView !== null ? manualView : isGameActive ? 'game' : 'cards';

  // Whenever game transitions between statuses (e.g. waiting -> started, or finished -> waiting),
  // reset manual override so state naturally drives the screen.
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
      {activeView === 'game' ? <GamePage /> : <CardsPage />}
    </AppNavigationContext.Provider>
  );
}
