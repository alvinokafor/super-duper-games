// drizzle-kit pull also writes its own migration files. Supabase migrations are
// the source of truth, so remove them, and point auth.users at our stub.
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dir = new URL("../src/db/generated/", import.meta.url).pathname;

for (const entry of await readdir(dir)) {
  if (entry === "meta" || entry.endsWith(".sql")) {
    await rm(join(dir, entry), { recursive: true, force: true });
  }
}

const schemaPath = join(dir, "schema.ts");
const schema = await readFile(schemaPath, "utf8");
const authImport = 'import { users } from "../auth-schema"\nexport { users as usersInAuth }\n';
if (schema.includes("foreignColumns: [users.") && !schema.includes(authImport)) {
  await writeFile(schemaPath, authImport + schema);
}
