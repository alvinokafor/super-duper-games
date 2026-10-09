import { USER_EVENT, type UserEvent, userChannelName } from "@bankroll/contracts";
import { sql } from "drizzle-orm";
import type { Db, Tx } from "../db/client";

// realtime.send() writes to realtime.messages, so inside a transaction the
// message only goes out if the transaction commits.
export async function broadcast(db: Db | Tx, topic: string, event: string, payload: object = {}) {
  await db.execute(sql`select realtime.send(${JSON.stringify(payload)}::jsonb, ${event}, ${topic}, true)`);
}

export async function notifyUsers(db: Db | Tx, userIds: readonly string[], type: UserEvent["type"]) {
  const payload: UserEvent = { type };
  for (const userId of new Set(userIds)) {
    await broadcast(db, userChannelName(userId), USER_EVENT, payload);
  }
}
