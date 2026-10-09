-- Usernames, friends, groups, group chat, and live channels for users,
-- groups and rooms.
--
-- Same access model as before: only the Hono API reads and writes these
-- tables. Phones only listen on private live channels.

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------

-- Returns a free username built from base, adding a random 4-digit suffix
-- when needed. Only called from the sign-up trigger and this migration.
create function private.unique_username(base text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  stem text := left(regexp_replace(lower(coalesce(base, '')), '[^a-z0-9_]', '', 'g'), 15);
  candidate text;
begin
  if char_length(stem) < 3 then
    stem := 'player';
  end if;
  candidate := stem;
  loop
    exit when not exists (select 1 from public.profiles p where p.username = candidate);
    candidate := stem || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
  end loop;
  return candidate;
end;
$$;

revoke all on function private.unique_username(text) from public, anon, authenticated;

alter table public.profiles add column username text;

do $$
declare
  r record;
begin
  for r in select id, display_name from public.profiles where username is null order by created_at loop
    update public.profiles set username = private.unique_username(r.display_name) where id = r.id;
  end loop;
end;
$$;

alter table public.profiles
  alter column username set not null,
  add constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,20}$'),
  add constraint profiles_username_key unique (username);

-- username and display_name come from sign-up metadata, which the user
-- controls. A taken or invalid username gets a generated one instead; the
-- user can change it later from their profile.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested text := lower(trim(new.raw_user_meta_data ->> 'username'));
  chosen text;
begin
  if requested ~ '^[a-z0-9_]{3,20}$'
    and not exists (select 1 from public.profiles p where p.username = requested) then
    chosen := requested;
  else
    chosen := private.unique_username(coalesce(nullif(requested, ''), split_part(new.email, '@', 1)));
  end if;

  insert into public.profiles (id, display_name, username)
  values (
    new.id,
    left(
      coalesce(
        nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
        split_part(new.email, '@', 1),
        'Player'
      ),
      40
    ),
    chosen
  );
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Friendships
-- ---------------------------------------------------------------------------

-- One row per pair of users, stored with the smaller id first so a pair can
-- only exist once. Declining or removing a friend deletes the row.
create table public.friendships (
  user_low uuid not null references public.profiles (id) on delete cascade,
  user_high uuid not null references public.profiles (id) on delete cascade,
  requested_by uuid not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (user_low, user_high),
  check (user_low < user_high),
  check (requested_by in (user_low, user_high)),
  check ((status = 'accepted') = (accepted_at is not null))
);

create index friendships_user_high_idx on public.friendships (user_high);

-- ---------------------------------------------------------------------------
-- Groups
-- ---------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  -- The API passes ownership on before an owner leaves.
  owner_id uuid not null references public.profiles (id),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{8}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index groups_owner_id_idx on public.groups (owner_id);

-- The 50-member limit is checked by the API while it holds a lock on the group.
create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_id_idx on public.group_members (user_id);

alter table public.rooms
  add column group_id uuid references public.groups (id) on delete set null;

create index rooms_group_id_idx on public.rooms (group_id);

-- 'system' messages are written by the API, e.g. "Ada started a room".
-- client_id lets a phone retry a send without posting twice.
create table public.group_messages (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  kind text not null default 'text' check (kind in ('text', 'system')),
  body text not null check (char_length(body) between 1 and 1000),
  room_id uuid references public.rooms (id) on delete set null,
  client_id uuid,
  created_at timestamptz not null default now()
);

create index group_messages_group_id_id_idx on public.group_messages (group_id, id desc);
create index group_messages_sender_id_idx on public.group_messages (sender_id);
create index group_messages_room_id_idx on public.group_messages (room_id);
create unique index group_messages_client_id_idx on public.group_messages (sender_id, client_id)
  where client_id is not null;

-- ---------------------------------------------------------------------------
-- Lock new tables to the API only
-- ---------------------------------------------------------------------------

alter table public.friendships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;

revoke all on public.friendships, public.groups, public.group_members, public.group_messages
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Live channels
-- ---------------------------------------------------------------------------
-- Topics:
--   match:<uuid>  players seated in the match
--   group:<uuid>  group members
--   room:<uuid>   players seated in the room, and members of the room's group
--   user:<uuid>   that user only (friend requests, group invites)
-- There is still no insert policy, so phones cannot send. The API sends with
-- realtime.send().

create function private.can_listen(topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  kind text := split_part(topic, ':', 1);
  raw_id text := substring(topic from position(':' in topic) + 1);
  target uuid;
begin
  if uid is null
    or raw_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  target := raw_id::uuid;

  case kind
    when 'match' then
      return exists (
        select 1 from public.match_players mp
        where mp.match_id = target and mp.user_id = uid
      );
    when 'group' then
      return exists (
        select 1 from public.group_members gm
        where gm.group_id = target and gm.user_id = uid
      );
    when 'room' then
      return exists (
        select 1 from public.room_seats rs
        where rs.room_id = target and rs.user_id = uid
      ) or exists (
        select 1 from public.rooms r
        join public.group_members gm on gm.group_id = r.group_id
        where r.id = target and gm.user_id = uid
      );
    when 'user' then
      return target = uid;
    else
      return false;
  end case;
end;
$$;

revoke all on function private.can_listen(text) from public, anon;
grant execute on function private.can_listen(text) to authenticated;

drop policy "match players can receive match updates" on realtime.messages;

create policy "members can receive their channel updates"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_listen((select realtime.topic()))
  );
