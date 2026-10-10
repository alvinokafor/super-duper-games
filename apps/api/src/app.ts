import type { ApiError, ApiErrorCode } from "@bankroll/contracts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { env } from "./env";
import { ApiHttpError } from "./lib/http";
import { type AuthVariables, requireAuth } from "./middleware/auth";
import { friendRoutes } from "./routes/friends";
import { groupRoutes } from "./routes/groups";
import { matchRoutes } from "./routes/matches";
import { meRoutes, publicMeRoutes } from "./routes/me";
import { roomRoutes } from "./routes/rooms";

const statusToCode: Record<number, ApiErrorCode> = {
  400: "invalid_request",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
};

export const app = new Hono<{ Variables: AuthVariables }>()
  .use(logger())
  .use(
    "/v1/*",
    cors({
      origin: env.WEB_ORIGIN,
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    }),
  )
  .get("/health", (c) => c.json({ ok: true }))
  .route("/v1/public", publicMeRoutes)
  .use("/v1/*", async (c, next) => (c.req.path.startsWith("/v1/public/") ? next() : requireAuth(c, next)))
  .route("/v1", meRoutes)
  .route("/v1", friendRoutes)
  .route("/v1", groupRoutes)
  .route("/v1", roomRoutes)
  .route("/v1", matchRoutes);

app.onError((err, c) => {
  const status = err instanceof HTTPException ? err.status : 500;
  const code = err instanceof ApiHttpError ? err.code : (statusToCode[status] ?? "internal");
  const body: ApiError = {
    error: {
      code,
      message: status === 500 ? "Something went wrong" : err.message,
    },
  };
  if (status === 500) console.error(err);
  return c.json(body, status);
});

export type AppType = typeof app;
