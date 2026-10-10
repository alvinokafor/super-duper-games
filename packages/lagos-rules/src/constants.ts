export const GAME_ID = "lagos-property";

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;

export const BOARD_SIZE = 28;

export const STARTING_CASH = 75_000;

export const MISSED_TURNS_BEFORE_REMOVAL = 3;

// Placeholder values. The decision log says the cap goes down as players go
// up; the real numbers come from pacing simulations.
export const ROUNDS_BY_PLAYER_COUNT: Record<number, number> = {
  3: 48,
  4: 40,
  5: 34,
  6: 30,
};

/** How long the server waits in each phase before playing the default move. */
export const PHASE_SECONDS = {
  awaiting_roll: 30,
  awaiting_purchase: 30,
  awaiting_action: 30,
} as const;
