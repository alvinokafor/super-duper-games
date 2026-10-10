import { z } from "zod";

export const matchChannelName = (matchId: string) => `match:${matchId}` as const;
export const userChannelName = (userId: string) => `user:${userId}` as const;
export const groupChannelName = (groupId: string) => `group:${groupId}` as const;
export const roomChannelName = (roomId: string) => `room:${roomId}` as const;

// Sent on match:<id>. The payload is a match update (new snapshot plus events).
export const MATCH_EVENT = "match_event";
// Sent on match:<id>. The payload is a MatchMessage.
export const MATCH_MESSAGE_EVENT = "match_message";

// Sent on user:<id>. Tells the app which lists to refetch. group_activity
// means a new message arrived, so only the groups list needs refetching.
export const USER_EVENT = "user_event";
export const userEventSchema = z.object({ type: z.enum(["friends_changed", "groups_changed", "group_activity"]) });
export type UserEvent = z.infer<typeof userEventSchema>;

// Sent on group:<id>. The payload is a GroupMessage.
export const GROUP_MESSAGE_EVENT = "group_message";
// Sent on group:<id> when the name or members change. No payload.
export const GROUP_CHANGED_EVENT = "group_changed";

// Sent on room:<id> when seats or status change. No payload.
export const ROOM_CHANGED_EVENT = "room_changed";
