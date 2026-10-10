import type { Room } from "@bankroll/contracts";
import { describe, expect, it } from "vitest";
import { matchToEnter, matchToOpen } from "./room-match";

const matchId = "00000000-0000-4000-8000-0000000000aa";

const room = (status: Room["status"], seated: string[], linked: string | null = matchId): Room => ({
  id: "00000000-0000-4000-8000-000000000001",
  gameId: "lagos-property",
  gameName: "Lagos Property",
  hostId: seated[0] ?? "host",
  status,
  minPlayers: 3,
  maxPlayers: 6,
  groupId: null,
  matchId: linked,
  seats: seated.map((id, seat) => ({
    seat,
    player: { id, username: id, displayName: id, avatarUrl: null },
  })),
});

describe("going from the lobby to the match", () => {
  it("sends seated players to the match once it starts", () => {
    expect(matchToEnter(room("started", ["a", "b", "c"]), "b")).toBe(matchId);
  });

  it("keeps everyone in the lobby before the start", () => {
    expect(matchToEnter(room("open", ["a", "b", "c"], null), "a")).toBeNull();
    expect(matchToOpen(room("open", ["a", "b", "c"], null), "a")).toBeNull();
  });

  it("never sends someone without a seat", () => {
    expect(matchToEnter(room("started", ["a", "b", "c"]), "z")).toBeNull();
    expect(matchToOpen(room("closed", ["a", "b", "c"]), "z")).toBeNull();
  });

  it("does not jump into a finished match but still offers it", () => {
    const finished = room("closed", ["a", "b", "c"]);
    expect(matchToEnter(finished, "a")).toBeNull();
    expect(matchToOpen(finished, "a")).toBe(matchId);
  });

  it("offers nothing for a room that closed without a match", () => {
    expect(matchToOpen(room("closed", ["a"], null), "a")).toBeNull();
  });

  it("waits for the room to load", () => {
    expect(matchToEnter(undefined, "a")).toBeNull();
  });
});
