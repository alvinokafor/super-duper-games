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
| Board | Plain page elements (CSS grid) for tiles; PixiJS for the player pieces |
| API | Hono on Node, always-on, hosted on Fly.io |
| Database | Supabase Postgres, queried from Hono with Drizzle |
| Login | Supabase Auth |
| Live updates | Supabase Realtime, private channel per match |
| Package manager | pnpm workspaces |

## Repo layout

```text
apps/web               React app: routes, queries, stores, board
apps/api               Hono service: login checks, commands, turn-timer worker
packages/contracts     Shared request, snapshot and event shapes
packages/lagos-rules   Lagos rules. No network or database code. Fully tested.
supabase/              Migrations, access rules, realtime setup
docs/                  This file
```

The web app may import `lagos-rules` for labels, hints and types. It must never use it to award cash, property or outcomes.

## Who owns what

- **TanStack Query:** profile, friends, groups, chat history, game list, rooms, match history, the first match load, and all commands sent to the API.
- **Zustand:** the live copy of the match, the selected tile, the camera, animations, and the HUD.
- **TanStack Router:** pages and login guards. Guards make the app easier to use. They are not security. Hono checks every request. `/` is the signed-in home. Signed-out visitors go to `/login`.

Match stores live in `apps/web/src/features/match/stores/`:

- `game-session.store.ts`: match id, version, public game state. Only the sync layer writes to it.
- `board-ui.store.ts`: selected tile, zoom, camera.
- `game-animation.store.ts`: dice, token movement, payouts, building, EFCC raids. Never changes money. Cleared when a reload jumps the board ahead.

Which sheet is open is local to the match page.

## Data access

- The app talks to Supabase directly only for **login** and **listening to live channels**.
- Everything else goes through Hono: friends, groups, chat, rooms, matches, and commands.
- Phones never read game tables. Hono sends a public view of the match with hidden data, such as card deck order, removed.
- Every die roll and the turn-order shuffle use Node's secure `crypto.randomInt`, so past rolls say nothing about future ones.

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

Each turn phase has a deadline stored with the match: 30 seconds to roll, 30 to decide on a purchase, 30 for other actions. The deadline is set by the database clock, the same clock the worker checks. A move that leaves the same player on the same step, such as a build, keeps the deadline it had, so building can't stretch a turn. A worker inside the Hono service finds overdue matches and plays the default move through the same steps as a normal move. It skips matches that are already locked, so running more than one copy of the service is safe.

Phones show time left from the server deadline. They do not count down in a store.

## Game rules for version 1

The full rules live in `docs/lagos-property-rules.md`. Its decision log (section 26) wins over anything here.

- 3 to 6 players. The host can start once 3 have joined. Empty seats close at start.
- The round limit goes down as the player count goes up. Exact numbers come from simulations.
- No auctions.
- **Timeout:** the server rolls and ends the turn. It never buys anything.
- **Missed turns:** a turn the server had to play. The count resets when the player acts again.
- **Removal:** after 3 missed turns in a row, the player goes bankrupt. Their properties and buildings go back to the bank. They can watch but cannot rejoin.
- **Buildings:** on your own turn after landing, you can build on land you own. There's no limit per turn. Prices, income, rent and upkeep live in `packages/lagos-rules/src/buildings.ts` as settings. The rules package's `checkBuild` decides what's allowed, and both the server and the build card use it.
- **Rent and fees:** these are taken automatically when someone lands on owned land with a home or hotel, or on an owned utility. GO pays business and hotel income minus upkeep, and never less than zero.
- **When a removed player is tied to others:**
  - Shared property goes fully to the co-owner for free.
  - Money they owe is lost for the lender.
  - Their open trade and loan offers are cancelled.

## Database

Platform tables:

- `profiles`: created automatically on sign-up. Holds the display name and a unique lowercase username. A taken or invalid username at sign-up gets a numbered one instead.
- `friendships`: one row per pair of users, smaller id first. `pending` until the other person accepts. Declining, cancelling or unfriending deletes the row.
- `groups`, `group_members`: up to 50 members. The owner can rename, remove members and reset the invite link. Any member can add their own friends. When the owner leaves, the longest-standing member takes over; the last member leaving deletes the group.
- `group_messages`: chat plus system messages ("Ada started a room"). A phone sends a `client_id` with each message so a retry never posts twice.
- `games`, `rooms`, `room_seats`: a room can belong to a group. Rooms are shared by link: anyone signed in with the room link can take a free seat while it is open. When the host leaves, the next seat becomes host; an empty room closes.

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

Live channels (phones must join with `private: true`):

