begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

-- ---------------------------------------------------------------------------
-- Setup
-- ---------------------------------------------------------------------------

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('11111111-1111-4111-8111-111111111111', 'ada@example.com', '{"display_name":"Adaeze"}', 'authenticated', 'authenticated'),
  ('22222222-2222-4222-8222-222222222222', 'tunde@example.com', '{}', 'authenticated', 'authenticated'),
  ('33333333-3333-4333-8333-333333333333', 'outsider@example.com', '{"display_name":"   "}', 'authenticated', 'authenticated');

insert into public.rooms (id, game_id, host_id, max_players, invite_code) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lagos-property', '11111111-1111-4111-8111-111111111111', 6, 'ABC123');

insert into public.matches (id, room_id, game_id, state) values
  ('44444444-4444-4444-8444-444444444444', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'lagos-property', '{}');

insert into public.match_players (match_id, user_id, seat) values
  ('44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 0),
  ('44444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222', 1);

insert into public.match_states (match_id, version, state) values
  ('44444444-4444-4444-8444-444444444444', 0, '{}');

-- ---------------------------------------------------------------------------
-- Profiles are created on sign-up
-- ---------------------------------------------------------------------------

select is(
  (select display_name from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
  'Adaeze',
  'profile uses the sign-up display name'
);

select is(
  (select display_name from public.profiles where id = '22222222-2222-4222-8222-222222222222'),
  'tunde',
  'profile falls back to the email name'
);

select is(
  (select display_name from public.profiles where id = '33333333-3333-4333-8333-333333333333'),
  'outsider',
  'a blank display name falls back to the email name'
);

-- ---------------------------------------------------------------------------
-- Table rules
-- ---------------------------------------------------------------------------

select throws_ok(
  $$insert into public.rooms (game_id, host_id, max_players, invite_code)
    values ('lagos-property', '11111111-1111-4111-8111-111111111111', 6, 'abc123')$$,
  '23514',
  null,
  'invite codes must be uppercase letters and digits'
);

select throws_ok(
  $$insert into public.match_players (match_id, user_id, seat)
    values ('44444444-4444-4444-8444-444444444444', '33333333-3333-4333-8333-333333333333', 1)$$,
  '23505',
  null,
  'two players cannot share a seat'
);

select throws_ok(
  $$insert into public.match_events (match_id, version, events)
    values ('44444444-4444-4444-8444-444444444444', 1, '[]')$$,
  '23503',
  null,
  'a move cannot be logged without a saved state for that version'
);

insert into public.match_states (match_id, version, state) values
  ('44444444-4444-4444-8444-444444444444', 1, '{}');
insert into public.match_events (match_id, version, command_id, events) values
  ('44444444-4444-4444-8444-444444444444', 1, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '[]');
insert into public.match_states (match_id, version, state) values
  ('44444444-4444-4444-8444-444444444444', 2, '{}');

select throws_ok(
  $$insert into public.match_events (match_id, version, command_id, events)
    values ('44444444-4444-4444-8444-444444444444', 2, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', '[]')$$,
  '23505',
  null,
  'the same command id cannot be applied twice in a match'
);

select lives_ok(
  $$insert into public.match_events (match_id, version, command_id, events)
    values ('44444444-4444-4444-8444-444444444444', 2, null, '[]')$$,
  'timer moves can be logged without a command id'
);

-- ---------------------------------------------------------------------------
-- Phones cannot read or write tables
-- ---------------------------------------------------------------------------

set local role anon;

select throws_ok('select * from public.profiles', '42501', null, 'anon cannot read profiles');
select throws_ok('select * from public.games', '42501', null, 'anon cannot read games');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}', true);

select throws_ok('select * from public.profiles', '42501', null, 'signed-in users cannot read profiles');
select throws_ok('select * from public.matches', '42501', null, 'signed-in users cannot read match state');
select throws_ok('select * from public.match_states', '42501', null, 'signed-in users cannot read saved states');
select throws_ok(
  $$update public.matches set version = 99$$,
  '42501',
  null,
  'signed-in users cannot change a match'
);

-- ---------------------------------------------------------------------------
-- Live match channels
-- ---------------------------------------------------------------------------

select ok(
  private.can_listen_to_match('match:44444444-4444-4444-8444-444444444444'),
  'a seated player can listen to their match'
);

select ok(
  not private.can_listen_to_match('match:55555555-5555-4555-8555-555555555555'),
  'a player cannot listen to a different match'
);

select ok(
  not private.can_listen_to_match('match:not-a-uuid'),
  'a malformed topic is refused without an error'
);

select set_config('request.jwt.claims', '{"sub":"33333333-3333-4333-8333-333333333333","role":"authenticated"}', true);

select ok(
  not private.can_listen_to_match('match:44444444-4444-4444-8444-444444444444'),
  'a player who is not seated cannot listen'
);

reset role;

select policies_are(
  'realtime',
  'messages',
  array['members can receive their channel updates'],
  'phones can only receive on live channels and have no send rule'
);

select * from finish();
rollback;
