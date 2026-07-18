import React from "react";
import { motion } from "framer-motion";

interface BingoBallStripProps {
  lastThree: number[];
  current: number | null;
  getLetter: (num: number) => string;
}

const colorMap: Record<string, string> = {
  B: "from-red-400 via-red-500 to-red-600",
  I: "from-yellow-400 via-yellow-500 to-yellow-600",
  N: "from-green-400 via-green-500 to-green-600",
  G: "from-blue-400 via-blue-500 to-blue-600",
  O: "from-purple-400 via-purple-500 to-purple-600",
};

export default function BingoBallStrip({ lastThree, current, getLetter }: BingoBallStripProps) {
  return (
    <div className="w-full h-12 flex items-center justify-around px-4 bg-black/20 backdrop-blur-sm rounded-lg">
      {lastThree.map((num) => {
        const isCurrent = num === current;
        const letter = getLetter(num);

        return (
          <motion.div
            key={num}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: isCurrent ? 1.2 : 1, 
              opacity: isCurrent ? 1 : 0.8 
            }}
            transition={{ 
              type: "spring", 
              stiffness: 300, 
              damping: 20 
            }}
            className={`flex items-center justify-center rounded-full text-white font-bold relative overflow-hidden shadow-md transition-all ${
              isCurrent
                ? `w-14 h-14 text-lg bg-gradient-to-t ${colorMap[letter]} z-10`
                : `w-10 h-10 text-sm opacity-80 bg-gradient-to-t ${colorMap[letter]}`
            }`}
          >
            {isCurrent && (
              <motion.div
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="absolute inset-0 rounded-full bg-white"
              />
            )}
            <span className="relative z-10">{letter}</span>
            <span className="relative z-10 ml-1">{num}</span>
            {/* shiny reflection */}
            <div className="absolute top-1 left-1 w-3 h-3 bg-white rounded-full opacity-60 blur-sm"></div>
          </motion.div>
        );
      })}
    </div>
  );
}
