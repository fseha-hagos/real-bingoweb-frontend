"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { SELECTED_GAME_DATA, PLAYER_GAME_DATA } from "../../../constants/configurations";
import { BingoWinPattern } from "../../../types/game";
import { am } from "../../../constants/amharic";



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

  if (!isOpen || !cartela?.numbers) return null;

  const grid = Array.isArray(cartela?.numbers) ? cartela.numbers : [];

  const getNumber = (col: number, row: number): number | null =>
    grid?.[col]?.[row] ?? null;

  const isHighlighted = (num: number | null) =>
    num !== null && calledNumbers.includes(num);

  // pattern.positions = [ [col,row], [col,row] ]
  const isPatternCell = (row: number, col: number): boolean => {
    return pattern?.positions?.some(([pCol, pRow]) => pCol === col && pRow === row) ?? false;
  };

  const flattenedGrid = Array.isArray(grid)
    ? grid.reduce<number[]>((acc, column) => {
      if (Array.isArray(column)) acc.push(...column);
      return acc;
    }, [])
    : [];

  const matchedCount = flattenedGrid.filter((n) => calledNumbers.includes(n)).length;

  const bgGradient = won
    ? "bg-gradient-to-br from-blue-900/90 to-blue-800/90"
    : "bg-gradient-to-br from-red-900/90 to-red-800/90";

  const borderColor = won ? "border-blue-500/50" : "border-red-500/50";
  const titleColor = won ? "text-blue-200" : "text-red-200";

  const handlePlayAgain = () => {

    if (onPlayAgain) { onClose(); onPlayAgain(); }
    else if (bet) {
      // Set the game data and navigate to cards page
      sessionStorage.setItem(SELECTED_GAME_DATA, JSON.stringify({ bet }));
      sessionStorage.removeItem(PLAYER_GAME_DATA);
      router.push('/cards');
      onClose();
    } else {
      // If no bet, just go home
      router.push('/');
      onClose();
    }
  };

  const handleCancel = () => {
    sessionStorage.removeItem(PLAYER_GAME_DATA);
    sessionStorage.removeItem(SELECTED_GAME_DATA);
    router.push("/");
    onClose();
  };

  const winnerHandle = winnerUsername
    ? winnerUsername.startsWith("@")
      ? winnerUsername
      : `@${winnerUsername}`
    : null;

  return (
    <div className="fixed inset-0 bg-brand-bg/90 z-[60] flex items-center justify-center backdrop-blur-xl p-4">
      <div className="bg-white/[0.03] backdrop-blur-2xl rounded-[3rem] p-8 w-[95%] max-w-xl shadow-3xl text-white border border-white/10 flex flex-col items-center relative overflow-hidden">
        {/* Decorative Gradients */}
        <div className={`absolute top-0 left-0 w-32 h-32 ${won ? 'bg-emerald-500/10' : 'bg-rose-500/10'} rounded-full blur-[60px]`} />
        
        <h2 className={`relative z-10 text-3xl font-black mb-2 text-center uppercase tracking-tighter ${won ? 'text-emerald-400' : 'text-rose-400'}`}>
          {won ? am.victory : am.gameOver}
        </h2>
        
        <p className="relative z-10 text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mb-8">
          {am.boardResults}
        </p>

        {won && pattern?.type && (
          <div className="relative z-10 bg-brand-accent/10 border border-brand-accent/20 px-6 py-2 rounded-full mb-8 animate-pulse">
            <p className="text-brand-accent font-black text-[10px] uppercase tracking-widest">
              {am.winningPattern(pattern.type)}
            </p>
          </div>
        )}

        {/* Bingo Card Preview */}
        <div className="relative z-10 grid grid-cols-5 gap-1.5 mb-10 w-full max-w-sm">
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
                    rounded-xl text-[11px] font-black transition-all duration-500
                    ${isWinPattern
                      ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/40 scale-110 z-10"
                      : highlight
                        ? "bg-brand-secondary/80 text-white"
                        : "bg-white/[0.05] text-gray-600 border border-white/5"
                    }
                  `}
                >
                  {num === 0 ? "X" : num}
                </div>
              );
            })
          )}
        </div>

        {/* Info Stats */}
        <div className="relative z-10 grid grid-cols-2 gap-4 mb-10 w-full max-w-sm">
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center">
            <p className="text-brand-accent font-black text-xl tracking-tighter">{calledNumbers.length}</p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-1">{am.callsMade}</p>
          </div>
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center">
            <p className={`font-black text-xl tracking-tighter ${won ? 'text-emerald-400' : 'text-brand-accent'}`}>
              {won ? am.matched : matchedCount}
            </p>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest mt-1">
              {won ? am.patternId : am.matches}
            </p>
          </div>
        </div>

        {!won && (winnerHandle || winnerName) && (
          <div className="relative z-10 mb-10 text-center">
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{am.champion}</p>
            <p className="text-white font-black text-sm">{winnerHandle ?? winnerName}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="relative z-10 flex gap-4 w-full max-w-sm">
          <button
            onClick={handleCancel}
            className="flex-1 py-4 px-4 rounded-2xl font-black text-[9px] uppercase tracking-widest bg-white/5 border border-white/5 text-gray-400 hover:bg-white/10 active:scale-95 transition-all"
          >
            {am.exitRound}
          </button>
          <button
            onClick={handlePlayAgain}
            className="flex-1 py-4 px-4 rounded-2xl font-black text-[9px] uppercase tracking-widest bg-brand-primary text-white shadow-xl shadow-brand-primary/20 hover:brightness-110 active:scale-95 transition-all"
          >
            {am.playAgain}
          </button>
        </div>

      </div>
    </div>
  );
};

export default BingoResult;

