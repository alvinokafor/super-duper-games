import { createRoomSchema, ROOM_CHANGED_EVENT, type Room, roomChannelName } from "@bankroll/contracts";
import { and, asc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { type Db, db, type Tx } from "../db/client";
import { games, profiles, rooms, roomSeats } from "../db/generated/schema";
import { conflict, notFound, readJson, uuidParam } from "../lib/http";
import { profileColumns, randomCode } from "../lib/profiles";
import { broadcast } from "../lib/realtime";
import type { AuthVariables } from "../middleware/auth";
import { postGroupMessage, requireMember } from "./groups";

async function loadRoom(executor: Db | Tx, roomId: string): Promise<Room> {
  const [room] = await executor
    .select({
      id: rooms.id,
      gameId: rooms.gameId,
      gameName: games.name,
      hostId: rooms.hostId,
      status: rooms.status,
      minPlayers: games.minPlayers,
      maxPlayers: rooms.maxPlayers,
      groupId: rooms.groupId,
    })
    .from(rooms)
    .innerJoin(games, eq(games.id, rooms.gameId))
    .where(eq(rooms.id, roomId));
  if (!room) throw notFound("Room not found");

  const seats = await executor
    .select({ seat: roomSeats.seat, ...profileColumns })
    .from(roomSeats)
    .innerJoin(profiles, eq(profiles.id, roomSeats.userId))
    .where(eq(roomSeats.roomId, roomId))
    .orderBy(asc(roomSeats.seat));

  return {
    ...room,
    status: room.status === "started" || room.status === "closed" ? room.status : "open",
    seats: seats.map(({ seat, ...player }) => ({ seat, player })),
  };
}

async function lockRoom(tx: Tx, roomId: string) {
  const [room] = await tx
    .select({ id: rooms.id, hostId: rooms.hostId, status: rooms.status, maxPlayers: rooms.maxPlayers })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .for("update");
  if (!room) throw notFound("Room not found");
  return room;
}

// Rooms are shared by link: anyone signed in who has the room id can see the
// lobby and take a free seat while it is open.
export const roomRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/games", async (c) => {
    const rows = await db
      .select({ id: games.id, name: games.name, minPlayers: games.minPlayers, maxPlayers: games.maxPlayers })
      .from(games)
      .where(eq(games.isActive, true))
      .orderBy(asc(games.name));
    return c.json({ games: rows });
  })

  .post("/rooms", async (c) => {
    const me = c.get("userId");
    const { gameId, groupId } = await readJson(c, createRoomSchema);

    const [game] = await db
      .select({ id: games.id, name: games.name, maxPlayers: games.maxPlayers })
      .from(games)
      .where(and(eq(games.id, gameId), eq(games.isActive, true)));
    if (!game) throw notFound("Game not found");

    const room = await db.transaction(async (tx) => {
      if (groupId) await requireMember(tx, groupId, me);

      let roomId: string | undefined;
      for (let attempt = 0; attempt < 5 && !roomId; attempt++) {
        const [created] = await tx
          .insert(rooms)
          .values({ gameId, hostId: me, maxPlayers: game.maxPlayers, inviteCode: randomCode(6), groupId })
          .onConflictDoNothing({ target: rooms.inviteCode })
          .returning({ id: rooms.id });
        roomId = created?.id;
      }
      if (!roomId) throw new Error("could not generate a free room invite code");

      await tx.insert(roomSeats).values({ roomId, userId: me, seat: 0 });

      if (groupId) {
        const [host] = await tx.select({ displayName: profiles.displayName }).from(profiles).where(eq(profiles.id, me));
        await postGroupMessage(tx, {
          groupId,
          kind: "system",
          body: `${host?.displayName ?? "Someone"} started a ${game.name} room`,
          senderId: me,
          roomId,
        });
      }
      return loadRoom(tx, roomId);
    });

    return c.json(room, 201);
  })

  .get("/rooms/:roomId", async (c) => {
    return c.json(await loadRoom(db, uuidParam(c.req.param("roomId"))));
  })

  .post("/rooms/:roomId/join", async (c) => {
    const me = c.get("userId");
    const roomId = uuidParam(c.req.param("roomId"));

    const room = await db.transaction(async (tx) => {
      const locked = await lockRoom(tx, roomId);
      const seats = await tx
        .select({ userId: roomSeats.userId, seat: roomSeats.seat })
        .from(roomSeats)
        .where(eq(roomSeats.roomId, roomId));
      if (seats.some((s) => s.userId === me)) return loadRoom(tx, roomId);
      if (locked.status !== "open") throw conflict("This room is no longer taking players");
      if (seats.length >= locked.maxPlayers) throw conflict("This room is full");

      const taken = new Set(seats.map((s) => s.seat));
      let seat = 0;
      while (taken.has(seat)) seat++;
      await tx.insert(roomSeats).values({ roomId, userId: me, seat });
      await broadcast(tx, roomChannelName(roomId), ROOM_CHANGED_EVENT);
      return loadRoom(tx, roomId);
    });

    return c.json(room);
  })

  // The next seated player becomes host when the host leaves. An empty room
  // closes.
  .post("/rooms/:roomId/leave", async (c) => {
    const me = c.get("userId");
    const roomId = uuidParam(c.req.param("roomId"));

    const room = await db.transaction(async (tx) => {
      const locked = await lockRoom(tx, roomId);
      if (locked.status !== "open") throw conflict("The match has already started");

      const removed = await tx
        .delete(roomSeats)
        .where(and(eq(roomSeats.roomId, roomId), eq(roomSeats.userId, me)))
        .returning({ seat: roomSeats.seat });
      if (removed.length === 0) return loadRoom(tx, roomId);

      const [next] = await tx
        .select({ userId: roomSeats.userId })
        .from(roomSeats)
        .where(eq(roomSeats.roomId, roomId))
        .orderBy(asc(roomSeats.seat))
        .limit(1);
      if (!next) {
        await tx.update(rooms).set({ status: "closed" }).where(eq(rooms.id, roomId));
      } else if (locked.hostId === me) {
        await tx.update(rooms).set({ hostId: next.userId }).where(eq(rooms.id, roomId));
      }
      await broadcast(tx, roomChannelName(roomId), ROOM_CHANGED_EVENT);
      return loadRoom(tx, roomId);
    });

    return c.json(room);
  });
