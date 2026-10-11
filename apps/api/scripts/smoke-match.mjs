// End-to-end check of starting a Lagos Property match and playing turns
// with three players against a running API and local Supabase. Creates
// throwaway users each run. Waits about a minute at the end: once to see the
// turn timer play a turn, and once to tap just as the timer fires.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... pnpm --filter @bankroll/api smoke:match
//
// Never point this at production.
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const URL_ = process.env.SUPABASE_URL ?? "http://127.0.0.1:55421";
const PUB = process.env.SUPABASE_PUBLISHABLE_KEY;
const API = `http://localhost:${process.env.PORT ?? 8787}`;
if (!PUB || !process.env.SUPABASE_SECRET_KEY) throw new Error("Set SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY");
if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(URL_)) throw new Error("Only run this against local Supabase");
const admin = createClient(URL_, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const stamp = Date.now().toString(36);
let failures = 0;
const check = (cond, label) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}`);
  if (!cond) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function makeUser(name) {
  const email = `${name}.${stamp}@example.com`;
  const { error } = await admin.auth.admin.createUser({
    email, password: "password123", email_confirm: true,
    user_metadata: { username: `${name}_${stamp}`.slice(0, 20), display_name: name },
  });
  if (error) throw error;
  const client = createClient(URL_, PUB, { auth: { persistSession: false } });
  const { data, error: e2 } = await client.auth.signInWithPassword({ email, password: "password123" });
  if (e2) throw e2;
  const token = data.session.access_token;
  const call = async (path, method = "GET", body) => {
    const res = await fetch(API + path, {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body && { "Content-Type": "application/json" }) },
      body: body && JSON.stringify(body),
    });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };
  const me = (await call("/v1/me")).body;
  client.realtime.setAuth(token);
  // One channel per topic per client; received[event] collects payloads.
  const listen = (topic, events) =>
    new Promise((resolve, reject) => {
      const received = Object.fromEntries(events.map((e) => [e, []]));
      let settled = false;
      const fail = (reason) => {
        if (settled) return;
        settled = true;
        reject(new Error(`cannot listen to ${topic}: ${reason}`));
        setTimeout(() => client.removeChannel(ch), 0);
      };
      const ch = client.channel(topic, { config: { private: true } });
      for (const event of events) ch.on("broadcast", { event }, (m) => received[event].push(m.payload));
      ch.subscribe((status) => {
          if (status !== "SUBSCRIBED") return fail(status);
          if (settled) return;
          settled = true;
          resolve({ received, close: () => client.removeChannel(ch) });
        });
      setTimeout(() => fail("timed out"), 8000);
    });
  return { name, me, call, listen, client };
}

const a = await makeUser("ada");
const b = await makeUser("bola");
const c = await makeUser("chidi");
const outsider = await makeUser("dayo");
const byId = new Map([a, b, c].map((u) => [u.me.id, u]));

// Lobby
const room = (await a.call("/v1/rooms", "POST", { gameId: "lagos-property" })).body;
await b.call(`/v1/rooms/${room.id}/join`, "POST");
check((await a.call(`/v1/rooms/${room.id}/start`, "POST")).status === 409, "cannot start with 2 players");
await c.call(`/v1/rooms/${room.id}/join`, "POST");
const roomChannel = await b.listen(`room:${room.id}`, ["room_changed"]);
check((await b.call(`/v1/rooms/${room.id}/start`, "POST")).status === 403, "only the host can start");
const started = await a.call(`/v1/rooms/${room.id}/start`, "POST");
check(started.status === 200 && started.body.status === "started" && started.body.matchId, "host starts the match");
check((await a.call(`/v1/rooms/${room.id}/start`, "POST")).status === 409, "cannot start twice");
check((await outsider.call(`/v1/rooms/${room.id}/join`, "POST")).status === 409, "cannot join a started room");
await wait(500);
check(roomChannel.received.room_changed.length > 0, "lobby gets a live update when the match starts");
const matchId = started.body.matchId;
check((await b.call(`/v1/rooms/${room.id}`)).body.matchId === matchId, "room links to the match");

// First load
const views = await Promise.all([a, b, c].map((u) => u.call(`/v1/matches/${matchId}`)));
const first = views[0].body.snapshot;
check(views.every((v) => v.status === 200 && v.body.snapshot.version === 0), "all three load version 0");
check(views[0].body.players.length === 3, "match lists three players");
check(first.state.players.every((p) => p.cash === 75000 && p.position === 0), "everyone starts with ₦75,000 on GO");
check(first.turnDeadline && new Date(first.turnDeadline) > new Date(), "first turn has a deadline");
check(!("hidden" in first.state) && !JSON.stringify(views[0].body).includes("rngState"), "hidden dice state is not sent");
check((await outsider.call(`/v1/matches/${matchId}`)).status === 404, "outsiders cannot load the match");
const outsiderListen = await outsider.listen(`match:${matchId}`, ["match_event"]).then(() => "ok", (e) => e.message);
check(outsiderListen !== "ok", `outsiders cannot listen to the match (${outsiderListen})`);

const channels = await Promise.all([a, b, c].map((u) => u.listen(`match:${matchId}`, ["match_event", "match_message"])));
const moves = channels.map((ch) => ch.received.match_event);

// Turns
let snapshot = first;
const send = (user, command, commandId = randomUUID()) =>
  user.call(`/v1/matches/${matchId}/commands`, "POST", { commandId, command });

const notTurn = [a, b, c].find((u) => u.me.id !== snapshot.state.currentPlayerId);
check((await send(notTurn, { type: "roll_dice" })).body.error?.code === "not_your_turn", "only the current player can roll");

const roller = byId.get(snapshot.state.currentPlayerId);
const rollId = randomUUID();
const rolled = await send(roller, { type: "roll_dice" }, rollId);
check(rolled.status === 200 && rolled.body.snapshot.version === 1, "roll accepted");
const retry = await send(roller, { type: "roll_dice" }, rollId);
check(retry.status === 200 && retry.body.applied.version === 1 && retry.body.snapshot.version === 1, "retrying the same command does not roll again");
check((await send(roller, { type: "roll_dice" })).body.error?.code === "illegal_move", "cannot roll twice in a turn");

/** Finishes the current player's turn without buying. */
const nextUp = async () => {
  const user = byId.get(snapshot.state.currentPlayerId);
  if (snapshot.state.phase === "awaiting_purchase") snapshot = (await send(user, { type: "pass_property" })).body.snapshot;
  snapshot = (await send(user, { type: "end_turn" })).body.snapshot;
};
snapshot = rolled.body.snapshot;
await nextUp();

// Two taps at once: the same tap sent twice counts once; two different rolls
// cannot both land.
const twin = byId.get(snapshot.state.currentPlayerId);
const twinId = randomUUID();
const twins = await Promise.all([send(twin, { type: "roll_dice" }, twinId), send(twin, { type: "roll_dice" }, twinId)]);
check(
  twins.every((r) => r.status === 200 && r.body.applied.version === snapshot.version + 1),
  "the same tap sent twice at once is applied once",
);
snapshot = twins.map((r) => r.body.snapshot).sort((x, y) => y.version - x.version)[0];
check(snapshot.version === twins[0].body.applied.version, "no extra move was saved for the double tap");
await nextUp();
const racer = byId.get(snapshot.state.currentPlayerId);
const racing = await Promise.all([send(racer, { type: "roll_dice" }), send(racer, { type: "roll_dice" })]);
check(
  racing.filter((r) => r.status === 200).length === 1 && racing.some((r) => r.body.error?.code === "illegal_move"),
  "two different rolls at once: one lands, one is refused",
);
snapshot = racing.find((r) => r.status === 200).body.snapshot;
await nextUp();

// Keep playing until someone buys. Most spaces are for sale, so this ends in
// a turn or two.
let bought = 0;
for (let turn = 0; turn < 40 && bought === 0; turn++) {
  const user = byId.get(snapshot.state.currentPlayerId);
  if (snapshot.state.phase === "awaiting_roll") snapshot = (await send(user, { type: "roll_dice" })).body.snapshot;
  if (snapshot.state.phase === "awaiting_purchase") {
    const before = snapshot.state.players.find((p) => p.id === user.me.id);
    const res = await send(user, { type: "buy_property", space: before.position });
    if (res.status === 200) {
      const after = res.body.snapshot.state.players.find((p) => p.id === user.me.id);
      if (bought === 0) check(after.cash < before.cash && res.body.snapshot.state.owners[after.position] === user.me.id, "buying takes cash and records the owner");
      snapshot = res.body.snapshot;
      if (bought === 0) {
        // Utilities can't be built on; land with one of three can take a shop.
        const built = await send(user, { type: "build", space: after.position, building: "shop" });
        check(
          built.status === 200
            ? built.body.snapshot.state.buildings[after.position].commercial === "shop"
            : built.body.error?.code === "illegal_move" || built.body.error?.code === "not_enough_cash",
          `building a shop on the new land is applied or cleanly refused (${built.status})`,
        );
        if (built.status === 200) {
          check(built.body.snapshot.turnDeadline === snapshot.turnDeadline, "building keeps the turn deadline");
          snapshot = built.body.snapshot;
        }
      }
      bought++;
    } else {
      snapshot = (await send(user, { type: "pass_property" })).body.snapshot;
    }
  }
  snapshot = (await send(user, { type: "end_turn" })).body.snapshot;
}
check(bought > 0, "a property was bought");

const lateRetry = await send(roller, { type: "roll_dice" }, rollId);
check(
  lateRetry.status === 200 && lateRetry.body.applied.version === 1 && lateRetry.body.snapshot.version === snapshot.version,
  "a retry after newer moves confirms the old move and returns the latest board",
);
check((await a.call(`/v1/matches/${matchId}`)).body.snapshot.version === snapshot.version, "the late retry changed nothing");

await wait(800);
const reloaded = await Promise.all([a, b, c].map((u) => u.call(`/v1/matches/${matchId}`)));
const same = reloaded.map((r) => JSON.stringify(r.body.snapshot.state));
check(same.every((s) => s === same[0]) && reloaded[0].body.snapshot.version === snapshot.version, "all three see the same board after reload");
for (const [i, ch] of moves.entries()) {
  const versions = ch.map((u) => u.applied.version);
  const inOrder = versions.every((v, j) => v === j + 1);
  check(inOrder && versions.at(-1) === snapshot.version, `${[a, b, c][i].name} got every move live, in order`);
  check(JSON.stringify(ch.at(-1).snapshot.state) === same[0], `${[a, b, c][i].name}'s live state matches the server`);
}

