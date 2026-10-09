import {
  type FriendsResponse,
  type Relationship,
  sendFriendRequestSchema,
} from "@bankroll/contracts";
import { and, asc, eq, ilike, inArray, ne, or, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { db } from "../db/client";
import { friendships, profiles } from "../db/generated/schema";
import { badRequest, notFound, parseOrThrow, readJson, toIso, uuidParam } from "../lib/http";
import { friendPair, profileColumns } from "../lib/profiles";
import { notifyUsers } from "../lib/realtime";
import type { AuthVariables } from "../middleware/auth";

function relationshipFor(
  me: string,
  row: { status: string; requestedBy: string } | null | undefined,
): Relationship {
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requestedBy === me ? "request_sent" : "request_received";
}

function otherUserId(me: string) {
  return sql<string>`case when ${friendships.userLow} = ${me} then ${friendships.userHigh} else ${friendships.userLow} end`;
}

const searchQuerySchema = z.object({
  q: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, "Type at least 2 characters")
    .max(20)
    .transform((q) => q.replace(/^@/, "")),
});

export const friendRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/users/search", async (c) => {
    const me = c.get("userId");
    const { q } = parseOrThrow(searchQuerySchema, { q: c.req.query("q") ?? "" });
    if (!/^[a-z0-9_]+$/.test(q)) return c.json({ users: [] });

    const rows = await db
      .select({ ...profileColumns, status: friendships.status, requestedBy: friendships.requestedBy })
      .from(profiles)
      .leftJoin(
        friendships,
        and(
          eq(friendships.userLow, sql`least(${profiles.id}, ${me}::uuid)`),
          eq(friendships.userHigh, sql`greatest(${profiles.id}, ${me}::uuid)`),
        ),
      )
      .where(and(ilike(profiles.username, `${q.replaceAll("_", "\\_")}%`), ne(profiles.id, me)))
      .orderBy(asc(profiles.username))
      .limit(20);

    return c.json({
      users: rows.map(({ status, requestedBy, ...profile }) => ({
        ...profile,
        relationship: relationshipFor(me, status && requestedBy ? { status, requestedBy } : null),
      })),
    });
  })

  .get("/friends", async (c) => {
    const me = c.get("userId");
    const rows = await db
      .select({
        ...profileColumns,
        status: friendships.status,
        requestedBy: friendships.requestedBy,
        createdAt: friendships.createdAt,
        acceptedAt: friendships.acceptedAt,
      })
      .from(friendships)
      .innerJoin(profiles, eq(profiles.id, otherUserId(me)))
      .where(or(eq(friendships.userLow, me), eq(friendships.userHigh, me)))
      .orderBy(asc(profiles.displayName));

    const result: FriendsResponse = { friends: [], incoming: [], outgoing: [] };
    for (const { status, requestedBy, createdAt, acceptedAt, ...profile } of rows) {
      if (status === "accepted") result.friends.push({ ...profile, since: toIso(acceptedAt ?? createdAt) });
      else if (requestedBy === me) result.outgoing.push({ ...profile, requestedAt: toIso(createdAt) });
      else result.incoming.push({ ...profile, requestedAt: toIso(createdAt) });
    }
    return c.json(result);
  })

  // Sending a request to someone who already asked you makes you friends.
  .post("/friends/requests", async (c) => {
    const me = c.get("userId");
    const { username } = await readJson(c, sendFriendRequestSchema);

    const [target] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, username));
    if (!target) throw notFound("No player with that username");
    if (target.id === me) throw badRequest("You can't add yourself");

    const pair = friendPair(me, target.id);
    const relationship = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(friendships)
        .values({ ...pair, requestedBy: me })
        .onConflictDoNothing()
        .returning({ status: friendships.status });
      if (inserted) {
        await notifyUsers(tx, [target.id], "friends_changed");
        return "request_sent" as const;
      }

      const [existing] = await tx
        .select({ status: friendships.status, requestedBy: friendships.requestedBy })
        .from(friendships)
        .where(and(eq(friendships.userLow, pair.userLow), eq(friendships.userHigh, pair.userHigh)))
        .for("update");
      const current = relationshipFor(me, existing);
      if (current !== "request_received") return current;

      await tx
        .update(friendships)
        .set({ status: "accepted", acceptedAt: new Date().toISOString() })
        .where(and(eq(friendships.userLow, pair.userLow), eq(friendships.userHigh, pair.userHigh)));
      await notifyUsers(tx, [target.id], "friends_changed");
      return "friends" as const;
    });

    return c.json({ relationship });
  })

  .post("/friends/:userId/accept", async (c) => {
    const me = c.get("userId");
    const other = uuidParam(c.req.param("userId"));
    const pair = friendPair(me, other);

    await db.transaction(async (tx) => {
      const updated = await tx
        .update(friendships)
        .set({ status: "accepted", acceptedAt: new Date().toISOString() })
        .where(
          and(
            eq(friendships.userLow, pair.userLow),
            eq(friendships.userHigh, pair.userHigh),
            eq(friendships.status, "pending"),
            eq(friendships.requestedBy, other),
          ),
        )
        .returning({ status: friendships.status });
      if (updated.length === 0) throw notFound("Friend request not found");
      await notifyUsers(tx, [other], "friends_changed");
    });

    return c.json({ relationship: "friends" });
  })

  // Declines an incoming request, cancels an outgoing one, or removes a friend.
  .delete("/friends/:userId", async (c) => {
    const me = c.get("userId");
    const other = uuidParam(c.req.param("userId"));
    const pair = friendPair(me, other);

    await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(friendships)
        .where(and(eq(friendships.userLow, pair.userLow), eq(friendships.userHigh, pair.userHigh)))
        .returning({ status: friendships.status });
      if (deleted.length === 0) throw notFound("Not found");
      await notifyUsers(tx, [other], "friends_changed");
    });

    return c.json({ relationship: "none" });
  });

export async function areFriends(me: string, others: readonly string[]): Promise<boolean> {
  const unique = [...new Set(others)];
  if (unique.length === 0) return true;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(friendships)
    .where(
      and(
        eq(friendships.status, "accepted"),
        or(
          and(eq(friendships.userLow, me), inArray(friendships.userHigh, unique)),
          and(eq(friendships.userHigh, me), inArray(friendships.userLow, unique)),
        ),
      ),
    );
  return row?.count === unique.length;
}
