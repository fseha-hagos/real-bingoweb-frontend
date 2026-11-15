"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SELECTED_GAME_DATA, PLAYER_GAME_DATA } from "../../../constants/configurations";
import { BingoWinPattern } from "../../../types/game";
import { am } from "../../../constants/amharic";
import { Trophy, ArrowRight, X } from "lucide-react";
import cartelasData from "../../../data/cartelas.json";

interface Cartela {
  id: number;
  numbers: number[][];
}

interface BingoResultProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayAgain?: () => void;
  cartela?: Cartela | null;
  calledNumbers?: number[];
  won?: boolean;
  bet?: number;
  pattern?: BingoWinPattern | null;
  winnerName?: string | null;
  winnerUsername?: string | null;
}

const BingoResult: React.FC<BingoResultProps> = ({
  isOpen,
  onClose,
  onPlayAgain,
  cartela,
  calledNumbers = [],
  won = false,
  bet,
  pattern,
  winnerName = null,
  winnerUsername = null,
}) => {
  const router = useRouter();
  const [countdown, setCountdown] = useState<number>(5);

  const handlePlayAgain = () => {
    sessionStorage.removeItem(PLAYER_GAME_DATA);
    const targetBet = bet || 20;
    sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({ bet: targetBet }));
    router.replace(`/cards?bet=${targetBet}`);
    if (onPlayAgain) onPlayAgain();
  };

  const handleCancel = () => {
    sessionStorage.removeItem(PLAYER_GAME_DATA);
    const targetBet = bet || 20;
    router.replace(`/cards?bet=${targetBet}`);
    onClose();
  };

  // 5-second automatic redirect countdown
  useEffect(() => {
    if (!isOpen) {
      setCountdown(5);
      return;
    }

    setCountdown(5);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handlePlayAgain();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, bet]);

  if (!isOpen) return null;

  // Ensure cartela numbers are always populated
  const fallbackCatalogCard =
    (cartelasData as Cartela[]).find((c) => c.id === cartela?.id) ||
    (cartelasData as Cartela[])[0];

  const resolvedGrid: number[][] =
    Array.isArray(cartela?.numbers) && cartela.numbers.length > 0
      ? cartela.numbers
      : fallbackCatalogCard.numbers;

  const resolvedCardId = cartela?.id || fallbackCatalogCard.id;

  const getNumber = (col: number, row: number): number | null =>
    resolvedGrid?.[col]?.[row] ?? null;

  const isHighlighted = (num: number | null) =>
    num !== null && (num === 0 || calledNumbers.includes(num));

  // Pattern position check
  const isPatternCell = (row: number, col: number): boolean => {
    return pattern?.positions?.some(([pCol, pRow]) => pCol === col && pRow === row) ?? false;
  };

  const winnerHandle = winnerUsername
    ? winnerUsername.startsWith("@")
      ? winnerUsername
      : `@${winnerUsername}`
    : null;

  return (
    <div className="fixed inset-0 bg-black/85 z-[100] flex items-center justify-center backdrop-blur-xl p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#0b101c] border border-slate-700/80 rounded-3xl p-5 sm:p-6 w-full max-w-sm shadow-[0_0_50px_rgba(0,0,0,0.8)] text-white flex flex-col items-center relative overflow-hidden">
        {/* Glow Effects */}
        <div
          className={`absolute top-0 w-48 h-48 ${won ? "bg-emerald-500/20" : "bg-amber-500/15"
            } rounded-full blur-[80px] pointer-events-none`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-white/5 hover:bg-white/10 transition"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2 mb-1 z-10">
          <Trophy
            className={`w-6 h-6 ${won ? "text-emerald-400 animate-bounce" : "text-amber-400"}`}
          />
          <h2
            className={`text-xl font-black uppercase tracking-wider text-center ${won ? "text-emerald-400" : "text-amber-300"
              }`}
          >
            {won ? "🎉 አሸንፈዋል! (BINGO!)" : "🏆 አሸናፊ ተገኝቷል!"}
          </h2>
        </div>

        {/* Winner Name / Badge */}
        <div className="z-10 text-center mb-3">
          <p className="text-sm font-bold text-slate-200">
            {won ? (
              <span className="text-emerald-300 font-black">እንኳን ደስ አለዎት! የዚህ ዙር አሸናፊ እርስዎ ነዎት!</span>
            ) : (
              <span>
                አሸናፊ፦ <strong className="text-white font-black">{winnerHandle || winnerName || "ተጫዋች"}</strong>
              </span>
            )}
          </p>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
            የአሸናፊው ካርቴላ (Winning Card #{resolvedCardId})
          </p>
        </div>

        {/* 5-Second Auto-Navigate Alert Banner */}
        <div className="w-full z-10 py-2 px-3 rounded-2xl bg-indigo-950/80 border border-indigo-500/40 text-center flex items-center justify-between mb-3 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            <span className="text-[11px] font-bold text-indigo-200">
              ወደ አዲስ ዙር ካርቴላ መምረጫ...
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white font-black text-xs shadow-md">
            {countdown}s
          </span>
        </div>

        {/* Winning Bingo Card 5x5 Grid */}
        <div className="w-full z-10 bg-[#060a14] border border-slate-800 rounded-2xl p-2.5 mb-3 shadow-inner">
          <div className="grid grid-cols-5 gap-1 mb-1 text-center">
            {["B", "I", "N", "G", "O"].map((letter) => (
              <span key={letter} className="text-xs font-black text-amber-400 tracking-wider">
                {letter}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-5 gap-1">
            {Array.from({ length: 5 }).map((_, row) =>
              Array.from({ length: 5 }).map((_, col) => {
                const num = getNumber(col, row);
                const highlight = isHighlighted(num);
                const isWinPattern = isPatternCell(row, col);

                return (
                  <div
                    key={`${col}-${row}`}
                    className={`
                      aspect-square flex items-center justify-center
                      rounded-lg text-[10px] sm:text-xs font-black transition-all
                      ${isWinPattern
                        ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/50 scale-105 ring-2 ring-emerald-300 z-10"
                        : highlight
                          ? "bg-indigo-600 text-white border border-indigo-400/40"
                          : "bg-[#101726] text-slate-500 border border-slate-800/80"
                      }
                    `}
                  >
                    {num === 0 ? "★" : num}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="w-full z-10 flex gap-2">
          <button
            type="button"
            onClick={handleCancel}
            className="flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider bg-[#141b2b] border border-slate-800 text-slate-400 hover:text-white transition active:scale-95"
          >
            {am.exitRound || "ውጣ"}
          </button>
          <button
            type="button"
            onClick={handlePlayAgain}
            className="flex-2 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/40 transition active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span>አዲስ ዙር ምረጥ</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BingoResult;
