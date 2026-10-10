import { relations } from "drizzle-orm/relations";
import { groups, groupMessages, profiles, rooms, usersInAuth, games, matches, groupMembers, roomSeats, matchPlayers, matchStates, matchResults, friendships, matchEvents } from "./schema";

export const groupMessagesRelations = relations(groupMessages, ({one}) => ({
	group: one(groups, {
		fields: [groupMessages.groupId],
		references: [groups.id]
	}),
	profile: one(profiles, {
		fields: [groupMessages.senderId],
		references: [profiles.id]
	}),
	room: one(rooms, {
		fields: [groupMessages.roomId],
		references: [rooms.id]
	}),
}));

export const groupsRelations = relations(groups, ({one, many}) => ({
	groupMessages: many(groupMessages),
	profile: one(profiles, {
		fields: [groups.ownerId],
		references: [profiles.id]
	}),
	rooms: many(rooms),
	groupMembers: many(groupMembers),
}));

export const profilesRelations = relations(profiles, ({one, many}) => ({
	groupMessages: many(groupMessages),
	groups: many(groups),
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	rooms: many(rooms),
	groupMembers: many(groupMembers),
	roomSeats: many(roomSeats),
	matchPlayers: many(matchPlayers),
	friendships_userLow: many(friendships, {
		relationName: "friendships_userLow_profiles_id"
	}),
	friendships_userHigh: many(friendships, {
		relationName: "friendships_userHigh_profiles_id"
	}),
	matchEvents: many(matchEvents),
}));

export const roomsRelations = relations(rooms, ({one, many}) => ({
	groupMessages: many(groupMessages),
	group: one(groups, {
		fields: [rooms.groupId],
		references: [groups.id]
	}),
	game: one(games, {
		fields: [rooms.gameId],
		references: [games.id]
	}),
	profile: one(profiles, {
		fields: [rooms.hostId],
		references: [profiles.id]
	}),
	matches: many(matches),
	roomSeats: many(roomSeats),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
}));

export const gamesRelations = relations(games, ({many}) => ({
	rooms: many(rooms),
	matches: many(matches),
}));

export const matchesRelations = relations(matches, ({one, many}) => ({
	room: one(rooms, {
		fields: [matches.roomId],
		references: [rooms.id]
	}),
	game: one(games, {
		fields: [matches.gameId],
		references: [games.id]
	}),
	matchPlayers: many(matchPlayers),
	matchStates: many(matchStates),
}));

export const groupMembersRelations = relations(groupMembers, ({one}) => ({
	group: one(groups, {
		fields: [groupMembers.groupId],
		references: [groups.id]
	}),
	profile: one(profiles, {
		fields: [groupMembers.userId],
		references: [profiles.id]
	}),
}));

export const roomSeatsRelations = relations(roomSeats, ({one}) => ({
	room: one(rooms, {
		fields: [roomSeats.roomId],
		references: [rooms.id]
	}),
	profile: one(profiles, {
		fields: [roomSeats.userId],
		references: [profiles.id]
	}),
}));

export const matchPlayersRelations = relations(matchPlayers, ({one, many}) => ({
	match: one(matches, {
		fields: [matchPlayers.matchId],
		references: [matches.id]
	}),
	profile: one(profiles, {
		fields: [matchPlayers.userId],
		references: [profiles.id]
	}),
	matchResults: many(matchResults),
}));

export const matchStatesRelations = relations(matchStates, ({one, many}) => ({
	match: one(matches, {
		fields: [matchStates.matchId],
		references: [matches.id]
	}),
	matchEvents: many(matchEvents),
}));

export const matchResultsRelations = relations(matchResults, ({one}) => ({
	matchPlayer: one(matchPlayers, {
		fields: [matchResults.matchId],
		references: [matchPlayers.matchId]
	}),
}));

export const friendshipsRelations = relations(friendships, ({one}) => ({
	profile_userLow: one(profiles, {
		fields: [friendships.userLow],
		references: [profiles.id],
		relationName: "friendships_userLow_profiles_id"
	}),
	profile_userHigh: one(profiles, {
		fields: [friendships.userHigh],
		references: [profiles.id],
		relationName: "friendships_userHigh_profiles_id"
	}),
}));

export const matchEventsRelations = relations(matchEvents, ({one}) => ({
	profile: one(profiles, {
		fields: [matchEvents.actorId],
		references: [profiles.id]
	}),
	matchState: one(matchStates, {
		fields: [matchEvents.matchId],
		references: [matchStates.matchId]
	}),
}));