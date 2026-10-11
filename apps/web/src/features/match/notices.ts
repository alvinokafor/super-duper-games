import { BOARD, BUILDINGS, type LagosEvent } from "@bankroll/lagos-rules";
import { formatNaira } from "@/lib/format";

/** The line shown on the board for a rent payment or someone else's build. */
export function noticeText(event: LagosEvent, myId: string, names: Map<string, string>): string | null {
  const who = (id: string, start: boolean) => (id === myId ? (start ? "You" : "you") : (names.get(id) ?? "Player"));
  if (event.type === "rent_paid") {
    const kind = BOARD[event.space]?.kind === "utility" ? "fee" : "rent";
    if (event.amount === 0) {
      const owner = event.ownerId === myId ? "your" : `${names.get(event.ownerId) ?? "Player"}'s`;
      return `${who(event.playerId, true)} had no cash for ${owner} ${formatNaira(event.owed)} ${kind}`;
    }
    const paid =
      event.amount < event.owed
        ? `${formatNaira(event.amount)} of ${formatNaira(event.owed)} ${kind}`
        : `${formatNaira(event.amount)} ${kind}`;
    return `${who(event.playerId, true)} paid ${who(event.ownerId, false)} ${paid}`;
  }
  if (event.type === "building_built") {
    const verb = event.replaced ? "upgraded to" : "built";
    const name = BUILDINGS[event.building].name;
    const article = /^[AEIOU]/.test(name) ? "an" : "a";
    return `${who(event.playerId, true)} ${verb} ${article} ${name} on ${BOARD[event.space]!.name}`;
  }
  return null;
}
