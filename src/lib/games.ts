import { GameSession } from "../types/game";

export function gamesToRecord(
  payload: GameSession[] | Record<string, GameSession> | null | undefined
): Record<number, GameSession> {
  const gamesRecord: Record<number, GameSession> = {};

  if (!payload) return gamesRecord;

  if (Array.isArray(payload)) {
    payload.forEach((game) => {
      if (game?.bet) gamesRecord[game.bet] = game;
    });
    return gamesRecord;
  }

  Object.values(payload).forEach((game) => {
    if (game?.bet) gamesRecord[game.bet] = game;
  });

  return gamesRecord;
}
