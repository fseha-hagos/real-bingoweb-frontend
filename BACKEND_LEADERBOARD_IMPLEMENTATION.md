# Backend Leaderboard Implementation Guide

This guide shows how to implement daily and weekly leaderboard support in your backend.

## Overview

The frontend now sends a `type` parameter with the `getLeaderboard` socket event:
- `{ type: "all" }` - All-time leaderboard
- `{ type: "daily" }` - Today's leaderboard (00:00:00 to 23:59:59)
- `{ type: "weekly" }` - Current week's leaderboard (Sunday 00:00:00 to Saturday 23:59:59)

## Database Schema Assumptions

Assuming you have a database table for tracking game wins/earnings, here's the expected structure:

```sql
-- Example schema (adjust to your actual database)
CREATE TABLE game_wins (
  id SERIAL PRIMARY KEY,
  telegram_id VARCHAR(255) NOT NULL,
  username VARCHAR(255),
  first_name VARCHAR(255),
  earnings DECIMAL(10, 2) NOT NULL,
  win_count INTEGER DEFAULT 1,
  game_id VARCHAR(255),
  won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_telegram_id (telegram_id),
  INDEX idx_won_at (won_at)
);

-- Or if you track wins separately from games:
CREATE TABLE user_stats (
  telegram_id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255),
  first_name VARCHAR(255),
  total_wins INTEGER DEFAULT 0,
  total_earnings DECIMAL(10, 2) DEFAULT 0,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE game_results (
  id SERIAL PRIMARY KEY,
  telegram_id VARCHAR(255) NOT NULL,
  game_id VARCHAR(255),
  earnings DECIMAL(10, 2) NOT NULL,
  won_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (telegram_id) REFERENCES user_stats(telegram_id),
  INDEX idx_telegram_id (telegram_id),
  INDEX idx_won_at (won_at)
);
```

## Socket Handler Implementation

Here's how to update your `getLeaderboard` socket handler:

### TypeScript/Node.js Example

```typescript
import { Server, Socket } from 'socket.io';

// Helper function to get date ranges
interface DateRange {
  start: Date;
  end: Date;
}

function getDateRangeForType(type: 'all' | 'daily' | 'weekly'): DateRange | null {
  const now = new Date();
  
  if (type === 'all') {
    return null; // No date filter for all-time
  }
  
  if (type === 'daily') {
    // Today from 00:00:00 to 23:59:59
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    
    return { start, end };
  }
  
  if (type === 'weekly') {
    // Week from Sunday 00:00:00 to Saturday 23:59:59
    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const diff = startOfWeek.getDate() - day; // Days to subtract to get Sunday
    startOfWeek.setDate(diff);
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6); // Add 6 days to get Saturday
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek, end: endOfWeek };
  }
  
  return null;
}

// SQL Query Example (PostgreSQL)
async function getLeaderboardFromDB(
  type: 'all' | 'daily' | 'weekly',
  db: any // Your database client (pg, mysql2, etc.)
): Promise<LeaderboardEntry[]> {
  const dateRange = getDateRangeForType(type);
  
  let query = `
    SELECT 
      telegram_id,
      username,
      first_name,
      COUNT(*) as total_wins,
      SUM(earnings) as total_earnings
    FROM game_wins
  `;
  
  const params: any[] = [];
  
  // Add date filter for daily/weekly
  if (dateRange) {
    query += ` WHERE won_at >= $1 AND won_at <= $2`;
    params.push(dateRange.start, dateRange.end);
  }
  
  query += `
    GROUP BY telegram_id, username, first_name
    ORDER BY total_wins DESC, total_earnings DESC
    LIMIT 100
  `;
  
  const result = await db.query(query, params);
  
  return result.rows.map((row: any) => ({
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    totalWins: parseInt(row.total_wins, 10),
    totalEarnings: parseFloat(row.total_earnings),
  }));
}

// Alternative: Using separate user_stats and game_results tables
async function getLeaderboardFromDBAlternative(
  type: 'all' | 'daily' | 'weekly',
  db: any
): Promise<LeaderboardEntry[]> {
  const dateRange = getDateRangeForType(type);
  
  let query = `
    SELECT 
      us.telegram_id,
      us.username,
      us.first_name,
      COALESCE(COUNT(gr.id), 0) as total_wins,
      COALESCE(SUM(gr.earnings), 0) as total_earnings
    FROM user_stats us
    LEFT JOIN game_results gr ON us.telegram_id = gr.telegram_id
  `;
  
  const params: any[] = [];
  
  if (dateRange) {
    query += ` WHERE gr.won_at >= $1 AND gr.won_at <= $2`;
    params.push(dateRange.start, dateRange.end);
  }
  
  query += `
    GROUP BY us.telegram_id, us.username, us.first_name
    HAVING COUNT(gr.id) > 0
    ORDER BY total_wins DESC, total_earnings DESC
    LIMIT 100
  `;
  
  const result = await db.query(query, params);
  
  return result.rows.map((row: any) => ({
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    totalWins: parseInt(row.total_wins, 10),
    totalEarnings: parseFloat(row.total_earnings),
  }));
}

// Socket handler
export function handleGetLeaderboard(socket: Socket, io: Server) {
  socket.on('getLeaderboard', async (data: { type?: 'all' | 'daily' | 'weekly' }) => {
    try {
      const leaderboardType = data?.type || 'all';
      
      console.log(`📊 Fetching ${leaderboardType} leaderboard`);
      
      // Get leaderboard data from database
      const leaderboard = await getLeaderboardFromDB(leaderboardType, db);
      
      // Send back to the requesting client
      socket.emit('leaderboardUpdate', leaderboard);
      
      console.log(`✅ Sent ${leaderboard.length} entries for ${leaderboardType} leaderboard`);
    } catch (error) {
      console.error('❌ Error fetching leaderboard:', error);
      socket.emit('leaderboardUpdate', []);
    }
  });
}

// Register the handler
io.on('connection', (socket) => {
  handleGetLeaderboard(socket, io);
  // ... other handlers
});
```

