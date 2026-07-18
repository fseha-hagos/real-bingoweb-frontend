import React, { useState, useEffect } from "react";

// Define the data structure for when a bingo is completed
interface BingoCardCompleteData {
  action: "bingo_complete";
  winType?: "row" | "column" | "diagonal";
  winIndex?: number;
  gameTime: number;
  card: number[][];
  marked: boolean[][];
}

// Update the props interface
interface BingoCardProps {
  onComplete: (data: BingoCardCompleteData) => void;
}



interface GameState {
  card: number[][];
  marked: boolean[][];
  gameStartTime: number;
  isGameComplete: boolean;
  winType?: "row" | "column" | "diagonal";
  winIndex?: number;
}

const generateCard = (): number[][] => {
  const ranges = [
    [1, 15],   // B
    [16, 30],  // I
    [31, 45],  // N
    [46, 60],  // G
    [61, 75],  // O
  ];

  const card: number[][] = [];

  // Generate columns
  for (let col = 0; col < 5; col++) {
    const colNumbers: number[] = [];
    while (colNumbers.length < 5) {
      const n =
        Math.floor(Math.random() * (ranges[col][1] - ranges[col][0] + 1)) +
        ranges[col][0];
      if (!colNumbers.includes(n)) colNumbers.push(n);
    }
    card.push(colNumbers);
  }

  // Transpose to rows
  const rows = card[0].map((_, rowIndex) => card.map((col) => col[rowIndex]));

  // Set center free space to 0
  rows[2][2] = 0;

  return rows;
};

const BingoCard: React.FC<BingoCardProps> = ({ onComplete }) => {
  const [gameState, setGameState] = useState<GameState>({
    card: generateCard(),
    marked: Array.from({ length: 5 }, (_, i) =>
      Array.from({ length: 5 }, (_, j) => (i === 2 && j === 2 ? true : false))
    ),
    gameStartTime: Date.now(),
    isGameComplete: false,
  });

  const checkWinCondition = (
    marked: boolean[][]
  ): { isWin: boolean; type?: "row" | "column" | "diagonal"; index?: number } => {
    for (let i = 0; i < 5; i++) if (marked[i].every((cell) => cell)) return { isWin: true, type: "row", index: i };
    for (let j = 0; j < 5; j++) if (marked.every((row) => row[j])) return { isWin: true, type: "column", index: j };
    if (marked.every((row, i) => row[i])) return { isWin: true, type: "diagonal", index: 0 };
    if (marked.every((row, i) => row[4 - i])) return { isWin: true, type: "diagonal", index: 1 };
    return { isWin: false };
  };

  const toggleMark = (row: number, col: number) => {
    if (gameState.isGameComplete) return;

    const newMarked = gameState.marked.map((r, i) =>
      r.map((c, j) => (i === row && j === col ? !c : c))
    );

    const winCheck = checkWinCondition(newMarked);

    setGameState((prev) => ({
      ...prev,
      marked: newMarked,
      isGameComplete: winCheck.isWin,
      winType: winCheck.type,
      winIndex: winCheck.index,
    }));

    if (winCheck.isWin) {
      const gameTime = Date.now() - gameState.gameStartTime;
      onComplete({
        action: "bingo_complete",
        winType: winCheck.type,
        winIndex: winCheck.index,
        gameTime,
        card: gameState.card,
        marked: newMarked,
      });
    }
  };

  const getCellStyle = (row: number, col: number, isMarked: boolean) => {
    const baseStyle = {
      width: "70px",
      height: "70px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontWeight: "bold",
      border: "2px solid #4ecdc4",
      cursor: gameState.isGameComplete ? "default" : "pointer",
      borderRadius: "8px",
      fontSize: "1.2rem",
      transition: "all 0.3s ease",
      position: "relative" as const,
    };

    return isMarked
      ? {
          ...baseStyle,
          backgroundColor: "#4ecdc4",
          color: "#1a1a2e",
          transform: "scale(1.05)",
          boxShadow: "0 4px 15px rgba(78, 205, 196, 0.4)",
        }
      : {
          ...baseStyle,
          backgroundColor: "#16213e",
          color: "#ffffff",
          borderColor: "#4ecdc4",
        };
  };

  const getWinHighlightStyle = (row: number, col: number) => {
    if (!gameState.isGameComplete || !gameState.winType) return {};

    const isWinCell =
      (gameState.winType === "row" && row === gameState.winIndex) ||
      (gameState.winType === "column" && col === gameState.winIndex) ||
      (gameState.winType === "diagonal" &&
        ((gameState.winIndex === 0 && row === col) ||
          (gameState.winIndex === 1 && row === 4 - col)));

    return isWinCell
      ? {
          backgroundColor: "#ff6b6b",
          color: "#ffffff",
          borderColor: "#ff6b6b",
          boxShadow: "0 0 20px rgba(255, 107, 107, 0.6)",
          animation: "pulse 1s infinite",
        }
      : {};
  };

  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 70px)",
          gap: "8px",
          justifyContent: "center",
          marginBottom: "20px",
        }}
      >
        {gameState.card.map((row, i) =>
          row.map((num, j) => (
            <div
              key={`${i}-${j}`}
              onClick={() => toggleMark(i, j)}
              style={{
                ...getCellStyle(i, j, gameState.marked[i][j]),
                ...getWinHighlightStyle(i, j),
              }}
            >
              {num === 0 ? "★" : num}
              {gameState.marked[i][j] && (
                <div
                  style={{
                    position: "absolute",
                    top: "2px",
                    right: "2px",
                    fontSize: "0.8rem",
                    color: "#1a1a2e",
                  }}
                >
                  ✓
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {gameState.isGameComplete && (
        <div
          style={{
            backgroundColor: "#16213e",
            padding: "20px",
            borderRadius: "15px",
            border: "2px solid #ff6b6b",
            marginTop: "20px",
            animation: "slideIn 0.5s ease",
          }}
        >
          <h2
            style={{
              color: "#ff6b6b",
              margin: "0 0 10px 0",
              fontSize: "1.5rem",
            }}
          >
            🎉 BINGO! 🎉
          </h2>
          <p style={{ color: "#ffffff", margin: 0, fontSize: "1.1rem" }}>
            {gameState.winType === "row" &&
              `Row ${(gameState.winIndex || 0) + 1} completed!`}
            {gameState.winType === "column" &&
              `Column ${(gameState.winIndex || 0) + 1} completed!`}
            {gameState.winType === "diagonal" && "Diagonal completed!"}
          </p>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.1);
          }
          100% {
            transform: scale(1);
          }
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default BingoCard;
