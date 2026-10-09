export type InviteTarget = { kind: "room"; roomId: string } | { kind: "group"; code: string };

const ROOM_PATH = /\/rooms\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const GROUP_PATH = /\/join\/([A-Za-z0-9]{8})\b/;

// Accepts a pasted room link, a group invite link, or a bare 8-character invite code.
export function parseInvite(raw: string): InviteTarget | null {
  const text = raw.trim();
  const room = ROOM_PATH.exec(text);
  if (room?.[1]) return { kind: "room", roomId: room[1].toLowerCase() };
  const group = GROUP_PATH.exec(text);
  if (group?.[1]) return { kind: "group", code: group[1].toUpperCase() };
  if (/^[A-Za-z0-9]{8}$/.test(text)) return { kind: "group", code: text.toUpperCase() };
  return null;
}
