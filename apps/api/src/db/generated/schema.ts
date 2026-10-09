import { users } from "../auth-schema"
export { users as usersInAuth }
import { pgTable, index, foreignKey, unique, check, uuid, text, timestamp, uniqueIndex, bigint, smallint, jsonb, boolean, integer, primaryKey } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const groups = pgTable("groups", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	name: text().notNull(),
	ownerId: uuid("owner_id").notNull(),
	inviteCode: text("invite_code").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("groups_owner_id_idx").using("btree", table.ownerId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.ownerId],
			foreignColumns: [profiles.id],
			name: "groups_owner_id_fkey"
		}),
	unique("groups_invite_code_key").on(table.inviteCode),
	check("groups_name_check", sql`(char_length(name) >= 1) AND (char_length(name) <= 40)`),
	check("groups_invite_code_check", sql`invite_code ~ '^[A-Z0-9]{8}$'::text`),
]);

export const groupMessages = pgTable("group_messages", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	id: bigint({ mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "group_messages_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807, cache: 1 }),
	groupId: uuid("group_id").notNull(),
	senderId: uuid("sender_id"),
	kind: text().default('text').notNull(),
	body: text().notNull(),
	roomId: uuid("room_id"),
	clientId: uuid("client_id"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("group_messages_client_id_idx").using("btree", table.senderId.asc().nullsLast().op("uuid_ops"), table.clientId.asc().nullsLast().op("uuid_ops")).where(sql`(client_id IS NOT NULL)`),
	index("group_messages_group_id_id_idx").using("btree", table.groupId.asc().nullsLast().op("uuid_ops"), table.id.desc().nullsFirst().op("uuid_ops")),
	index("group_messages_room_id_idx").using("btree", table.roomId.asc().nullsLast().op("uuid_ops")),
	index("group_messages_sender_id_idx").using("btree", table.senderId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "group_messages_group_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.senderId],
			foreignColumns: [profiles.id],
			name: "group_messages_sender_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "group_messages_room_id_fkey"
		}).onDelete("set null"),
	check("group_messages_kind_check", sql`kind = ANY (ARRAY['text'::text, 'system'::text])`),
	check("group_messages_body_check", sql`(char_length(body) >= 1) AND (char_length(body) <= 1000)`),
]);

export const profiles = pgTable("profiles", {
	id: uuid().primaryKey().notNull(),
	displayName: text("display_name").notNull(),
	avatarUrl: text("avatar_url"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	username: text().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.id],
			foreignColumns: [users.id],
			name: "profiles_id_fkey"
		}).onDelete("cascade"),
	unique("profiles_username_key").on(table.username),
	check("profiles_display_name_check", sql`(char_length(display_name) >= 1) AND (char_length(display_name) <= 40)`),
	check("profiles_username_format", sql`username ~ '^[a-z0-9_]{3,20}$'::text`),
]);

export const rooms = pgTable("rooms", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	gameId: text("game_id").notNull(),
	hostId: uuid("host_id").notNull(),
	status: text().default('open').notNull(),
	maxPlayers: smallint("max_players").notNull(),
	settings: jsonb().default({}).notNull(),
	inviteCode: text("invite_code").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	groupId: uuid("group_id"),
}, (table) => [
	index("rooms_game_id_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops")),
	index("rooms_group_id_idx").using("btree", table.groupId.asc().nullsLast().op("uuid_ops")),
	index("rooms_host_id_idx").using("btree", table.hostId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "rooms_group_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "rooms_game_id_fkey"
		}),
	foreignKey({
			columns: [table.hostId],
			foreignColumns: [profiles.id],
			name: "rooms_host_id_fkey"
		}).onDelete("cascade"),
	unique("rooms_invite_code_key").on(table.inviteCode),
	check("rooms_status_check", sql`status = ANY (ARRAY['open'::text, 'started'::text, 'closed'::text])`),
	check("rooms_max_players_check", sql`(max_players >= 2) AND (max_players <= 12)`),
	check("rooms_settings_check", sql`jsonb_typeof(settings) = 'object'::text`),
	check("rooms_invite_code_check", sql`invite_code ~ '^[A-Z0-9]{6,10}$'::text`),
]);

export const games = pgTable("games", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	minPlayers: smallint("min_players").notNull(),
	maxPlayers: smallint("max_players").notNull(),
	isActive: boolean("is_active").default(true).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("games_check", sql`max_players >= min_players`),
	check("games_id_check", sql`id ~ '^[a-z0-9-]+$'::text`),
	check("games_min_players_check", sql`min_players >= 2`),
]);

