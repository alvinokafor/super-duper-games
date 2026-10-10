// End-to-end check of accounts, friends, groups, chat and rooms against a
// running API and local Supabase. Creates throwaway users each run.
//
//   SUPABASE_PUBLISHABLE_KEY=... SUPABASE_SECRET_KEY=... pnpm --filter @bankroll/api smoke:social
//
// Both keys are printed by `supabase status`. Never point this at production.
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
  const listen = (topic, event) =>
    new Promise((resolve, reject) => {
      const received = [];
      const ch = client.channel(topic, { config: { private: true } })
        .on("broadcast", { event }, (m) => received.push(m.payload))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") resolve({ received, close: () => client.removeChannel(ch) });
          if (status === "CHANNEL_ERROR") reject(new Error(`cannot listen to ${topic}`));
        });
    });
  return { name, me, call, listen, client };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const a = await makeUser("ada");
const b = await makeUser("bola");
const c = await makeUser("chidi");
check(a.me.username === `ada_${stamp}`.slice(0, 20), "sign-up username is saved");

// Usernames
check((await fetch(`${API}/v1/public/usernames/${a.me.username}`).then((r) => r.json())).available === false, "taken username is reported");
check((await fetch(`${API}/v1/public/usernames/free_${stamp}`).then((r) => r.json())).available === true, "free username is reported");
check((await a.call("/v1/me", "PATCH", { username: b.me.username })).status === 409, "cannot take someone else's username");
check((await a.call("/v1/me", "PATCH", { displayName: "Ada E" })).body.displayName === "Ada E", "display name can be changed");

// Friends
const cUserChannel = await c.listen(`user:${c.me.id}`, "user_event");
const search = await a.call(`/v1/users/search?q=${b.me.username.slice(0, 6)}`);
check(search.body.users.some((u) => u.id === b.me.id && u.relationship === "none"), "search finds a player by username");
check((await a.call("/v1/friends/requests", "POST", { username: b.me.username })).body.relationship === "request_sent", "friend request sent");
check((await b.call("/v1/friends")).body.incoming.some((u) => u.id === a.me.id), "request shows as incoming");
check((await b.call(`/v1/friends/${a.me.id}/accept`, "POST")).status === 200, "request accepted");
check((await a.call("/v1/friends")).body.friends.some((u) => u.id === b.me.id), "now friends");

await a.call("/v1/friends/requests", "POST", { username: c.me.username });
await wait(500);
check(cUserChannel.received.some((e) => e.type === "friends_changed"), "recipient gets a live friend request update");
check((await c.call(`/v1/friends/${a.me.id}`, "DELETE")).status === 200, "request declined");
check((await a.call("/v1/friends")).body.outgoing.length === 0, "declined request is gone");
await a.call("/v1/friends/requests", "POST", { username: c.me.username });
check((await c.call("/v1/friends/requests", "POST", { username: a.me.username })).body.relationship === "friends", "asking back makes you friends");
check((await a.call("/v1/friends/requests", "POST", { username: a.me.username })).status === 400, "cannot add yourself");

// Groups
check((await b.call("/v1/groups", "POST", { name: "Bad", memberIds: [c.me.id] })).status === 403, "cannot add non-friends to a new group");
const created = await a.call("/v1/groups", "POST", { name: "Sunday Squad", memberIds: [b.me.id] });
check(created.status === 201 && created.body.members.length === 2, "group created with a friend");
const groupId = created.body.id;
check((await c.call(`/v1/groups/${groupId}`)).status === 404, "non-members cannot see the group");
check((await b.call(`/v1/groups/${groupId}/members`, "POST", { userIds: [c.me.id] })).status === 403, "members can only add their own friends");
check((await a.call(`/v1/groups/${groupId}/members`, "POST", { userIds: [c.me.id] })).body.members.length === 3, "owner adds a friend");
await wait(500);
check(cUserChannel.received.some((e) => e.type === "groups_changed"), "added player gets a live groups update");
check((await c.call("/v1/groups")).body.groups.some((g) => g.id === groupId && g.memberCount === 3), "group shows in the list");
const unreadFor = async (u) => (await u.call("/v1/groups")).body.groups.find((g) => g.id === groupId)?.unreadCount;
check((await unreadFor(c)) === 0, "notes like \"Ada added Chidi\" don't count as unread");

