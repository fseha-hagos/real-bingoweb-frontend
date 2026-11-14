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

const ballColors: Record<string, string> = {
  B: 'bg-red-500 text-white',
  I: 'bg-sky-500 text-white',
  N: 'bg-amber-400 text-white',
  G: 'bg-emerald-500 text-white',
  O: 'bg-purple-500 text-white',
};

export default function BingoBallStrip({
  lastThree,
  current,
  getLetter,
  gameStatus = 'waiting',
  countdownSeconds,
  playersCount = 1,
}: BingoBallStripProps) {
  // If waiting for players or countdown phase
  if (gameStatus === 'waiting' || (!current && lastThree.length === 0)) {
    return (
      <div className="w-full py-2 px-3.5 bg-[#0d1527] border border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400">
            {countdownSeconds !== undefined && countdownSeconds > 0
              ? `STARTING IN 00:${countdownSeconds.toString().padStart(2, '0')}`
              : `WAITING FOR PLAYERS (${playersCount})`}
          </span>
        </div>
        <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest text-slate-300 bg-[#162035] px-3 py-1.5 rounded-xl border border-slate-700/60 shadow-sm">
          GET READY
        </span>
      </div>
    );
  }

  const currentLetter = current ? getLetter(current) : 'B';
  const historyBalls = lastThree.filter((n) => n !== current);

  return (
    <div className="w-full py-2 px-3.5 bg-[#0d1527] border border-slate-800/90 rounded-2xl flex items-center justify-between shadow-xl">
      {/* Current Called Ball with pulsing glowing halo */}
      <div className="flex items-center gap-3">
        {current && (
          <motion.div
            key={current}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 450, damping: 25 }}
            className="relative flex items-center justify-center"
          >
            {/* Halo glow */}
            <div className="absolute inset-0 w-11 h-11 rounded-full bg-amber-400/40 blur-md animate-pulse" />
            <div className="w-11 h-11 rounded-full bg-[#f59e0b] border-2 border-yellow-200 flex items-center justify-center text-white font-black text-sm sm:text-base tracking-tight shadow-[0_0_20px_rgba(245,158,11,0.5)] relative z-10">
              {currentLetter}{current}
            </div>
          </motion.div>
        )}

        <div>
          <div className="text-[9px] font-black uppercase tracking-widest text-amber-400">
            Current Call
          </div>
          <div className="text-sm font-black text-white">
            {currentLetter} - {current}
          </div>
        </div>
      </div>

      {/* Previous Called Balls */}
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 mr-1 hidden sm:inline">
          Previous:
        </span>
        <AnimatePresence mode="popLayout">
          {historyBalls.map((num) => {
            const letter = getLetter(num);
            const color = ballColors[letter] || 'bg-slate-700 text-white';

            return (
              <motion.div
                key={num}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                className={`w-7 h-7 rounded-full ${color} border border-white/20 flex items-center justify-center text-[10px] font-black shadow-md`}
              >
                {letter}{num}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
