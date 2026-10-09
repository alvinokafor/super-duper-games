import { z } from "zod";

export const matchStatusSchema = z.enum(["lobby", "active", "finished", "abandoned"]);
export type MatchStatus = z.infer<typeof matchStatusSchema>;

export const matchLengthSchema = z.enum(["short", "normal", "long"]);
export type MatchLength = z.infer<typeof matchLengthSchema>;

export const playerStatusSchema = z.enum(["playing", "bankrupt", "removed", "watching"]);
export type PlayerStatus = z.infer<typeof playerStatusSchema>;

/** Public view of a match. Hidden data (deck order, dice setup) is never included. */
export const matchSnapshotSchema = <TState extends z.ZodType>(state: TState) =>
  z.object({
    matchId: z.uuid(),
    gameId: z.string(),
    status: matchStatusSchema,
    version: z.int().nonnegative(),
    turnDeadline: z.iso.datetime({ offset: true }).nullable(),
    state,
  });

/** One accepted move, as sent on the live channel and stored in the move log. */
export const matchEventEnvelopeSchema = <TEvent extends z.ZodType>(event: TEvent) =>
  z.object({
    matchId: z.uuid(),
    version: z.int().positive(),
    commandId: z.uuid().nullable(),
    events: z.array(event),
    createdAt: z.iso.datetime({ offset: true }),
  });

/** The same commandId must be reused on retry. A new id means a new move. */
export const commandRequestSchema = <TCommand extends z.ZodType>(command: TCommand) =>
  z.object({
    commandId: z.uuid(),
    command,
  });

/**
 * Sent as the reply to a command and on the live channel.
 * Carries the new public state so phones never rebuild state from events.
 */
export const matchUpdateSchema = <TState extends z.ZodType, TEvent extends z.ZodType>(
  state: TState,
  event: TEvent,
) =>
  z.object({
    snapshot: matchSnapshotSchema(state),
    applied: matchEventEnvelopeSchema(event),
  });
