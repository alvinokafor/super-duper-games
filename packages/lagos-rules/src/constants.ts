import type { MatchLength } from "@bankroll/contracts";

export const GAME_ID = "lagos-property";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

export const BOARD_SIZE = 28;

export const MISSED_TURNS_BEFORE_REMOVAL = 3;

// Placeholder values until the match-length rules are agreed.
export const ROUNDS_BY_LENGTH: Record<MatchLength, number> = {
  short: 24,
  normal: 48,
  long: 72,
};
