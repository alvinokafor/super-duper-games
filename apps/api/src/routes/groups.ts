import {
  addGroupMembersSchema,
  createGroupSchema,
  GROUP_CHANGED_EVENT,
  GROUP_MEMBER_LIMIT,
  GROUP_MESSAGE_EVENT,
  type GroupDetail,
  type GroupMessage,
  groupChannelName,
  sendGroupMessageSchema,
  updateGroupSchema,
} from "@bankroll/contracts";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { type Db, db, type Tx } from "../db/client";
import { groupMembers, groupMessages, groups, profiles } from "../db/generated/schema";
import { conflict, forbidden, notFound, parseOrThrow, readJson, toIso, uuidParam } from "../lib/http";
import { profileColumns, randomCode } from "../lib/profiles";
import { broadcast, notifyUsers } from "../lib/realtime";
import type { AuthVariables } from "../middleware/auth";
import { areFriends } from "./friends";

const MESSAGE_PAGE_SIZE = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const messageColumns = {
  id: groupMessages.id,
  groupId: groupMessages.groupId,
  kind: groupMessages.kind,
  body: groupMessages.body,
  roomId: groupMessages.roomId,
  clientId: groupMessages.clientId,
  createdAt: groupMessages.createdAt,
  senderId: profiles.id,
  senderUsername: profiles.username,
  senderDisplayName: profiles.displayName,
  senderAvatarUrl: profiles.avatarUrl,
};

type MessageRow = {
  id: number;
  groupId: string;
  kind: string;
  body: string;
  roomId: string | null;
  clientId: string | null;
  createdAt: string;
  senderId: string | null;
  senderUsername: string | null;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
};

function toMessage(row: MessageRow): GroupMessage {
  return {
    id: row.id,
    groupId: row.groupId,
    kind: row.kind === "system" ? "system" : "text",
    body: row.body,
    roomId: row.roomId,
    clientId: row.clientId,
    createdAt: toIso(row.createdAt),
    sender:
      row.senderId && row.senderUsername && row.senderDisplayName
        ? {
            id: row.senderId,
            username: row.senderUsername,
            displayName: row.senderDisplayName,
            avatarUrl: row.senderAvatarUrl,
          }
        : null,
  };
}

function selectMessages(executor: Db | Tx) {
  return executor.select(messageColumns).from(groupMessages).leftJoin(profiles, eq(profiles.id, groupMessages.senderId));
}

async function loadMessage(executor: Db | Tx, id: number): Promise<GroupMessage> {
  const [row] = await selectMessages(executor).where(eq(groupMessages.id, id));
  if (!row) throw new Error(`message ${id} missing after insert`);
  return toMessage(row);
}

// Saves a message and sends it to everyone listening on the group channel.
export async function postGroupMessage(
  tx: Tx,
  values: { groupId: string; body: string; kind: "text" | "system"; senderId?: string; roomId?: string },
): Promise<GroupMessage> {
  const [inserted] = await tx.insert(groupMessages).values(values).returning({ id: groupMessages.id });
  if (!inserted) throw new Error("message insert returned nothing");
  const message = await loadMessage(tx, inserted.id);
  await broadcast(tx, groupChannelName(values.groupId), GROUP_MESSAGE_EVENT, message);
  return message;
}

async function displayNames(executor: Db | Tx, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows = await executor
    .select({ id: profiles.id, displayName: profiles.displayName })
    .from(profiles)
    .where(inArray(profiles.id, [...ids]));
  return new Map(rows.map((r) => [r.id, r.displayName]));
}

function listNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

// Non-members get "not found" so group ids can't be probed.
export async function requireMember(executor: Db | Tx, groupId: string, userId: string, lock = false) {
  const query = executor
    .select({ id: groups.id, name: groups.name, ownerId: groups.ownerId, inviteCode: groups.inviteCode })
    .from(groups)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)))
    .where(eq(groups.id, groupId));
  const [group] = lock ? await query.for("update", { of: groups }) : await query;
  if (!group) throw notFound("Group not found");
  return group;
}

async function memberCount(executor: Db | Tx, groupId: string): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(groupMembers)
    .where(eq(groupMembers.groupId, groupId));
  return row?.count ?? 0;
}

