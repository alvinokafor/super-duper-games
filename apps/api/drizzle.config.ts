import { defineConfig } from "drizzle-kit";

// Supabase migrations are the source of truth. This only pulls types from the database.
export default defineConfig({
  dialect: "postgresql",
  out: "./src/db/generated",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  schemaFilter: ["public"],
});
