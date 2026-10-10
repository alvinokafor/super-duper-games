import { z } from "zod";

export const GROUP_MEMBER_LIMIT = 50;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,20}$/, "Use 3–20 letters, numbers or underscores");

export const displayNameSchema = z.string().trim().min(1, "Enter a name").max(40, "Use 40 characters or fewer");

export const publicProfileSchema = z.object({
  id: z.uuid(),
  username: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});
export type PublicProfile = z.infer<typeof publicProfileSchema>;

// ---------------------------------------------------------------------------
// Me
// ---------------------------------------------------------------------------

export const updateMeSchema = z
  .object({ username: usernameSchema, displayName: displayNameSchema })
  .partial()
  .refine((v) => v.username !== undefined || v.displayName !== undefined, "Nothing to update");

export const usernameAvailabilitySchema = z.object({ available: z.boolean() });

// ---------------------------------------------------------------------------
// Friends
// ---------------------------------------------------------------------------

export const relationshipSchema = z.enum(["none", "friends", "request_sent", "request_received"]);
export type Relationship = z.infer<typeof relationshipSchema>;

export const userSearchResponseSchema = z.object({
  users: z.array(publicProfileSchema.extend({ relationship: relationshipSchema })),
});

export const friendsResponseSchema = z.object({
  friends: z.array(publicProfileSchema.extend({ since: z.string() })),
  incoming: z.array(publicProfileSchema.extend({ requestedAt: z.string() })),
  outgoing: z.array(publicProfileSchema.extend({ requestedAt: z.string() })),
});
export type FriendsResponse = z.infer<typeof friendsResponseSchema>;

export const sendFriendRequestSchema = z.object({ username: usernameSchema });

export const relationshipResponseSchema = z.object({ relationship: relationshipSchema });

// ---------------------------------------------------------------------------
// Groups
// ---------------------------------------------------------------------------

export const groupNameSchema = z.string().trim().min(1, "Enter a group name").max(40, "Use 40 characters or fewer");

export const GROUP_COLORS = ["brass", "lagoon", "navy", "rose", "violet"] as const;
export const groupColorSchema = z.enum(GROUP_COLORS);
export type GroupColor = z.infer<typeof groupColorSchema>;

// An empty description is stored as null.
export const groupDescriptionSchema = z
  .string()
  .trim()
  .max(160, "Use 160 characters or fewer")
  .transform((v) => v || null);

export const groupMessageSchema = z.object({
  id: z.number().int(),
  groupId: z.uuid(),
  kind: z.enum(["text", "system"]),
  body: z.string(),
  sender: publicProfileSchema.nullable(),
  roomId: z.uuid().nullable(),
  clientId: z.uuid().nullable(),
  createdAt: z.string(),
});
export type GroupMessage = z.infer<typeof groupMessageSchema>;

export const groupSummarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: groupColorSchema,
  ownerId: z.uuid(),
  memberCount: z.number().int(),
  // Messages and room announcements from others since you last opened the
  // chat. Notes like "Ada joined" don't count.
  unreadCount: z.number().int(),
  lastMessage: groupMessageSchema.nullable(),
});
export type GroupSummary = z.infer<typeof groupSummarySchema>;

export const groupsResponseSchema = z.object({ groups: z.array(groupSummarySchema) });

export const groupDetailSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  color: groupColorSchema,
  description: z.string().nullable(),
  ownerId: z.uuid(),
  inviteCode: z.string(),
  memberLimit: z.number().int(),
  members: z.array(publicProfileSchema.extend({ joinedAt: z.string() })),
});
export type GroupDetail = z.infer<typeof groupDetailSchema>;

export const createGroupSchema = z.object({
  name: groupNameSchema,
  color: groupColorSchema.default("brass"),
  description: groupDescriptionSchema.default(null),
  memberIds: z.array(z.uuid()).max(GROUP_MEMBER_LIMIT - 1).default([]),
});
export type CreateGroupInput = z.input<typeof createGroupSchema>;

export const updateGroupSchema = z
  .object({ name: groupNameSchema, color: groupColorSchema, description: groupDescriptionSchema })
  .partial()
  .refine((v) => v.name !== undefined || v.color !== undefined || v.description !== undefined, "Nothing to update");
export type UpdateGroupInput = z.input<typeof updateGroupSchema>;

export const addGroupMembersSchema = z.object({
  userIds: z.array(z.uuid()).min(1).max(GROUP_MEMBER_LIMIT - 1),
});

export const groupMessagesPageSchema = z.object({
  // Newest first.
  messages: z.array(groupMessageSchema),
  nextBefore: z.number().int().nullable(),
});
export type GroupMessagesPage = z.infer<typeof groupMessagesPageSchema>;

export const sendGroupMessageSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  clientId: z.uuid(),
});

export const groupInvitePreviewSchema = z.object({
  groupId: z.uuid(),
  name: z.string(),
  color: groupColorSchema,
  memberCount: z.number().int(),
  isMember: z.boolean(),
  isFull: z.boolean(),
});

export const groupJoinResponseSchema = z.object({ groupId: z.uuid() });

// ---------------------------------------------------------------------------
// Rooms
// ---------------------------------------------------------------------------

export const roomSchema = z.object({
  id: z.uuid(),
  gameId: z.string(),
  gameName: z.string(),
  hostId: z.uuid(),
  status: z.enum(["open", "started", "closed"]),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
  groupId: z.uuid().nullable(),
  seats: z.array(z.object({ seat: z.number().int(), player: publicProfileSchema })),
});
export type Room = z.infer<typeof roomSchema>;

export const createRoomSchema = z.object({
  gameId: z.string().min(1),
  groupId: z.uuid().optional(),
});

export const gameSchema = z.object({
  id: z.string(),
  name: z.string(),
  minPlayers: z.number().int(),
  maxPlayers: z.number().int(),
});

export const gamesResponseSchema = z.object({ games: z.array(gameSchema) });
