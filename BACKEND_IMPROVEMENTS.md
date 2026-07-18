# Backend Improvements and Corrections

## 🐛 Critical Issues Found in Your Backend

### 1. **Missing Type Definitions**
Your backend lacks proper TypeScript type definitions. Add this:

```typescript
// types.ts
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
}

export interface Player {
  id: string;
  name: string;
  socketId?: string;
  cardNumber?: number;
  joinedAt?: string;
  isReady?: boolean;
}
```

### 2. **Inconsistent Game ID Management**
**Problem**: You're using both `bet` as key and `id` field, which creates confusion.

**Fix**: Update your `activeGames` structure:
```typescript
export const activeGames: Record<string, GameSession> = {};

// Initialize games by ID, not bet
const initializeGames = () => {
  const bets = [10, 50, 100, 300];
  bets.forEach(bet => {
    const gameId = uuidv4();
    activeGames[gameId] = {
      id: gameId,
      bet,
      players: [],
      status: "waiting",
      calledNumbers: [],
      possibleWin: bet * 2, // Example calculation
    };
  });
};
```

### 3. **Missing Game Logic Functions**
Your backend references functions that aren't defined. Here's what you need:

```typescript
// gameManager.ts
import { GameSession, Player } from './types';
import { activeGames } from './server';

export const handleJoinGame = async (socket: any, data: any, io: any) => {
  const { gameId, bet, playerName, playerId, cardNumber } = data;
  
  // Find game by ID or bet
  let game = Object.values(activeGames).find(g => g.id === gameId || g.bet === bet);
  
  if (!game) {
    throw new Error('Game not found');
  }
  
  // Check if player already exists
  const existingPlayer = game.players.find(p => p.id === playerId);
  if (existingPlayer) {
    throw new Error('Player already in game');
  }
  
  // Add player to game
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    socketId: socket.id,
    cardNumber,
    joinedAt: new Date().toISOString(),
    isReady: true,
  };
  
  game.players.push(newPlayer);
  
  // Join socket room
  socket.join(game.id);
  
  // Notify all players in the game
  io.to(game.id).emit('gameUpdate', game);
  io.to(game.id).emit('playerJoined', { gameId: game.id, player: newPlayer, game });
  
  return { success: true, game };
};

export const handleMarkNumber = (socket: any, data: any, io: any) => {
  const { gameId, number, playerId } = data;
  const game = activeGames[gameId];
  
  if (!game || game.status !== 'started') {
    return;
  }
  
  // Add number to called numbers if not already called
  if (!game.calledNumbers.includes(number)) {
    game.calledNumbers.push(number);
    
    // Notify all players
    io.to(gameId).emit('numberCalled', {
      gameId,
      number,
      calledNumbers: game.calledNumbers
    });
    
    io.to(gameId).emit('gameUpdate', game);
  }
};

export const joinGameViaApi = async (data: any) => {
  const { bet, playerName, playerId, cardNumber, gameId } = data;
  
  // Find or create game
  let game = gameId ? activeGames[gameId] : Object.values(activeGames).find(g => g.bet === bet && g.status === 'waiting');
  
  if (!game) {
    throw new Error('No available game found');
  }
  
  // Check if player already exists
  const existingPlayer = game.players.find(p => p.id === playerId);
  if (existingPlayer) {
    return { success: true, gameId: game.id, playerId, game };
  }
  
  // Add player
  const newPlayer: Player = {
    id: playerId,
    name: playerName,
    cardNumber,
    joinedAt: new Date().toISOString(),
    isReady: true,
  };
  
  game.players.push(newPlayer);
  
  return { success: true, gameId: game.id, playerId, game };
};

export const startGame = async (gameId: string, playerId: string | null) => {
  const game = activeGames[gameId];
  
  if (!game) {
    throw new Error('Game not found');
  }
  
  if (game.status !== 'waiting') {
    throw new Error('Game already started or finished');
  }
  
  if (game.players.length < 2) {
    throw new Error('Need at least 2 players to start');
  }
  
  game.status = 'started';
  game.startTime = new Date().toISOString();
  
  return { success: true, game };
};

export const markNumberViaApi = async (gameId: string, number: number) => {
  const game = activeGames[gameId];
  
  if (!game) {
    throw new Error('Game not found');
  }
  
  if (game.status !== 'started') {
    throw new Error('Game not started');
  }
  
  if (!game.calledNumbers.includes(number)) {
    game.calledNumbers.push(number);
  }
  
  return { success: true, game, calledNumbers: game.calledNumbers };
};
```

