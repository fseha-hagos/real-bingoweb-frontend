// API client for REST endpoints
// import toast from 'react-hot-toast';
import {
  GameSession,
  GameJoinRequest,
  GameJoinResponse,
  ApiResponse,
  MarkNumberRequest,
  VerifyResponse,
} from '../types/game';

const PRODUCTION_BACKEND_URL = "https://real-bingoweb-backend.onrender.com";

export function getApiBaseUrl(): string {
  return (
    process.env.BACKEND_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    PRODUCTION_BACKEND_URL
  );
}

function resolveRequestBaseUrl(endpoint: string): string {
  if (
    typeof window !== "undefined" &&
    (endpoint.startsWith("/api/") ||
      endpoint.startsWith("/games") ||
      endpoint === "/health" ||
      endpoint.startsWith("/wallet/"))
  ) {
    return "";
  }
  return getApiBaseUrl();
}

export const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = getApiBaseUrl()) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs = 15000
  ): Promise<ApiResponse<T>> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = `${resolveRequestBaseUrl(endpoint)}${endpoint}`;
      const config: RequestInit = {
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': 'true',
          ...options.headers,
        },
        credentials: 'include',
        ...options,
        signal: controller.signal,
      };

      // Promise.race: Telegram WebView sometimes ignores AbortSignal; still unblock callers
      const response = await Promise.race([
        fetch(url, config),
        new Promise<never>((_, reject) => {
          setTimeout(
            () => reject(Object.assign(new Error('Request timeout'), { name: 'AbortError' })),
            timeoutMs + 500
          );
        }),
      ]);

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        const errorData = (json || {}) as { error?: string; message?: string };
        return {
          success: false,
          error:
            errorData.error ||
            errorData.message ||
            `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // Unwrap { success, data } envelopes from /api/* while keeping raw payloads (/games, /health)
      if (
        json &&
        typeof json === "object" &&
        !Array.isArray(json) &&
        "success" in json &&
        typeof (json as { success: unknown }).success === "boolean"
      ) {
        const wrapped = json as {
          success: boolean;
          data?: T;
          error?: string;
          message?: string;
        };
        return {
          success: wrapped.success,
          data: wrapped.data,
          error: wrapped.error || wrapped.message,
        };
      }

      return { success: true, data: json as T };
    } catch (err) {
      console.error('API request failed:', err);
      return {
        success: false,
        error: err instanceof Error && err.name === 'AbortError'
          ? 'Request timeout'
          : err instanceof Error ? err.message : 'Network error',
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ✅ Current authenticated player
  async getMe(): Promise<ApiResponse<{ user: import('../types/game').UserSafeType }>> {
    return this.request<{ user: import('../types/game').UserSafeType }>("/api/me", {
      method: "GET",
      credentials: "include",
    });
  }

  async updateMe(payload: {
    name?: string;
    username?: string;
  }): Promise<ApiResponse<{ user: import('../types/game').UserSafeType }>> {
    return this.request<{ user: import('../types/game').UserSafeType }>("/api/me", {
      method: "PATCH",
      credentials: "include",
      body: JSON.stringify(payload),
    });
  }

  /** After OTP signup — set password for future phone+password logins */
  async setPassword(password: string): Promise<ApiResponse<{ user: import('../types/game').UserSafeType }>> {
    return this.request<{ user: import('../types/game').UserSafeType }>("/api/me/set-password", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ password }),
    });
  }

  async getProfile(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request("/api/profile", {
      method: "GET",
      credentials: "include",
    });
  }

  async getWalletConfig(): Promise<ApiResponse<{
    minDeposit: number;
    minWithdraw: number;
    maxWithdraw: number;
    methods: { id: string; label: string; phone: string | null }[];
  }>> {
    return this.request("/api/wallet/config", {
      method: "GET",
      credentials: "include",
    });
  }

  async createDeposit(amount: number, method: string): Promise<ApiResponse<{
    requestId: string;
    amount: number;
    method: string;
    paymentPhone: string;
    instructions: string;
    steps?: {
      methodTitle: string;
      amount: number;
      paymentPhone: string;
      steps: string[];
      note: string;
    };
    status: string;
  }>> {
    return this.request("/api/wallet/deposit", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ amount, method }),
    });
  }

  async createWithdraw(amount: number): Promise<ApiResponse<{
    requestId: string;
    amount: number;
    status: string;
    phoneNumber: string;
  }>> {
    return this.request("/api/wallet/withdraw", {
      method: "POST",
      credentials: "include",
      body: JSON.stringify({ amount }),
    });
  }

  async getWalletRequests(): Promise<ApiResponse<Array<{
    id: string;
    type: string;
    amount: number;
    status: string;
    phoneNumber: string | null;
    createdAt: string;
  }>>> {
    return this.request("/api/wallet/requests", {
      method: "GET",
      credentials: "include",
    });
  }

  // ✅ Verify Telegram WebApp User (legacy)
  async verifyTelegramUser(initData: string): Promise<ApiResponse<VerifyResponse>> {
    return this.request<VerifyResponse>("/api/verify-user", {
      method: "POST",
      body: JSON.stringify({ initData }),
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string }>> {
    return this.request('/health');
  }

  // Get all games
  async getGames(): Promise<ApiResponse<GameSession[]>> {
    return this.request<GameSession[]>('/games');
  }

  // Get single game by ID
  async getGame(gameId: string): Promise<ApiResponse<GameSession>> {
    return this.request<GameSession>(`/games/${gameId}`);
  }

  // Join a game by bet amount
  async joinGame(
    bet: number,
    joinData: Omit<GameJoinRequest, 'bet'>
  ): Promise<ApiResponse<GameJoinResponse>> {
    return this.request<GameJoinResponse>(`/games/${bet}/join`, {
      method: 'POST',
      body: JSON.stringify({ ...joinData, bet }),
    });
  }

  // Start a specific game
  async startGame(gameId: string): Promise<ApiResponse<{ started: boolean; id: string }>> {
    return this.request<{ started: boolean; id: string }>(`/games/${gameId}/start`, {
      method: 'POST',
    });
  }

  // Mark a number in a game
  async markNumber(data: MarkNumberRequest): Promise<ApiResponse<null>> {
    return this.request<null>(`/games/${data.gameId}/mark`, {
      method: 'POST',
      body: JSON.stringify({ number: data.number }),
    });
  }

  // Utility: check server health
  async isServerHealthy(): Promise<boolean> {
    const result = await this.healthCheck();
    return result.success && result.data?.status === 'ok';
  }

  // Filter games by status
  async getGamesByStatus(status: 'waiting' | 'started' | 'finished'): Promise<ApiResponse<GameSession[]>> {
    const result = await this.getGames();
    if (!result.success || !result.data) return result;
    const filteredGames = result.data.filter(game => game.status === status);
    return { success: true, data: filteredGames };
  }

  // Get available games (waiting or started)
  async getAvailableGames(): Promise<ApiResponse<GameSession[]>> {
    const result = await this.getGames();
    if (!result.success || !result.data) return result;
    const availableGames = result.data.filter(game => game.status === 'waiting' || game.status === 'started');
    return { success: true, data: availableGames };
  }
}

// Singleton instance
export const apiClient = new ApiClient();
export { ApiClient };

// Helper functions
export const gameApi = {
  quickJoin: async (
    gameId: string,
    bet: number,
    playerName: string,
    playerId: string,
    cardNumber: number,
    telegramId: string
  ) => apiClient.joinGame(bet, { gameId, playerName, playerId, cardNumber, telegramId }),

  canJoinGame: async (gameId: string): Promise<boolean> => {
    const result = await apiClient.getGame(gameId);
    if (!result.success || !result.data) return false;
    const game = result.data;
    return game.status === 'waiting' && (!game.maxPlayers || game.players.length < game.maxPlayers);
  },

  getGameStats: async (gameId: string) => {
    const result = await apiClient.getGame(gameId);
    if (!result.success || !result.data) return null;
    const game = result.data;
    const totalPossibleNumbers = 75;
    return {
      playerCount: game.players.length,
      maxPlayers: game.maxPlayers ?? 10,
      isWaiting: game.status === 'waiting',
      isStarted: game.status === 'started',
      isFinished: game.status === 'finished',
      calledNumbersCount: game.calledNumbers.length,
      totalPossibleNumbers,
      progressPercentage: (game.calledNumbers.length / totalPossibleNumbers) * 100,
    };
  },
};

export default apiClient;
