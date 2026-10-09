import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { env } from "../env";

const issuer = `${env.SUPABASE_URL}/auth/v1`;
const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

export type AuthVariables = {
  userId: string;
};

export const requireAuth = createMiddleware<{ Variables: AuthVariables }>(async (c, next) => {
  const header = c.req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new HTTPException(401, { message: "unauthenticated" });

  try {
    const { payload } = await jwtVerify(token, jwks, { issuer, audience: "authenticated" });
    if (!payload.sub) throw new Error("missing sub");
    c.set("userId", payload.sub);
  } catch {
    throw new HTTPException(401, { message: "unauthenticated" });
  }

  await next();
});
