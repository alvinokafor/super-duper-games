import { serve } from "@hono/node-server";
import { app } from "./app";
import { sql } from "./db/client";
import { env } from "./env";

const server = serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

const shutdown = () => {
  server.close(async () => {
    await sql.end({ timeout: 5 });
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
