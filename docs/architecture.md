# Architecture

Multiplayer social gaming platform. The first game is Lagos Property.

The server owns every game outcome. The web app shows a synced copy of the match and never decides cash, property, loans, rent, dice, or turn deadlines.

## Stack

| Part | Choice |
|---|---|
| Web app | React, TypeScript, Vite, Tailwind, mobile-first web (no native app yet) |
| Routing | TanStack Router, file-based, typed params and search |
| Server data | TanStack Query |
| Local game and UI state | Zustand |
| Board | PixiJS |
| API | Hono on Node, always-on, hosted on Fly.io |
| Database | Supabase Postgres, queried from Hono with Drizzle |
| Login | Supabase Auth |
| Live updates | Supabase Realtime, private channel per match |
| Package manager | pnpm workspaces |

## Repo layout

```text
apps/web               React app: routes, queries, stores, Pixi board
apps/api               Hono service: login checks, commands, turn-timer worker
packages/contracts     Shared request, snapshot and event shapes
packages/lagos-rules   Lagos rules. No network or database code. Fully tested.
supabase/              Migrations, access rules, realtime setup
docs/                  This file
```

The web app may import `lagos-rules` for labels, hints and types. It must never use it to award cash, property or outcomes.

## Who owns what

- **TanStack Query:** profile, friends, groups, chat history, game list, rooms, match history, the first match load, and all commands sent to the API.
- **Zustand:** the live copy of the match, the selected tile, the camera, animations, dialogs and sheets, and the HUD.
- **TanStack Router:** pages and login guards. Guards make the app easier to use. They are not security. Hono checks every request. `/` is the signed-in home. Signed-out visitors go to `/login`.

Match stores live in `apps/web/src/features/match/stores/`:

- `game-session.store.ts`: match id, version, public game state. Only the sync layer writes to it.
- `board-ui.store.ts`: selected tile, zoom, camera.
- `game-animation.store.ts`: dice, token movement, payouts, building, EFCC raids. Never changes money.
- `game-dialog.store.ts`: which sheet or dialog is open. Holds ids, not copies of game data.

## Data access

- The app talks to Supabase directly only for **login** and **listening to live channels**.
- Everything else goes through Hono: friends, groups, chat, rooms, matches, and commands.
- Phones never read game tables. Hono sends a public view of the match with the card deck order and dice setup removed.

## How a move works

1. The player taps an action. The app sends the command with a command id.
2. Hono checks the login token and that the player is seated in the match.
3. In one database transaction, Hono:
   - locks the match row
   - returns the saved answer if this command id was already handled
   - runs the rules
   - saves the new state with version + 1
   - saves a full copy of that state and the move log entry
   - saves the receipt for the command id
   - sends the public event on the match's live channel
4. Commit. If anything fails, nothing is saved and nothing is sent.
5. Hono replies with the new public state and events. The acting player applies them right away.
6. Other players get the same reply from the live channel.

The reply and the live message have the same shape: the new public state plus the events. Phones replace their state with the server's. They never rebuild state from events. Events are only for animation.

A command only counts after the server confirms it. The app may show "rolling" or "sending". It never shows a dice number, cash change or new owner before the server does.

Retries reuse the same command id. The app never retries a command with a new id.

## Keeping the match in sync

The sync layer in the web app:

1. Loads the latest public match state through the API.
2. Stores it in `game-session.store` with its version.
3. Subscribes to the private match channel.
4. Applies an event only if its version is exactly the next one.
5. Ignores events it has already seen.
6. If a version is missing, fetches the missing moves or the latest state.
7. Matches server replies to commands it is waiting on.

A page refresh repeats step 1, so the match always comes back from the server.

## Turn timer

Each turn has a deadline stored with the match. A worker inside the Hono service finds overdue matches and plays the default move through the same steps as a normal move. It skips matches that are already locked, so running more than one copy of the service is safe.

Phones show time left from the server deadline. They do not count down in a store.

## Game rules for version 1

- 3 to 6 players. The host can start once 3 have joined. Empty seats close at start.
- The host picks match length (Short, Normal, Long) when creating the room. It locks at start.
- No auctions.
- **Timeout:** the server rolls and ends the turn. It never buys anything.
- **Missed turns:** a turn the server had to play. The count resets when the player acts again.
- **Removal:** after 3 missed turns in a row, the player goes bankrupt. Their properties go back to the bank. They can watch but cannot rejoin.
- **When a removed player is tied to others:**
  - Shared property goes fully to the co-owner for free.
  - Money they owe is lost for the lender.
  - Their open trade and loan offers are cancelled.

## Database

Platform tables: `profiles` (created automatically on sign-up), `games`, `rooms`, `room_seats`. Friends, groups and chat come later.

Game tables:

- `matches`: game, room, status, settings, current version, turn deadline, and the current full state.
- `match_players`: who is seated, and in which seat. Removed players stay so they can watch. Player status and missed turns live in the game state, so there is one source of truth.
- `match_states`: a full copy of the state after every move. Version 0 is the starting state.
- `match_events`: one row per accepted move. Version, command id, actor, public events. Never edited. The command id is unique per match, so it is also the retry receipt: a repeated command id returns the saved state and events for that version.
- `match_results`: one row per player, written once at the end, for history and profiles.

Each move must have a saved state for its version. The database enforces this.

Rules:

- Money is whole naira, stored as integers. No decimals.
- Game state is one JSON value per match, so each game can use its own shape.
- Phones have no read access to game tables.
- Only seated players can listen on a match channel. No phone can send on it.
- Supabase migrations define tables and access rules. Drizzle types are generated from them with `pnpm --filter @bankroll/api db:pull`.
- Database tests live in `supabase/tests` and run with `supabase test db`.

Live channels:

- Topic is `match:<match id>`. Phones must join with `private: true`.
- Only seated players can listen. There is no send rule, so phones cannot broadcast.
- The API sends with `realtime.send()` inside the move's transaction.
- A database broadcast can be dropped if no client has connected recently. Phones recover through the missing-version check, so this never corrupts state.

## Local setup

1. `supabase gen signing-key --algorithm ES256 > supabase/signing_keys.json` (once; the file is git-ignored).
2. `supabase start`. This project uses ports 55420–55429 so it can run next to other local Supabase projects.
3. Copy each app's `.env.example` to `.env`. Add the publishable key from `supabase status`.
4. `pnpm dev`.

## Board rendering

- Create the Pixi app once per match screen.
- Subscribe to only the store parts each layer needs.
- Update only the sprites that changed.
- Animate from server events.
- On leaving, remove subscriptions, textures and scene objects.
- Pixi never holds its own copy of money or ownership.

## Adding more games

The platform (home, friends, groups, rooms, profile, match route) does not know Lagos rules. Each game provides its own rules package, board, dialogs and commands. A new game plugs into the same match route and API command path.

## Open items

- Design the 6-player strip for the match screen. Current designs show 4 players.
- Agree round counts for Short, Normal and Long. `ROUNDS_BY_LENGTH` holds placeholders (24, 48, 72).
- Agree starting cash.