// Chat
const sent = await a.call(`/v1/matches/${matchId}/messages`, "POST", { body: "Na my turn next o" });
check(sent.status === 201 && sent.body.sender.id === a.me.id, "match chat message sent");
check((await outsider.call(`/v1/matches/${matchId}/messages`, "POST", { body: "hi" })).status === 404, "outsiders cannot chat");
await wait(500);
check(channels.slice(1).every((ch) => ch.received.match_message.some((m) => m.id === sent.body.id)), "others get the chat message live");
check((await c.call(`/v1/matches/${matchId}/messages`)).body.messages.at(-1)?.body === "Na my turn next o", "chat history loads");
const burst = await Promise.all(
  Array.from({ length: 7 }, (_, i) => b.call(`/v1/matches/${matchId}/messages`, "POST", { body: `spam ${i}` })),
);
check(
  burst.filter((r) => r.status === 201).length === 5 && burst.filter((r) => r.status === 429).length === 2,
  "chat allows 5 messages in 10 seconds, even when sent at once",
);

// Turn timer
const lastMove = moves[0].at(-1);
// A roll's landing and action phases get 4 extra seconds for the die and walk.
const expectedWait = lastMove.snapshot.state.phase === "awaiting_roll" ? 30_000 : 34_000;
check(
  new Date(lastMove.snapshot.turnDeadline) - new Date(lastMove.applied.createdAt) === expectedWait,
  `the deadline is ${expectedWait / 1000} seconds after the move by the database clock`,
);
const idle = snapshot.state.currentPlayerId;
const deadline = new Date(snapshot.turnDeadline).getTime();
console.log(`...waiting ${Math.round((deadline - Date.now()) / 1000) + 2}s for the turn timer`);
await wait(Math.max(0, deadline - Date.now()) + 2500);
const afterTimeout = (await b.call(`/v1/matches/${matchId}`)).body.snapshot;
const idlePlayer = afterTimeout.state.players.find((p) => p.id === idle);
check(afterTimeout.state.currentPlayerId !== idle && idlePlayer.missedTurns === 1, "turn timer plays the idle player's turn");
check(moves[1].at(-1).applied.events.some((e) => e.type === "turn_timed_out"), "timed-out turn is sent live");

