import type { ApiError, ApiErrorCode } from "@bankroll/contracts";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { env } from "./env";
import { type AuthVariables, requireAuth } from "./middleware/auth";

const statusToCode: Record<number, ApiErrorCode> = {
  400: "invalid_request",
  401: "unauthenticated",
  403: "forbidden",
  404: "not_found",
  409: "version_conflict",
};

export const app = new Hono<{ Variables: AuthVariables }>()
  .use(logger())
  .use("/v1/*", cors({ origin: env.WEB_ORIGIN, allowHeaders: ["Authorization", "Content-Type"] }))
  .get("/health", (c) => c.json({ ok: true }))
  .use("/v1/*", requireAuth)
  .get("/v1/me", (c) => c.json({ userId: c.get("userId") }));

app.onError((err, c) => {
  const status = err instanceof HTTPException ? err.status : 500;
  const body: ApiError = {
    error: {
      code: statusToCode[status] ?? "internal",
      message: status === 500 ? "Something went wrong" : err.message,
    },
  };
  if (status === 500) console.error(err);
  return c.json(body, status);
});

export type AppType = typeof app;
