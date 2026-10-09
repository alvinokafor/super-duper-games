-- Platform and match tables.
--
-- Only the Hono API reads and writes these tables. It connects as the database
-- owner. Phones never get table access: RLS is on with no policies, and the
-- anon and authenticated roles have no grants.

create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- display_name comes from sign-up metadata, which the user controls.
-- It is for display only and must never be used for permission checks.
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(new.email, '@', 1),
        'Player'
      ),
      40
    )
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- Games catalog
-- ---------------------------------------------------------------------------

create table public.games (
  id text primary key check (id ~ '^[a-z0-9-]+$'),
  name text not null,
  min_players smallint not null check (min_players >= 2),
  max_players smallint not null check (max_players >= min_players),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.games (id, name, min_players, max_players)
values ('lagos-property', 'Lagos Property', 3, 6);

-- ---------------------------------------------------------------------------
-- Rooms and seats
-- ---------------------------------------------------------------------------

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id),
  host_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'started', 'closed')),
  max_players smallint not null check (max_players between 2 and 12),
  -- Game-specific options such as match length. The API validates the shape.
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6,10}$'),
  created_at timestamptz not null default now(),
  started_at timestamptz
);

create index rooms_game_id_idx on public.rooms (game_id);
create index rooms_host_id_idx on public.rooms (host_id);

create table public.room_seats (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null check (seat between 0 and 11),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  unique (room_id, seat)
);

create index room_seats_user_id_idx on public.room_seats (user_id);

-- ---------------------------------------------------------------------------
-- Matches
-- ---------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null unique references public.rooms (id),
  game_id text not null references public.games (id),
  status text not null default 'active' check (status in ('active', 'finished', 'abandoned')),
  version integer not null default 0 check (version >= 0),
  -- Full state, including hidden data such as deck order and dice setup.
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  turn_deadline timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index matches_game_id_idx on public.matches (game_id);

-- Used by the turn-timer worker to find overdue turns.
create index matches_turn_deadline_idx on public.matches (turn_deadline)
  where status = 'active' and turn_deadline is not null;

-- Who is seated in a match. Player status (playing, bankrupt, removed) lives in
-- the game state so there is only one source of truth. Removed players stay
-- here so they can keep watching.
create table public.match_players (
  match_id uuid not null references public.matches (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  seat smallint not null check (seat between 0 and 11),
  joined_at timestamptz not null default now(),
  primary key (match_id, user_id),
  unique (match_id, seat)
);

create index match_players_user_id_idx on public.match_players (user_id);

-- A full copy of the state after every move. Version 0 is the starting state.
create table public.match_states (
  match_id uuid not null references public.matches (id) on delete cascade,
  version integer not null check (version >= 0),
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  created_at timestamptz not null default now(),
  primary key (match_id, version)
);

-- One row per accepted move. Never edited.
-- command_id is null for moves made by the turn-timer worker.
-- The unique command_id doubles as the retry receipt: a repeated command id
-- returns the saved state and events for that version instead of running again.
create table public.match_events (
  match_id uuid not null,
  version integer not null check (version >= 1),
  command_id uuid,
  actor_id uuid references public.profiles (id) on delete set null,
  events jsonb not null check (jsonb_typeof(events) = 'array'),
  created_at timestamptz not null default now(),
  primary key (match_id, version),
  foreign key (match_id, version) references public.match_states (match_id, version) on delete cascade
);

create unique index match_events_command_id_idx on public.match_events (match_id, command_id)
  where command_id is not null;

create index match_events_actor_id_idx on public.match_events (actor_id);

-- Written once when a match ends. Used for match history and profiles.
create table public.match_results (
  match_id uuid not null,
  user_id uuid not null,
  rank smallint not null check (rank >= 1),
  score bigint not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id),
  foreign key (match_id, user_id) references public.match_players (match_id, user_id) on delete cascade
);

create index match_results_user_id_idx on public.match_results (user_id);

-- ---------------------------------------------------------------------------
-- Lock tables to the API only
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.rooms enable row level security;
alter table public.room_seats enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_states enable row level security;
alter table public.match_events enable row level security;
alter table public.match_results enable row level security;

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Live match channels
-- ---------------------------------------------------------------------------
-- Topic format: match:<match uuid>. Only players seated in the match can listen.
-- There is no insert policy, so phones cannot send on match channels. The API
-- sends with realtime.send() inside the same transaction as the move.

create function private.can_listen_to_match(topic text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when topic ~ '^match:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then exists (
      select 1
      from public.match_players mp
      where mp.match_id = substring(topic from 7)::uuid
        and mp.user_id = (select auth.uid())
    )
    else false
  end;
$$;

revoke all on function private.can_listen_to_match(text) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_listen_to_match(text) to authenticated;

create policy "match players can receive match updates"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_listen_to_match((select realtime.topic()))
  );
