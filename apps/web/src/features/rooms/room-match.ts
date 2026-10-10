import type { Room } from "@bankroll/contracts";

const isSeated = (room: Room, userId: string) => room.seats.some((s) => s.player.id === userId);

/** The match a seated player is sent to straight away. Only while it is being played. */
export function matchToEnter(room: Room | undefined, userId: string): string | null {
  if (!room || room.status !== "started" || !isSeated(room, userId)) return null;
  return room.matchId;
}

/** The match a seated player can open from the room, including one that has ended. */
export function matchToOpen(room: Room | undefined, userId: string): string | null {
  if (!room || room.status === "open" || !isSeated(room, userId)) return null;
  return room.matchId;
}
