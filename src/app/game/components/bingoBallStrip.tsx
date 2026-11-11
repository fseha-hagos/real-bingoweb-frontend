'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BingoBallStripProps {
  lastThree: number[];
  current: number | null;
  getLetter: (num: number) => string;
  gameStatus?: string;
  countdownSeconds?: number;
  playersCount?: number;
}

const colorMap: Record<string, { bg: string; shadow: string; border: string }> = {
  B: {
    bg: 'from-rose-500 via-red-600 to-rose-700',
    shadow: 'shadow-rose-500/40',
    border: 'border-rose-300/40',
  },
  I: {
    bg: 'from-amber-400 via-orange-500 to-amber-600',
    shadow: 'shadow-amber-500/40',
    border: 'border-amber-200/40',
  },
  N: {
    bg: 'from-emerald-400 via-green-500 to-emerald-700',
    shadow: 'shadow-emerald-500/40',
    border: 'border-emerald-200/40',
  },
  G: {
    bg: 'from-sky-400 via-blue-500 to-indigo-600',
    shadow: 'shadow-sky-500/40',
    border: 'border-sky-200/40',
  },
  O: {
    bg: 'from-purple-400 via-fuchsia-500 to-purple-700',
    shadow: 'shadow-purple-500/40',
    border: 'border-purple-200/40',
  },
};

export default function BingoBallStrip({
  lastThree,
  current,
  getLetter,
  gameStatus = 'waiting',
  countdownSeconds,
  playersCount = 1,
}: BingoBallStripProps) {
  // If game is in waiting phase or no balls have been called yet
  if (gameStatus === 'waiting' || (!current && lastThree.length === 0)) {
    return (
      <div className="w-full py-2.5 px-4 bg-gradient-to-r from-white/[0.04] via-brand-primary/10 to-white/[0.04] border border-white/10 rounded-2xl flex items-center justify-between shadow-inner">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
            {countdownSeconds !== undefined && countdownSeconds > 0
              ? `Starting in 00:${countdownSeconds.toString().padStart(2, '0')}`
              : `Waiting for players (${playersCount})`}
          </span>
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
          Get Ready
        </span>
      </div>
    );
  }

  const currentLetter = current ? getLetter(current) : 'B';
  const currentTheme = colorMap[currentLetter] || colorMap.B;
  const historyBalls = lastThree.filter((n) => n !== current);

  return (
    <div className="w-full py-2 px-3 bg-black/40 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-between shadow-xl">
      {/* Current Called Ball - Large & Vibrant */}
      <div className="flex items-center gap-3">
        {current && (
          <motion.div
            key={current}
            initial={{ scale: 0.3, rotate: -30, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 350, damping: 22 }}
            className={`w-12 h-12 rounded-full bg-gradient-to-b ${currentTheme.bg} ${currentTheme.shadow} shadow-lg border-2 ${currentTheme.border} flex items-center justify-center text-white font-black relative overflow-hidden`}
          >
            {/* Shimmer light reflection */}
            <div className="absolute top-1 left-1.5 w-3.5 h-2 bg-white/60 rounded-full blur-[0.5px]" />
            <div className="relative z-10 flex items-baseline gap-0.5">
              <span className="text-[11px] font-black opacity-90">{currentLetter}</span>
              <span className="text-lg font-black tracking-tight">{current}</span>
            </div>
          </motion.div>
        )}

        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-brand-primary">
            Current Ball
          </div>
          <div className="text-sm font-black text-white">
            {currentLetter}-{current}
          </div>
        </div>
      </div>

      {/* History Ribbon - Previous 3 Balls */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-wider text-gray-500 mr-1 hidden sm:inline">
          Previous:
        </span>
        <AnimatePresence mode="popLayout">
          {historyBalls.map((num) => {
            const letter = getLetter(num);
            const theme = colorMap[letter] || colorMap.B;

            return (
              <motion.div
                key={num}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.85 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className={`w-8 h-8 rounded-full bg-gradient-to-b ${theme.bg} border border-white/20 flex items-center justify-center text-white text-xs font-black shadow relative overflow-hidden`}
              >
                <div className="absolute top-0.5 left-1 w-2 h-1 bg-white/50 rounded-full blur-[0.5px]" />
                <span className="relative z-10 text-[10px]">{num}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
