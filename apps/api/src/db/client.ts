import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../env";
import * as relations from "./generated/relations";
import * as schema from "./generated/schema";

// Transactions and row locks need a session connection, not the transaction pooler.
export const sql = postgres(env.DATABASE_URL, { max: 10 });

export const db = drizzle(sql, { schema: { ...schema, ...relations } });

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