export const matches = pgTable("matches", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	roomId: uuid("room_id").notNull(),
	gameId: text("game_id").notNull(),
	status: text().default('active').notNull(),
	version: integer().default(0).notNull(),
	state: jsonb().notNull(),
	settings: jsonb().default({}).notNull(),
	turnDeadline: timestamp("turn_deadline", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("matches_game_id_idx").using("btree", table.gameId.asc().nullsLast().op("text_ops")),
	index("matches_turn_deadline_idx").using("btree", table.turnDeadline.asc().nullsLast().op("timestamptz_ops")).where(sql`((status = 'active'::text) AND (turn_deadline IS NOT NULL))`),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "matches_room_id_fkey"
		}),
	foreignKey({
			columns: [table.gameId],
			foreignColumns: [games.id],
			name: "matches_game_id_fkey"
		}),
	unique("matches_room_id_key").on(table.roomId),
	check("matches_status_check", sql`status = ANY (ARRAY['active'::text, 'finished'::text, 'abandoned'::text])`),
	check("matches_version_check", sql`version >= 0`),
	check("matches_state_check", sql`jsonb_typeof(state) = 'object'::text`),
	check("matches_settings_check", sql`jsonb_typeof(settings) = 'object'::text`),
]);

export const groupMembers = pgTable("group_members", {
	groupId: uuid("group_id").notNull(),
	userId: uuid("user_id").notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("group_members_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.groupId],
			foreignColumns: [groups.id],
			name: "group_members_group_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "group_members_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.groupId, table.userId], name: "group_members_pkey"}),
]);

export const roomSeats = pgTable("room_seats", {
	roomId: uuid("room_id").notNull(),
	userId: uuid("user_id").notNull(),
	seat: smallint().notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("room_seats_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.roomId],
			foreignColumns: [rooms.id],
			name: "room_seats_room_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "room_seats_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.roomId, table.userId], name: "room_seats_pkey"}),
	unique("room_seats_room_id_seat_key").on(table.roomId, table.seat),
	check("room_seats_seat_check", sql`(seat >= 0) AND (seat <= 11)`),
]);

export const matchPlayers = pgTable("match_players", {
	matchId: uuid("match_id").notNull(),
	userId: uuid("user_id").notNull(),
	seat: smallint().notNull(),
	joinedAt: timestamp("joined_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("match_players_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [matches.id],
			name: "match_players_match_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [profiles.id],
			name: "match_players_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.matchId, table.userId], name: "match_players_pkey"}),
	unique("match_players_match_id_seat_key").on(table.matchId, table.seat),
	check("match_players_seat_check", sql`(seat >= 0) AND (seat <= 11)`),
]);

export const matchStates = pgTable("match_states", {
	matchId: uuid("match_id").notNull(),
	version: integer().notNull(),
	state: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.matchId],
			foreignColumns: [matches.id],
			name: "match_states_match_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.matchId, table.version], name: "match_states_pkey"}),
	check("match_states_version_check", sql`version >= 0`),
	check("match_states_state_check", sql`jsonb_typeof(state) = 'object'::text`),
]);

export const matchResults = pgTable("match_results", {
	matchId: uuid("match_id").notNull(),
	userId: uuid("user_id").notNull(),
	rank: smallint().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	score: bigint({ mode: "number" }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("match_results_user_id_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.matchId, table.userId],
			foreignColumns: [matchPlayers.matchId, matchPlayers.userId],
			name: "match_results_match_id_user_id_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.matchId, table.userId], name: "match_results_pkey"}),
	check("match_results_rank_check", sql`rank >= 1`),
]);

export const friendships = pgTable("friendships", {
	userLow: uuid("user_low").notNull(),
	userHigh: uuid("user_high").notNull(),
	requestedBy: uuid("requested_by").notNull(),
	status: text().default('pending').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	acceptedAt: timestamp("accepted_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("friendships_user_high_idx").using("btree", table.userHigh.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userLow],
			foreignColumns: [profiles.id],
			name: "friendships_user_low_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userHigh],
			foreignColumns: [profiles.id],
			name: "friendships_user_high_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.userLow, table.userHigh], name: "friendships_pkey"}),
	check("friendships_status_check", sql`status = ANY (ARRAY['pending'::text, 'accepted'::text])`),
	check("friendships_check", sql`user_low < user_high`),
	check("friendships_check1", sql`(requested_by = user_low) OR (requested_by = user_high)`),
	check("friendships_check2", sql`(status = 'accepted'::text) = (accepted_at IS NOT NULL)`),
]);

export const matchEvents = pgTable("match_events", {
	matchId: uuid("match_id").notNull(),
	version: integer().notNull(),
	commandId: uuid("command_id"),
	actorId: uuid("actor_id"),
	events: jsonb().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("match_events_actor_id_idx").using("btree", table.actorId.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("match_events_command_id_idx").using("btree", table.matchId.asc().nullsLast().op("uuid_ops"), table.commandId.asc().nullsLast().op("uuid_ops")).where(sql`(command_id IS NOT NULL)`),
	foreignKey({
			columns: [table.actorId],
			foreignColumns: [profiles.id],
			name: "match_events_actor_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.matchId, table.version],
			foreignColumns: [matchStates.matchId, matchStates.version],
			name: "match_events_match_id_version_fkey"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.matchId, table.version], name: "match_events_pkey"}),
	check("match_events_version_check", sql`version >= 1`),
	check("match_events_events_check", sql`jsonb_typeof(events) = 'array'::text`),
]);
