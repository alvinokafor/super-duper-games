import { pgSchema, uuid } from "drizzle-orm/pg-core";

// Supabase owns the auth schema. Only the columns our tables reference are listed.
export const users = pgSchema("auth").table("users", {
  id: uuid().primaryKey(),
});