### MongoDB Example

```typescript
import { MongoClient, Collection } from 'mongodb';

async function getLeaderboardFromMongo(
  type: 'all' | 'daily' | 'weekly',
  collection: Collection
): Promise<LeaderboardEntry[]> {
  const dateRange = getDateRangeForType(type);
  
  const matchStage: any = {};
  
  if (dateRange) {
    matchStage.wonAt = {
      $gte: dateRange.start,
      $lte: dateRange.end,
    };
  }
  
  const pipeline = [
    { $match: matchStage },
    {
      $group: {
        _id: '$telegramId',
        telegramId: { $first: '$telegramId' },
        username: { $first: '$username' },
        firstName: { $first: '$firstName' },
        totalWins: { $sum: 1 },
        totalEarnings: { $sum: '$earnings' },
      },
    },
    {
      $project: {
        _id: 0,
        telegramId: 1,
        username: 1,
        firstName: 1,
        totalWins: 1,
        totalEarnings: 1,
      },
    },
    { $sort: { totalWins: -1, totalEarnings: -1 } },
    { $limit: 100 },
  ];
  
  const results = await collection.aggregate(pipeline).toArray();
  
  return results.map((doc: any) => ({
    telegramId: doc.telegramId,
    username: doc.username,
    firstName: doc.firstName,
    totalWins: doc.totalWins,
    totalEarnings: doc.totalEarnings,
  }));
}
```

### Prisma ORM Example

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getLeaderboardWithPrisma(
  type: 'all' | 'daily' | 'weekly'
): Promise<LeaderboardEntry[]> {
  const dateRange = getDateRangeForType(type);
  
  const results = await prisma.gameWin.groupBy({
    by: ['telegramId'],
    where: dateRange
      ? {
          wonAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }
      : {},
    _count: {
      id: true,
    },
    _sum: {
      earnings: true,
    },
    orderBy: [
      {
        _count: {
          id: 'desc',
        },
      },
      {
        _sum: {
          earnings: 'desc',
        },
      },
    ],
    take: 100,
  });
  
  // Get user details for each entry
  const telegramIds = results.map((r) => r.telegramId);
  const users = await prisma.user.findMany({
    where: {
      telegramId: {
        in: telegramIds,
      },
    },
    select: {
      telegramId: true,
      username: true,
      firstName: true,
    },
  });
  
  const userMap = new Map(users.map((u) => [u.telegramId, u]));
  
  return results.map((result) => {
    const user = userMap.get(result.telegramId);
    return {
      telegramId: result.telegramId,
      username: user?.username || null,
      firstName: user?.firstName || null,
      totalWins: result._count.id,
      totalEarnings: result._sum.earnings || 0,
    };
  });
}
```

## Complete Socket Handler with Error Handling

```typescript
import { Server, Socket } from 'socket.io';

