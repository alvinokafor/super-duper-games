import { playerStatusSchema } from "@bankroll/contracts";
import { z } from "zod";
import { BUILDING_IDS, COMMERCIAL_IDS, RESIDENTIAL_IDS } from "./buildings";
import { BOARD_SIZE } from "./constants";

const naira = z.int();
const dieValue = z.int().min(1).max(6);
const space = z.int().min(0).max(BOARD_SIZE - 1);
const buildingId = z.enum(BUILDING_IDS);

/** What stands on one space. Utilities and special spaces stay empty. */
export const slotsSchema = z.object({
  commercial: z.enum(COMMERCIAL_IDS).nullable(),
  residential: z.enum(RESIDENTIAL_IDS).nullable(),
  hotel: z.boolean(),
});
export type Slots = z.infer<typeof slotsSchema>;

export const emptyBuildings = (): Slots[] =>
  Array.from({ length: BOARD_SIZE }, () => ({ commercial: null, residential: null, hotel: false }));

export const lagosPlayerSchema = z.object({
  id: z.string(),
  /** Turn order, decided by a shuffle at match start. */
  seat: z.int().min(0),
  cash: naira,
  position: space,
  status: playerStatusSchema,
  missedTurns: z.int().min(0),
});
export type LagosPlayer = z.infer<typeof lagosPlayerSchema>;

export const turnPhaseSchema = z.enum(["awaiting_roll", "awaiting_purchase", "awaiting_action", "finished"]);
export type TurnPhase = z.infer<typeof turnPhaseSchema>;

/** Everything players are allowed to see. */
export const lagosPublicStateSchema = z.object({
  round: z.int().min(1),
  maxRounds: z.int().min(1),
  currentPlayerId: z.string(),
  phase: turnPhaseSchema,
  lastRoll: dieValue.nullable(),
  players: z.array(lagosPlayerSchema),
  /** Owner of each space by board index. Null means the bank owns it. */
  owners: z.array(z.string().nullable()).length(BOARD_SIZE),
  /** Buildings on each space by board index. Matches saved before buildings existed have none. */
  buildings: z.array(slotsSchema).length(BOARD_SIZE).default(emptyBuildings),
  /** Set when the match ends. More than one id means a shared win. */
  winnerIds: z.array(z.string()).nullable(),
});
export type LagosPublicState = z.infer<typeof lagosPublicStateSchema>;

/** Server-only. Never sent to phones. Empty until card decks arrive. */
export type LagosHiddenState = Record<string, never>;

export interface LagosState {
  public: LagosPublicState;
  hidden: LagosHiddenState;
}

export const lagosCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("roll_dice") }),
  // The space the player sees on their card, so a phone running an older
  // board can never buy a different property from the one it showed.
  z.object({ type: z.literal("buy_property"), space }),
  z.object({ type: z.literal("pass_property") }),
  z.object({ type: z.literal("build"), space, building: buildingId }),
  z.object({ type: z.literal("end_turn") }),
]);
export type LagosCommand = z.infer<typeof lagosCommandSchema>;

export const lagosEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dice_rolled"), playerId: z.string(), value: dieValue }),
  z.object({
    type: z.literal("token_moved"),
    playerId: z.string(),
    from: space,
    to: space,
    passedGo: z.boolean(),
  }),
  z.object({
    type: z.literal("payday"),
    playerId: z.string(),
    income: naira,
    costs: naira,
    amount: naira,
  }),
  z.object({ type: z.literal("property_bought"), playerId: z.string(), space, price: naira }),
  z.object({ type: z.literal("property_passed"), playerId: z.string(), space }),
  z.object({
    type: z.literal("building_built"),
    playerId: z.string(),
    space,
    building: buildingId,
    cost: naira,
    replaced: buildingId.nullable(),
  }),
  /** `owed` is the full charge; `amount` is what was paid when cash ran short. */
  z.object({
    type: z.literal("rent_paid"),
    playerId: z.string(),
    ownerId: z.string(),
    space,
    amount: naira,
    owed: naira,
  }),
  z.object({ type: z.literal("turn_started"), playerId: z.string(), round: z.int() }),
  z.object({ type: z.literal("turn_timed_out"), playerId: z.string(), missedTurns: z.int() }),
  z.object({ type: z.literal("player_removed"), playerId: z.string() }),
  z.object({ type: z.literal("match_finished"), winnerIds: z.array(z.string()) }),
]);
export type LagosEvent = z.infer<typeof lagosEventSchema>;
