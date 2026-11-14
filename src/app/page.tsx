'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { SELECTED_GAME_DATA } from '../constants/configurations';

export default function PlayPage() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const queryBet = params.get('bet') || params.get('stake');
    let betVal = 20;

    if (queryBet && !isNaN(Number(queryBet))) {
      betVal = Number(queryBet);
    } else {
      const stored =
        sessionStorage.getItem(SELECTED_GAME_DATA) ||
        localStorage.getItem('lastBet');
      if (stored) {
        try {
          const parsed = typeof stored === 'string' && stored.startsWith('{') ? JSON.parse(stored) : null;
          if (parsed?.bet && !isNaN(Number(parsed.bet))) {
            betVal = Number(parsed.bet);
          } else if (!isNaN(Number(stored))) {
            betVal = Number(stored);
          }
        } catch { }
      }
    }

    sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({ bet: betVal }));
    try {
      localStorage.setItem('lastBet', String(betVal));
    } catch { }

    router.replace(`/cards?bet=${betVal}`);
  }, [router]);

  return (
    <div className="flex-1 min-h-screen bg-brand-bg text-white flex flex-col items-center justify-center p-4">
      <div className="w-10 h-10 rounded-full border-3 border-emerald-500/20 border-t-emerald-400 animate-spin mb-3" />
      <p className="text-xs font-bold text-gray-400 tracking-wider">
        ወደ ካርቴላ በመሸጋገር ላይ...
      </p>
    </div>
  );
}