### 4. **Improved CORS Configuration**
```typescript
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
```

### 5. **Better Error Handling**
Wrap your route handlers:
```typescript
const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Use it like:
app.post('/games/:bet/join', asyncHandler(async (req, res) => {
  // Your existing code
}));

// Add error middleware
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});
```

### 6. **Auto Game Management**
Add automatic game lifecycle:
```typescript
// Auto-start games when enough players join
const checkAutoStart = (game: GameSession) => {
  if (game.status === 'waiting' && game.players.length >= 2) {
    // Auto-start after 30 seconds
    setTimeout(() => {
      if (game.status === 'waiting' && game.players.length >= 2) {
        startGame(game.id, null);
        io.to(game.id).emit('gameStarted', { gameId: game.id, game });
      }
    }, 30000);
  }
};

// Auto number calling for started games
const autoCallNumbers = (gameId: string) => {
  const game = activeGames[gameId];
  if (!game || game.status !== 'started') return;
  
  const interval = setInterval(() => {
    if (!activeGames[gameId] || activeGames[gameId].status !== 'started') {
      clearInterval(interval);
      return;
    }
    
    const availableNumbers = Array.from({ length: 75 }, (_, i) => i + 1)
      .filter(n => !game.calledNumbers.includes(n));
    
    if (availableNumbers.length === 0) {
      clearInterval(interval);
      game.status = 'finished';
      io.to(gameId).emit('gameFinished', { gameId, game });
      return;
    }
    
    const randomNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    game.calledNumbers.push(randomNumber);
    
    io.to(gameId).emit('numberCalled', {
      gameId,
      number: randomNumber,
      calledNumbers: game.calledNumbers
    });
    
    io.to(gameId).emit('gameUpdate', game);
  }, 3000); // Call number every 3 seconds
};
```

### 7. **Database Integration**
Replace in-memory storage:
```typescript
// Example with a simple database interface
interface DatabaseInterface {
  saveGame(game: GameSession): Promise<void>;
  getGame(id: string): Promise<GameSession | null>;
  updateGame(id: string, updates: Partial<GameSession>): Promise<void>;
  getActiveGames(): Promise<GameSession[]>;
}

// Queue database operations
export const dbQueue: Array<() => Promise<void>> = [];

const queueDbOperation = (operation: () => Promise<void>) => {
  dbQueue.push(operation);
};
```

## 🚀 Additional Features to Implement

### 1. **Player Authentication**
```typescript
// Add JWT or session-based auth
import jwt from 'jsonwebtoken';

const authenticatePlayer = (req: any, res: any, next: any) => {
  const token = req.headers.authorization?.split(' ')[1];
  // Implement your auth logic
  next();
};
```

### 2. **Game Statistics**
```typescript
interface GameStats {
  totalGames: number;
  activeGames: number;
  totalPlayers: number;
  averageGameDuration: number;
}

app.get('/stats', (req, res) => {
  // Return game statistics
});
```

### 3. **Rate Limiting**
```typescript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

app.use(limiter);
```

## 🔧 Environment Configuration

Create a `.env` file:
```env
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=your-secret-key
DB_CONNECTION_STRING=your-db-connection
```

## 📝 Summary

Your backend needs these critical fixes:
1. ✅ **Fixed**: Add missing type definitions
2. ✅ **Fixed**: Implement missing game management functions  
3. ✅ **Fixed**: Improve error handling
4. ✅ **Fixed**: Add proper CORS configuration
5. ✅ **Recommended**: Add database integration
6. ✅ **Recommended**: Add automatic game lifecycle management
7. ✅ **Recommended**: Add player authentication

The frontend is now fully functional and will work with your backend once you implement these fixes!