export function setupLeaderboardHandlers(io: Server, db: any) {
  io.on('connection', (socket: Socket) => {
    socket.on('getLeaderboard', async (data: { type?: 'all' | 'daily' | 'weekly' }) => {
      try {
        const leaderboardType = data?.type || 'all';
        
        // Validate type
        if (!['all', 'daily', 'weekly'].includes(leaderboardType)) {
          console.warn(`Invalid leaderboard type: ${leaderboardType}, defaulting to 'all'`);
          leaderboardType = 'all';
        }
        
        console.log(`📊 Fetching ${leaderboardType} leaderboard for socket ${socket.id}`);
        
        // Fetch from database
        const leaderboard = await getLeaderboardFromDB(leaderboardType, db);
        
        // Send response
        socket.emit('leaderboardUpdate', leaderboard);
        
        console.log(`✅ Sent ${leaderboard.length} entries for ${leaderboardType} leaderboard`);
      } catch (error) {
        console.error('❌ Error fetching leaderboard:', error);
        
        // Send empty array on error
        socket.emit('leaderboardUpdate', []);
        
        // Optionally send error to client
        socket.emit('error', {
          message: 'Failed to fetch leaderboard',
          type: 'leaderboard_error',
        });
      }
    });
  });
}
```

## Testing

To test your implementation, you can use this test data:

```typescript
// Insert test data for different time periods
async function insertTestData(db: any) {
  const now = new Date();
  
  // Today's wins
  await db.query(`
    INSERT INTO game_wins (telegram_id, username, first_name, earnings, won_at)
    VALUES 
      ('user1', 'testuser1', 'Test', 100.50, NOW()),
      ('user2', 'testuser2', 'User', 200.75, NOW())
  `);
  
  // This week's wins (from Sunday)
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Get to Sunday
  startOfWeek.setHours(0, 0, 0, 0);
  
  await db.query(`
    INSERT INTO game_wins (telegram_id, username, first_name, earnings, won_at)
    VALUES 
      ('user3', 'testuser3', 'Week', 150.00, $1)
  `, [startOfWeek]);
  
  // Last week's wins (should not appear in weekly leaderboard)
  const lastWeek = new Date(startOfWeek);
  lastWeek.setDate(lastWeek.getDate() - 7);
  
  await db.query(`
    INSERT INTO game_wins (telegram_id, username, first_name, earnings, won_at)
    VALUES 
      ('user4', 'testuser4', 'Old', 50.00, $1)
  `, [lastWeek]);
}
```

## Important Notes

1. **Timezone**: Make sure your database and application use the same timezone (preferably UTC) for consistent results
2. **Performance**: Add database indexes on `telegram_id` and `won_at` columns for faster queries
3. **Caching**: Consider caching daily/weekly leaderboards since they don't change as frequently
4. **Week Start**: The implementation uses Sunday as the start of the week (as requested). If your locale uses Monday, adjust the calculation accordingly.

## Example Caching Implementation

```typescript
import NodeCache from 'node-cache';

const leaderboardCache = new NodeCache({ 
  stdTTL: 60, // Cache for 60 seconds
  checkperiod: 30,
});

async function getCachedLeaderboard(
  type: 'all' | 'daily' | 'weekly',
  db: any
): Promise<LeaderboardEntry[]> {
  const cacheKey = `leaderboard:${type}`;
  
  // Check cache first
  const cached = leaderboardCache.get<LeaderboardEntry[]>(cacheKey);
  if (cached) {
    console.log(`📦 Serving ${type} leaderboard from cache`);
    return cached;
  }
  
  // Fetch from database
  const leaderboard = await getLeaderboardFromDB(type, db);
  
  // Cache based on type
  const ttl = type === 'all' ? 300 : type === 'daily' ? 60 : 300; // 5min, 1min, 5min
  leaderboardCache.set(cacheKey, leaderboard, ttl);
  
  return leaderboard;
}
```

## Integration

Add this to your main server file:

```typescript
// server.ts or index.ts
import { setupLeaderboardHandlers } from './handlers/leaderboard';
import { db } from './database'; // Your database connection

// ... other setup code ...

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

setupLeaderboardHandlers(io, db);
```

This should help you implement the backend logic for daily and weekly leaderboards!