// Chat
const cGroup = await c.listen(`group:${groupId}`, "group_message");
const clientId = crypto.randomUUID();
const sent = await b.call(`/v1/groups/${groupId}/messages`, "POST", { body: "Who is playing tonight?", clientId });
const retry = await b.call(`/v1/groups/${groupId}/messages`, "POST", { body: "Who is playing tonight?", clientId });
check(sent.status === 201 && retry.body.id === sent.body.id, "retrying a send does not post twice");
await wait(800);
check(cGroup.received.filter((m) => m.body === "Who is playing tonight?").length === 1, "members get chat messages live, once");
const page = await c.call(`/v1/groups/${groupId}/messages`);
check(page.body.messages[0].id === sent.body.id && page.body.messages.some((m) => m.kind === "system"), "message history includes chat and system messages");
check((await unreadFor(c)) === 1 && (await unreadFor(b)) === 0, "unread counts skip your own messages");
await a.call(`/v1/groups/${groupId}/messages`, "POST", { body: "Me!", clientId: crypto.randomUUID() });
await wait(500);
check(cUserChannel.received.some((e) => e.type === "group_activity"), "members get a live nudge about new messages");
check((await c.call(`/v1/groups/${groupId}/read`, "POST")).status === 204 && (await unreadFor(c)) === 0, "opening the chat clears unread");
check((await unreadFor(b)) === 1, "other members still see their unread count");

const outsider = await makeUser("dayo");
let outsiderBlocked = false;
try { await outsider.listen(`group:${groupId}`, "group_message"); } catch { outsiderBlocked = true; }
check(outsiderBlocked, "outsiders cannot listen to group chat");
check((await outsider.call(`/v1/groups/${groupId}/read`, "POST")).status === 404, "outsiders cannot mark a chat as read");

// Owner rules and invite link
check((await c.call(`/v1/groups/${groupId}`, "PATCH", { name: "Mine" })).status === 403, "only the owner can rename");
const edited = await a.call(`/v1/groups/${groupId}`, "PATCH", { color: "navy", description: "  Saturday games  " });
check(edited.body.color === "navy" && edited.body.description === "Saturday games", "owner sets colour and description");
check((await a.call(`/v1/groups/${groupId}`, "PATCH", { description: "" })).body.description === null, "clearing the description removes it");
check((await a.call(`/v1/groups/${groupId}`, "PATCH", { color: "pink" })).status === 400, "unknown colours are refused");
check((await c.call(`/v1/groups/${groupId}/members/${b.me.id}`, "DELETE")).status === 403, "only the owner can remove others");
check((await a.call(`/v1/groups/${groupId}/members/${c.me.id}`, "DELETE")).status === 200, "owner removes a member");
const code = (await a.call(`/v1/groups/${groupId}`)).body.inviteCode;
check((await c.call(`/v1/group-invites/${code}`)).body.isMember === false, "invite preview works for non-members");
check((await c.call(`/v1/group-invites/${code}/join`, "POST")).body.groupId === groupId, "join with invite link");
const newCode = (await a.call(`/v1/groups/${groupId}/invite-code`, "POST")).body.inviteCode;
check(newCode !== code && (await c.call(`/v1/group-invites/${code}`)).status === 404, "reset invite link stops the old one");
check((await a.call(`/v1/groups/${groupId}/members/${a.me.id}`, "DELETE")).body.deleted === false, "owner leaves");
check((await b.call(`/v1/groups/${groupId}`)).body.ownerId === b.me.id, "longest-standing member becomes owner");

// Rooms
await b.call(`/v1/groups/${groupId}/read`, "POST");
await c.call(`/v1/groups/${groupId}/read`, "POST");
const room = await b.call("/v1/rooms", "POST", { gameId: "lagos-property", groupId });
check(room.status === 201 && room.body.seats.length === 1, "room created from a group");
await wait(500);
check(cGroup.received.some((m) => m.kind === "system" && m.roomId === room.body.id), "group chat announces the room");
check((await unreadFor(c)) === 1, "a new room counts as unread for other members");
check((await unreadFor(b)) === 0, "a new room does not count as unread for the player who started it");
const cRoom = await c.listen(`room:${room.body.id}`, "room_changed");
check((await c.call(`/v1/rooms/${room.body.id}/join`, "POST")).body.seats.length === 2, "group member joins the room");
check((await a.call(`/v1/rooms/${room.body.id}/join`, "POST")).body.seats.length === 3, "anyone with the link can join");
await wait(500);
check(cRoom.received.length >= 1, "room updates arrive live");
const afterLeave = await b.call(`/v1/rooms/${room.body.id}/leave`, "POST");
check(afterLeave.body.hostId === c.me.id && afterLeave.body.seats.length === 2, "host leaving passes host to the next seat");

for (const u of [a, b, c]) await u.client.removeAllChannels();
console.log(failures === 0 ? "\nALL PASSED" : `\n${failures} FAILED`);
process.exit(failures ? 1 : 0);