// A tap landing just as the timer fires. Either may win, but only one of
// them, and every phone must still agree.
const late = byId.get(afterTimeout.state.currentPlayerId);
const lateDeadline = new Date(afterTimeout.turnDeadline).getTime();
console.log(`...waiting ${Math.round((lateDeadline - Date.now()) / 1000)}s to tap as the timer fires`);
await wait(Math.max(0, lateDeadline - Date.now() - 300));
const taps = [];
for (let i = 0; i < 12; i++) {
  taps.push(send(late, { type: "roll_dice" }));
  await wait(100);
}
const tapped = await Promise.all(taps);
await wait(2500);
const settled = (await a.call(`/v1/matches/${matchId}`)).body.snapshot;
const latePlayer = settled.state.players.find((p) => p.id === late.me.id);
const rollsLanded = tapped.filter((r) => r.status === 200).length;
check(tapped.every((r) => r.status === 200 || r.status === 409), "no tap failed with a server error during the race");
check(
  (rollsLanded === 1 && latePlayer.missedTurns === 0) || (rollsLanded === 0 && latePlayer.missedTurns === 1),
  `exactly one of the tap or the timer won (${rollsLanded ? "tap" : "timer"})`,
);
for (const [i, ch] of moves.entries()) {
  const versions = ch.map((u) => u.applied.version);
  check(
    versions.every((v, j) => v === j + 1) && versions.at(-1) === settled.version,
    `${[a, b, c][i].name} saw every move in order through the race`,
  );
  check(JSON.stringify(ch.at(-1).snapshot.state) === JSON.stringify(settled.state), `${[a, b, c][i].name} agrees with the server after the race`);
}

for (const ch of [...channels, roomChannel]) ch.close();
console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
