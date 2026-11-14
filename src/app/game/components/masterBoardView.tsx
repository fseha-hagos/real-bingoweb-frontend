'use client';

import React, { useState } from 'react';
import { Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MasterBoardViewProps {
  possibleWin: number;
  playersCount: number;
  stake: number;
  calledNumbers: number[];
  currentBall: number | null;
  getLetter: (num: number) => string;
  autoBingo: boolean;
  onToggleAuto: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  message?: string;
}

const ballColors: Record<string, string> = {
  B: 'bg-red-500 text-white',
  I: 'bg-sky-500 text-white',
  N: 'bg-amber-400 text-white',
  G: 'bg-emerald-500 text-white',
  O: 'bg-purple-500 text-white',
};

const rowConfigs = [
  {
    letter: 'B',
    range: [1, 15],
    badgeBg: 'bg-[#ef4444]',
    calledBg: 'bg-[#ef4444] text-white shadow-sm shadow-red-500/50',
  },
  {
    letter: 'I',
    range: [16, 30],
    badgeBg: 'bg-[#0ea5e9]',
    calledBg: 'bg-[#0ea5e9] text-white shadow-sm shadow-sky-500/50',
  },
  {
    letter: 'N',
    range: [31, 45],
    badgeBg: 'bg-[#eab308]',
    calledBg: 'bg-[#eab308] text-white shadow-sm shadow-amber-500/50',
  },
  {
    letter: 'G',
    range: [46, 60],
    badgeBg: 'bg-[#10b981]',
    calledBg: 'bg-[#10b981] text-white shadow-sm shadow-emerald-500/50',
  },
  {
    letter: 'O',
    range: [61, 75],
    badgeBg: 'bg-[#a855f7]',
    calledBg: 'bg-[#a855f7] text-white shadow-sm shadow-purple-500/50',
  },
];

export default function MasterBoardView({
  possibleWin,
  playersCount,
  stake,
  calledNumbers,
  currentBall,
  getLetter,
  autoBingo,
  onToggleAuto,
  soundEnabled,
  onToggleSound,
}: MasterBoardViewProps) {
  const [isBoardVisible, setIsBoardVisible] = useState(true);

  const currentLetter = currentBall ? getLetter(currentBall) : '';
  const previousBalls = calledNumbers
    .filter((n) => n !== currentBall)
    .slice(-3);

  return (
    <div className="w-full select-none flex flex-col gap-2 py-1">
      {/* 1. Top Stat Cards Row */}
      <div className="grid grid-cols-5 gap-1.5 items-stretch">
        <div className="bg-[#121929] border border-slate-800/80 rounded-2xl p-1.5 text-center flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Derash
          </span>
          <span className="text-xs font-black text-white tracking-tight mt-0.5">
            {possibleWin} ETB
          </span>
        </div>

        <div className="bg-[#121929] border border-slate-800/80 rounded-2xl p-1.5 text-center flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Players
          </span>
          <span className="text-xs font-black text-white tracking-tight mt-0.5">
            {playersCount}
          </span>
        </div>

        <div className="bg-[#121929] border border-slate-800/80 rounded-2xl p-1.5 text-center flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Stake
          </span>
          <span className="text-xs font-black text-white tracking-tight mt-0.5">
            {stake} ETB
          </span>
        </div>

        <div className="bg-[#121929] border border-slate-800/80 rounded-2xl p-1.5 text-center flex flex-col justify-center">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Call
          </span>
          <span className="text-xs font-black text-white tracking-tight mt-0.5">
            {calledNumbers.length}/75
          </span>
        </div>

        {/* Sound Toggle Button */}
        <button
          type="button"
          onClick={onToggleSound}
          className="bg-[#121929] border border-slate-800/80 rounded-2xl p-1.5 flex items-center justify-center hover:bg-[#1a233c] active:scale-95 transition-all"
          aria-label="Toggle Sound"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-indigo-500/30">
            {soundEnabled ? (
              <Volume2 className="w-4 h-4 text-white" />
            ) : (
              <VolumeX className="w-4 h-4 text-rose-200" />
            )}
          </div>
        </button>
      </div>

      {/* 2. Number Calling & Auto-Bingo Controls Bar (Placed on Top of the Lists) */}
      <div className="bg-[#0d1527] border border-slate-800/90 rounded-2xl p-2.5 flex items-center justify-between shadow-xl gap-2">
        {/* Left: Called Balls (Previous 3 balls + Glowing Current Ball) */}
        <div className="flex items-center gap-2">
          {/* Previous 3 balls */}
          <div className="flex items-center gap-1">
            {previousBalls.map((num) => {
              const letter = getLetter(num);
              const color = ballColors[letter] || 'bg-slate-700 text-white';
              return (
                <div
                  key={num}
                  className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-[9px] font-black shadow border border-white/20`}
                >
                  {letter}
                  {num}
                </div>
              );
            })}
          </div>

          {/* Large Glowing Current Ball */}
          {currentBall ? (
            <motion.div
              key={currentBall}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              className="relative flex items-center justify-center ml-1"
            >
              <div className="absolute inset-0 w-11 h-11 rounded-full bg-amber-400/40 blur-md animate-pulse" />
              <div className="w-11 h-11 rounded-full bg-[#f59e0b] border-2 border-yellow-200 flex items-center justify-center text-white font-black text-sm tracking-tight shadow-[0_0_20px_rgba(245,158,11,0.6)] relative z-10">
                {currentLetter}
                {currentBall}
              </div>
            </motion.div>
          ) : (
            <div className="w-11 h-11 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-500 font-bold text-xs ml-1">
              --
            </div>
          )}
        </div>

        {/* Right: Red AUTO Toggle & Hide/Show Board Button */}
        <div className="flex items-center gap-2.5">
          {/* Red AUTO Toggle */}
          <div className="flex items-center gap-1.5 bg-[#121929] px-2.5 py-1 rounded-full border border-slate-800">
            <span className="text-[11px] font-black uppercase tracking-wider text-rose-500">
              AUTO
            </span>
            <button
              type="button"
              onClick={onToggleAuto}
              className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 ${
                autoBingo ? 'bg-teal-500' : 'bg-slate-700'
              }`}
            >
              <div
                className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform duration-200 ${
                  autoBingo ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Hide / Show 75 Numbers Button */}
          <button
            type="button"
            onClick={() => setIsBoardVisible((prev) => !prev)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#141d30] border border-slate-700/80 text-[11px] font-black text-amber-400 hover:text-white transition active:scale-95 shadow-sm"
          >
            {isBoardVisible ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">ቦርድ ደብቅ</span>
                <span className="sm:hidden">ደብቅ</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">ቦርድ አሳይ</span>
                <span className="sm:hidden">አሳይ</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 3. Horizontal 75 Numbers Board with Show/Hide Accordion */}
      <AnimatePresence>
        {isBoardVisible ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full bg-[#0c1322] border border-slate-800/90 rounded-2xl p-2 sm:p-2.5 shadow-2xl flex flex-col gap-1 overflow-hidden"
          >
            {rowConfigs.map(({ letter, range, badgeBg, calledBg }) => {
              const start = range[0];
              const count = range[1] - range[0] + 1;
              const rowNumbers = Array.from({ length: count }, (_, i) => start + i);

              return (
                <div key={letter} className="flex items-center gap-1.5 w-full">
                  {/* Row Letter Badge (B, I, N, G, O) */}
                  <div
                    className={`w-6 h-5 rounded-md ${badgeBg} text-white font-black text-[11px] flex items-center justify-center flex-shrink-0 shadow`}
                  >
                    {letter}
                  </div>

                  {/* 15 Horizontal Numbers in this Row */}
                  <div
                    className="flex-1 gap-0.5 sm:gap-1"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(15, minmax(0, 1fr))',
                    }}
                  >
                    {rowNumbers.map((num) => {
                      const isCalled = calledNumbers.includes(num);

                      return (
                        <div
                          key={num}
                          className={`h-5 sm:h-5.5 rounded flex items-center justify-center text-[9px] sm:text-[10px] font-bold transition-all ${
                            isCalled
                              ? `${calledBg} font-black scale-105`
                              : 'bg-[#131b2e] text-slate-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => setIsBoardVisible(true)}
            className="w-full py-1.5 px-3 rounded-xl bg-[#0c1322]/80 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400 hover:text-amber-400 transition"
          >
            <div className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-bold">75 ቁጥሮች ተደብቀዋል (75 Numbers Hidden)</span>
            </div>
            <span className="font-black text-amber-300 text-[11px]">
              {calledNumbers.length}/75 Called • አሳይ
            </span>
          </button>
        )}
      </AnimatePresence>
    </div>
  );
}
