-- Chat inside a match, separate from the group chat. Only the API reads and
-- writes it; messages reach phones on the match:<id> channel.

create table public.match_messages (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index match_messages_match_id_id_idx on public.match_messages (match_id, id);
create index match_messages_sender_id_idx on public.match_messages (sender_id);

alter table public.match_messages enable row level security;
revoke all on public.match_messages from anon, authenticated;
