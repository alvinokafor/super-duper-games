import { randomInt } from "node:crypto";
import { profiles } from "../db/generated/schema";

export const profileColumns = {
  id: profiles.id,
  username: profiles.username,
  displayName: profiles.displayName,
  avatarUrl: profiles.avatarUrl,
};

// Friendship rows store the smaller id first. Lowercase uuid strings sort the
// same way as Postgres compares uuids.
export function friendPair(a: string, b: string): { userLow: string; userHigh: string } {
  return a < b ? { userLow: a, userHigh: b } : { userLow: b, userHigh: a };
}

// No 0/O or 1/I so codes are easy to read out loud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function randomCode(length: number): string {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}