async function loadGroupDetail(executor: Db | Tx, groupId: string): Promise<GroupDetail> {
  const [group] = await executor
    .select({ id: groups.id, name: groups.name, ownerId: groups.ownerId, inviteCode: groups.inviteCode })
    .from(groups)
    .where(eq(groups.id, groupId));
  if (!group) throw notFound("Group not found");
  const members = await executor
    .select({ ...profileColumns, joinedAt: groupMembers.joinedAt })
    .from(groupMembers)
    .innerJoin(profiles, eq(profiles.id, groupMembers.userId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
  return {
    ...group,
    memberLimit: GROUP_MEMBER_LIMIT,
    members: members.map((m) => ({ ...m, joinedAt: toIso(m.joinedAt) })),
  };
}

const messagesQuerySchema = z.object({
  before: z.coerce.number().int().positive().optional(),
});

const inviteCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{8}$/, "Invalid invite code");

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const groupRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/groups", async (c) => {
    const me = c.get("userId");
    const rows = await db
      .select({
        id: groups.id,
        name: groups.name,
        ownerId: groups.ownerId,
        createdAt: groups.createdAt,
        memberCount: sql<number>`(select count(*)::int from public.group_members gm where gm.group_id = ${groups.id})`,
      })
      .from(groups)
      .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, me)));

    const lastRows =
      rows.length === 0
        ? []
        : await db
            .selectDistinctOn([groupMessages.groupId], messageColumns)
            .from(groupMessages)
            .leftJoin(profiles, eq(profiles.id, groupMessages.senderId))
            .where(inArray(groupMessages.groupId, rows.map((r) => r.id)))
            .orderBy(groupMessages.groupId, desc(groupMessages.id));
    const lastByGroup = new Map(lastRows.map((r) => [r.groupId, toMessage(r)]));

    const summaries = rows
      .map(({ createdAt, ...g }) => ({
        ...g,
        lastMessage: lastByGroup.get(g.id) ?? null,
        activityAt: lastByGroup.get(g.id)?.createdAt ?? toIso(createdAt),
      }))
      .sort((a, b) => b.activityAt.localeCompare(a.activityAt))
      .map(({ activityAt: _, ...g }) => g);

    return c.json({ groups: summaries });
  })

  .post("/groups", async (c) => {
    const me = c.get("userId");
    const input = await readJson(c, createGroupSchema);
    const memberIds = [...new Set(input.memberIds)].filter((id) => id !== me);
    if (!(await areFriends(me, memberIds))) throw forbidden("You can only add your friends");

    const detail = await db.transaction(async (tx) => {
      let groupId: string | undefined;
      for (let attempt = 0; attempt < 5 && !groupId; attempt++) {
        const [created] = await tx
          .insert(groups)
          .values({ name: input.name, ownerId: me, inviteCode: randomCode(8) })
          .onConflictDoNothing({ target: groups.inviteCode })
          .returning({ id: groups.id });
        groupId = created?.id;
      }
      if (!groupId) throw new Error("could not generate a free group invite code");

      await tx.insert(groupMembers).values([me, ...memberIds].map((userId) => ({ groupId: groupId!, userId })));
      const names = await displayNames(tx, [me]);
      await postGroupMessage(tx, { groupId, kind: "system", body: `${names.get(me) ?? "Someone"} created the group` });
      await notifyUsers(tx, memberIds, "groups_changed");
      return loadGroupDetail(tx, groupId);
    });

    return c.json(detail, 201);
  })

  .get("/groups/:groupId", async (c) => {
    const groupId = uuidParam(c.req.param("groupId"));
    await requireMember(db, groupId, c.get("userId"));
    return c.json(await loadGroupDetail(db, groupId));
  })

  .patch("/groups/:groupId", async (c) => {
    const me = c.get("userId");
    const groupId = uuidParam(c.req.param("groupId"));
    const { name } = await readJson(c, updateGroupSchema);

    const detail = await db.transaction(async (tx) => {
      const group = await requireMember(tx, groupId, me, true);
      if (group.ownerId !== me) throw forbidden("Only the group owner can rename the group");
      if (group.name !== name) {
        await tx.update(groups).set({ name, updatedAt: new Date().toISOString() }).where(eq(groups.id, groupId));
        const names = await displayNames(tx, [me]);
        await postGroupMessage(tx, { groupId, kind: "system", body: `${names.get(me)} renamed the group to "${name}"` });
        await broadcast(tx, groupChannelName(groupId), GROUP_CHANGED_EVENT);
        await notifyUsers(tx, (await loadGroupDetail(tx, groupId)).members.map((m) => m.id), "groups_changed");
      }
      return loadGroupDetail(tx, groupId);
    });

    return c.json(detail);
  })

  // Any member can add their own friends.
  .post("/groups/:groupId/members", async (c) => {
    const me = c.get("userId");
    const groupId = uuidParam(c.req.param("groupId"));
    const { userIds } = await readJson(c, addGroupMembersSchema);

    const detail = await db.transaction(async (tx) => {
      await requireMember(tx, groupId, me, true);
      const existing = await tx
        .select({ userId: groupMembers.userId })
        .from(groupMembers)
        .where(eq(groupMembers.groupId, groupId));
      const existingIds = new Set(existing.map((m) => m.userId));
      const newIds = [...new Set(userIds)].filter((id) => !existingIds.has(id));
      if (newIds.length === 0) return loadGroupDetail(tx, groupId);

      if (!(await areFriends(me, newIds))) throw forbidden("You can only add your friends");
      if (existingIds.size + newIds.length > GROUP_MEMBER_LIMIT) {
        throw conflict(`Groups can have at most ${GROUP_MEMBER_LIMIT} members`);
      }

      await tx.insert(groupMembers).values(newIds.map((userId) => ({ groupId, userId })));
      const names = await displayNames(tx, [me, ...newIds]);
      await postGroupMessage(tx, {
        groupId,
        kind: "system",
        body: `${names.get(me)} added ${listNames(newIds.map((id) => names.get(id) ?? "someone"))}`,
      });
      await broadcast(tx, groupChannelName(groupId), GROUP_CHANGED_EVENT);
      await notifyUsers(tx, newIds, "groups_changed");
      return loadGroupDetail(tx, groupId);
    });

    return c.json(detail);
  })

  // Leave the group (your own id) or, as the owner, remove someone.
  // When the owner leaves, the longest-standing member takes over. The last
  // member leaving deletes the group.
  .delete("/groups/:groupId/members/:userId", async (c) => {
    const me = c.get("userId");
    const groupId = uuidParam(c.req.param("groupId"));
    const target = uuidParam(c.req.param("userId"));

    const result = await db.transaction(async (tx) => {
      const group = await requireMember(tx, groupId, me, true);
      if (target !== me && group.ownerId !== me) throw forbidden("Only the group owner can remove members");

      const removed = await tx
        .delete(groupMembers)
        .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, target)))
        .returning({ userId: groupMembers.userId });
      if (removed.length === 0) throw notFound("That player is not in this group");

      let newOwnerId: string | null = null;
      if (target === group.ownerId) {
        const [next] = await tx
          .select({ userId: groupMembers.userId })
          .from(groupMembers)
          .where(eq(groupMembers.groupId, groupId))
          .orderBy(asc(groupMembers.joinedAt))
          .limit(1);
        if (!next) {
          await tx.delete(groups).where(eq(groups.id, groupId));
          await notifyUsers(tx, [target], "groups_changed");
          return { deleted: true };
        }
        newOwnerId = next.userId;
        await tx
          .update(groups)
          .set({ ownerId: newOwnerId, updatedAt: new Date().toISOString() })
          .where(eq(groups.id, groupId));
      }

      const names = await displayNames(tx, [me, target, ...(newOwnerId ? [newOwnerId] : [])]);
      let body = target === me ? `${names.get(me)} left the group` : `${names.get(me)} removed ${names.get(target)}`;
      if (newOwnerId) body += `. ${names.get(newOwnerId)} is now the owner`;
      await postGroupMessage(tx, { groupId, kind: "system", body });
      await broadcast(tx, groupChannelName(groupId), GROUP_CHANGED_EVENT);
      await notifyUsers(tx, [target], "groups_changed");
      return { deleted: false };
    });

    return c.json(result);
  })

  .post("/groups/:groupId/invite-code", async (c) => {
    const me = c.get("userId");
    const groupId = uuidParam(c.req.param("groupId"));

    const detail = await db.transaction(async (tx) => {
      const group = await requireMember(tx, groupId, me, true);
      if (group.ownerId !== me) throw forbidden("Only the group owner can reset the invite link");
      await tx
        .update(groups)
        .set({ inviteCode: randomCode(8), updatedAt: new Date().toISOString() })
        .where(eq(groups.id, groupId));
      await broadcast(tx, groupChannelName(groupId), GROUP_CHANGED_EVENT);
      return loadGroupDetail(tx, groupId);
    });

    return c.json(detail);
  })

  .get("/group-invites/:code", async (c) => {
    const me = c.get("userId");
    const code = parseOrThrow(inviteCodeSchema, c.req.param("code"));
    const [group] = await db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(eq(groups.inviteCode, code));
    if (!group) throw notFound("This invite link is not valid any more");

    const [membership] = await db
      .select({ userId: groupMembers.userId })
      .from(groupMembers)
      .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.userId, me)));
    const count = await memberCount(db, group.id);

    return c.json({
      groupId: group.id,
      name: group.name,
      memberCount: count,
      isMember: Boolean(membership),
      isFull: count >= GROUP_MEMBER_LIMIT,
    });
  })

  .post("/group-invites/:code/join", async (c) => {
    const me = c.get("userId");
    const code = parseOrThrow(inviteCodeSchema, c.req.param("code"));

    const groupId = await db.transaction(async (tx) => {
      const [group] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(eq(groups.inviteCode, code))
        .for("update");
      if (!group) throw notFound("This invite link is not valid any more");

      const [inserted] = await tx
        .insert(groupMembers)
        .values({ groupId: group.id, userId: me })
        .onConflictDoNothing()
        .returning({ userId: groupMembers.userId });
      if (!inserted) return group.id;

      if ((await memberCount(tx, group.id)) > GROUP_MEMBER_LIMIT) {
        throw conflict(`This group is full (${GROUP_MEMBER_LIMIT} members)`);
      }

      const names = await displayNames(tx, [me]);
      await postGroupMessage(tx, { groupId: group.id, kind: "system", body: `${names.get(me)} joined with the invite link` });
      await broadcast(tx, groupChannelName(group.id), GROUP_CHANGED_EVENT);
      return group.id;
    });

    return c.json({ groupId });
  })

  .get("/groups/:groupId/messages", async (c) => {
    const groupId = uuidParam(c.req.param("groupId"));
    await requireMember(db, groupId, c.get("userId"));
    const { before } = parseOrThrow(messagesQuerySchema, { before: c.req.query("before") });

    const rows = await selectMessages(db)
      .where(and(eq(groupMessages.groupId, groupId), before ? lt(groupMessages.id, before) : undefined))
      .orderBy(desc(groupMessages.id))
      .limit(MESSAGE_PAGE_SIZE + 1);

    const page = rows.slice(0, MESSAGE_PAGE_SIZE).map(toMessage);
    return c.json({
      messages: page,
      nextBefore: rows.length > MESSAGE_PAGE_SIZE ? (page.at(-1)?.id ?? null) : null,
    });
  })

  // A retry with the same clientId returns the first message instead of
  // posting again.
  .post("/groups/:groupId/messages", async (c) => {
    const me = c.get("userId");
    const groupId = uuidParam(c.req.param("groupId"));
    const { body, clientId } = await readJson(c, sendGroupMessageSchema);

    const message = await db.transaction(async (tx) => {
      await requireMember(tx, groupId, me);
      const [inserted] = await tx
        .insert(groupMessages)
        .values({ groupId, senderId: me, kind: "text", body, clientId })
        .onConflictDoNothing()
        .returning({ id: groupMessages.id });

      if (!inserted) {
        const [existing] = await selectMessages(tx).where(
          and(eq(groupMessages.senderId, me), eq(groupMessages.clientId, clientId)),
        );
        if (!existing || existing.groupId !== groupId) throw conflict("Message id already used");
        return toMessage(existing);
      }

      const saved = await loadMessage(tx, inserted.id);
      await broadcast(tx, groupChannelName(groupId), GROUP_MESSAGE_EVENT, saved);
      return saved;
    });

    return c.json(message, 201);
  });
