-- Group colour and description, and each member's read position so the app
-- can show unread counts.

alter table public.groups
  add column color text not null default 'brass'
    check (color in ('brass', 'lagoon', 'navy', 'rose', 'violet')),
  add column description text
    check (char_length(description) between 1 and 160);

-- Id of the newest message this member has seen. Null means they have not
-- opened the chat yet; only messages after joined_at count as unread.
alter table public.group_members add column last_read_message_id bigint;
