begin;
create extension if not exists pgtap with schema extensions;

select plan(24);

-- ---------------------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'ada@example.com', '{"display_name":"Adaeze","username":"Ada_Eze"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'tunde.b@example.com', '{"username":"ada_eze"}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'x@example.com', '{"username":"no spaces!"}', 'authenticated', 'authenticated'),
  ('44444444-4444-4444-8444-444444444444', 'outsider@example.com', '{}', 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------------
-- Usernames
-- ---------------------------------------------------------------------------

select is(
  (select username from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'ada_eze',
  'the requested username is used, in lowercase'
);

select matches(
  (select username from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  '^ada_eze_[0-9]{4}$',
  'a taken username gets a numbered one instead'
);

select matches(
  (select username from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  '^nospaces(_[0-9]{4})?$',
  'an invalid username is cleaned up'
);

select is(
  (select username from public.profiles where id = '44444444-4444-4444-8444-444444444444'),
  'outsider',
  'no username falls back to the email name'
);

select throws_ok(
  $$update public.profiles set username = 'Ada' where id = '44444444-4444-4444-8444-444444444444'$$,
  '23514',
  null,
  'usernames must be lowercase'
);

select throws_ok(
  $$update public.profiles set username = 'ada_eze' where id = '44444444-4444-4444-8444-444444444444'$$,
  '23505',
  null,
  'usernames are unique'
);

-- ---------------------------------------------------------------------------
-- Friendships
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.friendships (user_low, user_high, requested_by)
    values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222')$$,
  '23514',
  null,
  'a pair is stored with the smaller id first'
);

select throws_ok(
  $$insert into public.friendships (user_low, user_high, requested_by)
    values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333')$$,
  '23514',
  null,
  'only one of the pair can send the request'
);

select throws_ok(
  $$insert into public.friendships (user_low, user_high, requested_by, status)
    values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'accepted')$$,
  '23514',
  null,
  'an accepted friendship needs an accepted time'
);

insert into public.friendships (user_low, user_high, requested_by) values
  ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111');

select throws_ok(
  $$insert into public.friendships (user_low, user_high, requested_by)
    values ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222')$$,
  '23505',
  null,
  'a pair can only have one friendship row'
);

-- ---------------------------------------------------------------------------
-- Groups and chat
-- ---------------------------------------------------------------------------

insert into public.groups (id, name, owner_id, invite_code) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Sunday Squad', '11111111-1111-4111-8111-111111111111', 'SQUAD123');

insert into public.group_members (group_id, user_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222');

insert into public.rooms (id, game_id, host_id, max_players, invite_code, group_id) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'lagos-property', '11111111-1111-4111-8111-111111111111', 6, 'ROOM123', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.room_seats (room_id, user_id, seat) values
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '11111111-1111-4111-8111-111111111111', 0);

select throws_ok(
  $$insert into public.groups (name, owner_id, invite_code)
    values ('Bad code', '11111111-1111-4111-8111-111111111111', 'short')$$,
  '23514',
  null,
  'group invite codes are 8 uppercase letters or digits'
);

select throws_ok(
  $$update public.groups set color = 'pink' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514',
  null,
  'group colour must be one of the five design colours'
);

select throws_ok(
  $$update public.groups set description = '' where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'$$,
  '23514',
  null,
  'an empty group description is stored as null, not an empty string'
);

select throws_ok(
  $$insert into public.group_messages (group_id, sender_id, body)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', '')$$,
  '23514',
  null,
  'empty messages are refused'
);

insert into public.group_messages (group_id, sender_id, body, client_id) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Who is playing tonight?', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

select throws_ok(
  $$insert into public.group_messages (group_id, sender_id, body, client_id)
    values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Who is playing tonight?', 'cccccccc-cccc-4ccc-8ccc-cccccccccccc')$$,
  '23505',
  null,
  'a retried send with the same client id is not posted twice'
);

-- ---------------------------------------------------------------------------
-- Phones cannot read the new tables
-- ---------------------------------------------------------------------------

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select throws_ok('select * from public.friendships', '42501', null, 'signed-in users cannot read friendships');
select throws_ok('select * from public.group_messages', '42501', null, 'signed-in users cannot read group chat');

-- ---------------------------------------------------------------------------
-- Live channels
-- ---------------------------------------------------------------------------

select ok(private.can_listen('user:11111111-1111-4111-8111-111111111111'), 'a user can listen to their own channel');
select ok(not private.can_listen('user:22222222-2222-4222-8222-222222222222'), 'a user cannot listen to someone else''s channel');
select ok(private.can_listen('group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'a member can listen to their group');
select ok(private.can_listen('room:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'a seated player can listen to the room');

select set_config('request.jwt.claims', '{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}', true);

select ok(private.can_listen('room:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'a group member can watch the group''s room before joining');

select set_config('request.jwt.claims', '{"sub":"44444444-4444-4444-8444-444444444444","role":"authenticated"}', true);

select ok(
  not private.can_listen('group:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
    and not private.can_listen('room:bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'an outsider cannot listen to the group or its room'
);

select ok(not private.can_listen('lobby:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'), 'unknown channel types are refused');

reset role;
select * from finish();
rollback;