| Topic | Who can listen | What is sent |
|---|---|---|
| `match:<id>` | Players seated in the match | Match updates |
| `group:<id>` | Group members | New chat messages; "group changed" |
| `room:<id>` | Seated players and members of the room's group | "Room changed" |
| `user:<id>` | That user only | "Friends changed", "groups changed" |

- There is no send rule, so phones cannot broadcast.
- The API sends with `realtime.send()` inside the same transaction as the change.
- A database broadcast can be dropped if no client has connected recently. Phones refetch whenever a channel (re)connects, and match screens also use the missing-version check, so a dropped message never corrupts state.

## Accounts

- Sign-up asks for a name, username, email and password (8+ characters). The username is checked live against `GET /v1/public/usernames/:username`, the only API route that needs no login.
- New accounts must confirm their email before signing in. The confirmation link signs them in and opens the app.
- Forgot password emails a link to `/reset-password`, which signs the user in for that one purpose and asks for a new password.
- Locally, all emails land in Mailpit at http://127.0.0.1:55424. In production, the same settings (confirmations on, minimum password length 8, redirect URLs for the site) must be set in the Supabase dashboard, along with a real email provider.

## Local setup

1. `supabase gen signing-key --algorithm ES256 > supabase/signing_keys.json` (once; the file is git-ignored).
2. `supabase start`. This project uses ports 55420–55429 so it can run next to other local Supabase projects.
3. Copy each app's `.env.example` to `.env`. Add the publishable key from `supabase status`.
4. `pnpm dev`.
5. To check accounts, friends, groups, chat and rooms end to end against the running API: `SUPABASE_PUBLISHABLE_KEY=… SUPABASE_SECRET_KEY=… pnpm --filter @bankroll/api smoke:social` (both keys from `supabase status`; local only). `smoke:match` does the same for starting and playing a match; it waits about a minute at the end for the turn timer.

## Production

| Part | Where |
|---|---|
| Database, login, live updates | Supabase project `lagos-property` (`suzhmczhjoyalrctwjnt`, eu-west-1) |
| API | Fly.io app `lagos-property-api`, London, one machine always on |
| Web app | Vercel project `lagos-property` (root directory `apps/web`), https://lagos-property.vercel.app. Every push to `main` deploys it. |

- **Database changes:** `supabase db push --linked`. Check first with `--dry-run`.
- **API:** from the repo root, `fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile`. The build bundles everything into one file. `SUPABASE_URL` and `WEB_ORIGIN` live in `fly.toml`. The only secret is `DATABASE_URL`, set with `fly secrets set`: the session pooler address (port 5432, not the transaction pooler on 6543), ending in `?sslmode=require`.
- **Web:** Vercel builds `apps/web` using `apps/web/vercel.json`. Set `VITE_API_URL` (the Fly address), `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` and `ENABLE_EXPERIMENTAL_COREPACK=1` (so Vercel uses the pnpm version in `package.json`).
- **Supabase auth settings:** set the Site URL and redirect URLs to the Vercel address.

## Board rendering

- The board is plain page elements on an 8×8 grid, drawn to match the Paper design. This keeps text sharp and tiles easy to tap and read with a screen reader.
- Tiles read straight from the session store. The board never holds its own copy of money or ownership.
- An owned tile turns white and gets a bar in the owner's colour on the edge facing the middle of the board.
- The player pieces are drawn by PixiJS on a see-through layer over the tiles. After a roll, the die shows, then the piece hops one tile at a time (250 ms per tile), then the buy card opens.
- Animations (the die, the walk, the payday card) replay server events from the animation queue. They never change game data. If a phone falls behind, or the page is in the background, it skips straight to the latest state.
- The server adds 4 seconds to the landing and action timers so the die and walk don't eat into the player's time.
- A buy names the tile the player saw. The server refuses it if the player isn't on that tile, so a phone with an out-of-date board can't buy the wrong property.
- If the browser can't start PixiJS, the pieces are drawn as plain dots instead.

## Match chat

Each match has its own chat, separate from the group chat. Only seated players can read or post. Messages are saved in `match_messages` and sent on the match's live channel. Each player can send at most 5 messages in 10 seconds.

When a match ends, its room closes. Seated players can still open the match from the room to see the results.

## Adding more games

The platform (home, friends, groups, rooms, profile, match route) does not know Lagos rules. Each game provides its own rules package, board, dialogs and commands. A new game plugs into the same match route and API command path.

## Open items

- Design the 6-player strip for the match screen. Current designs show 4 players.
- Set round limits per player count from simulations. `ROUNDS_BY_PLAYER_COUNT` holds placeholders until then.
