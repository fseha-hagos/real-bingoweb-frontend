// Game types matching your backend


export interface LeaderboardEntry {
  userId: string;
  telegramId?: string | null;
  username?: string | null;
  firstName?: string | null;
  phoneNumber?: string | null;
  totalWins: number;
  totalEarnings: number;
};

export interface GameSession {
  id: string;
  bet: number;
  players: Player[];
  status: "waiting" | "started" | "finished";
  calledNumbers: number[];
  possibleWin?: number;
  bonus?: number;
  maxPlayers?: number;
  startTime?: string;
  endTime?: string;
  winner?: Player;
  winType?: "standard" | "fullhouse";
  countdown?: {
    running: boolean;
    secondsLeft: number;
  };
  bingoClaimInProgress?: boolean;
}

export interface Cartela {
  id: number;
  numbers: number[][]; // 5x5 column-wise
}

export interface Player {
  id: string;
  name: string;
  username?: string | null;
  telegramUsername?: string | null;
  telegramId?: string | null;
  socketId?: string;
  cardNumber?: number;
  card?: Cartela;
  joinedAt?: string;
  isReady?: boolean;
  incorrectBingoClaims?: number;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface Tournament {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  bannerUrl?: string | null;
  betAmount: number;
  prizePool: number;
  status: 'scheduled' | 'active' | 'ended';
  startAt: string;
  endAt: string;
  timeLeftMs: number;
}

export interface User {
  id: string;
  telegramId?: string | null;
  name?: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  phoneNumber: string | null;
  registered: boolean;
  balance: number; // Decimal -> number
  isActive?: boolean;
  role?: 'ADMIN' | 'OPERATOR' | 'USER' | string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
  deletedAt?: string | Date | null;
  invitedByUserId?: string | null;
  invitedByTelegramId?: string | null;
}

export type UserSafeType = User;

//gameId, bet, playerName, playerId, cardNumber, userId / telegramId
export interface GameJoinRequest {
  gameId: string;
  bet: number;
  playerName: string;
  playerId: string;
  cardNumber: number;
  userId?: string;
  telegramId?: string;
}

export interface GameJoinResponse {
  success: boolean;
  gameId: string;
  playerId: string;
  message?: string;
  game?: GameSession;
}


export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}


export interface BingoWinPattern {
  win: boolean;
  type: "row" | "column" | "diagonal" | "fullhouse" | null;
  index: number | null;              // row index / column index / diagonal index
  positions: number[][];             // list of coordinates: [col,row]
}

export interface BingoWinEventPayload {
  winner: Player;               // the winning player object
  game: GameSession;            // full game data
  gameId: string;               // game id
  prize: number;                // prize amount
  winnerNewBalance?: number;    // updated balance after prize (optional)
  pattern: BingoWinPattern;     // win pattern details
}



export interface VerifyResponse {
  success: boolean;
  message?: string;
  error?: string;
  data?: {
    ok: boolean;
    user?: UserSafeType;
  };


}

export interface VerifyResponse {
  ok: boolean;
  user?: UserSafeType;
}

export interface MarkNumberRequest {
  gameId: string;
  number: number;
}

export interface SocketEvents {
  // Client to server events
  getGames: () => void;
  watchGame: (data: { bet: number }) => void;
  joinGame: (data: GameJoinRequest, callback: (response: { success: boolean; error?: string }) => void) => void;
  markNumber: (data: { gameId: string; bet: number; number: number; playerId: string }) => void;
  startGame: (data: { bet: string }) => void;

  // Server to client events
  gamesUpdate: (games: Record<number, GameSession>) => void;
  gameUpdate: (game: GameSession) => void;
  numberCalled: (data: { gameId: string; bet: number; number: number; calledNumbers: number[] }) => void;
  gameStarted: (data: { bet: number; game: GameSession }) => void;
  gameFinished: (data: { bet: number; winner?: Player; game: GameSession }) => void;
  playerJoined: (data: { bet: number; player: Player; game: GameSession }) => void;
  playerLeft: (data: { gameId: string; playerId: string; game: GameSession }) => void;
}

// Global type declarations
declare global {

  // Make GameSession available globally for compatibility
  interface GameSession {
    id: string;
    bet: number;
    players: Player[];
    status: "waiting" | "started" | "finished";
    calledNumbers: number[];
    possibleWin?: number;
    bonus?: number;
    maxPlayers?: number;
    startTime?: string;
    endTime?: string;
    winner?: Player;
  }

  interface Cartela {
    id: number;
    numbers: number[][];
  }

  interface Player {
    id: string;
    name: string;
    socketId?: string;
    card?: [][];
    cardNumber?: number;
    joinedAt?: string;
    isReady?: boolean;
  }
}

export { };
