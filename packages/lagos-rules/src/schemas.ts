import { playerStatusSchema } from "@bankroll/contracts";
import { z } from "zod";

const naira = z.int();
const dice = z.tuple([z.int().min(1).max(6), z.int().min(1).max(6)]);

export const lagosPlayerSchema = z.object({
  id: z.string(),
  seat: z.int().min(0),
  cash: naira,
  position: z.int().min(0),
  status: playerStatusSchema,
  missedTurns: z.int().min(0),
});
export type LagosPlayer = z.infer<typeof lagosPlayerSchema>;

export const turnPhaseSchema = z.enum(["awaiting_roll", "awaiting_action", "finished"]);
export type TurnPhase = z.infer<typeof turnPhaseSchema>;

/** Everything players are allowed to see. */
export const lagosPublicStateSchema = z.object({
  round: z.int().min(1),
  maxRounds: z.int().min(1),
  currentPlayerId: z.string(),
  phase: turnPhaseSchema,
  lastRoll: dice.nullable(),
  players: z.array(lagosPlayerSchema),
});
export type LagosPublicState = z.infer<typeof lagosPublicStateSchema>;

/** Server-only. Never sent to phones. */
export interface LagosHiddenState {
  rngState: number;
}

export interface LagosState {
  public: LagosPublicState;
  hidden: LagosHiddenState;
}

export const lagosCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll_dice") }),
  z.object({ type: z.literal("end_turn") }),
]);
export type LagosCommand = z.infer<typeof lagosCommandSchema>;

export const lagosEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dice_rolled"), playerId: z.string(), dice }),
  z.object({
    type: z.literal("token_moved"),
    playerId: z.string(),
    from: z.int(),
    to: z.int(),
  }),
  z.object({ type: z.literal("turn_started"), playerId: z.string(), round: z.int() }),
  z.object({ type: z.literal("turn_timed_out"), playerId: z.string(), missedTurns: z.int() }),
  z.object({ type: z.literal("player_removed"), playerId: z.string() }),
  z.object({ type: z.literal("match_finished") }),
]);
export type LagosEvent = z.infer<typeof lagosEventSchema>;
