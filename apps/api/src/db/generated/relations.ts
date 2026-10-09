import { relations } from "drizzle-orm/relations";
import { usersInAuth, profiles, games, rooms, matches, roomSeats, matchPlayers, matchStates, matchResults, matchEvents } from "./schema";

export const profilesRelations = relations(profiles, ({one, many}) => ({
	usersInAuth: one(usersInAuth, {
		fields: [profiles.id],
		references: [usersInAuth.id]
	}),
	rooms: many(rooms),
	roomSeats: many(roomSeats),
	matchPlayers: many(matchPlayers),
	matchEvents: many(matchEvents),
}));

export const usersInAuthRelations = relations(usersInAuth, ({many}) => ({
	profiles: many(profiles),
}));

export const roomsRelations = relations(rooms, ({one, many}) => ({
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