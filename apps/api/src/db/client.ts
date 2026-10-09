import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";

// Transactions and row locks need a session connection, not the transaction pooler.
export const sql = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(sql);
