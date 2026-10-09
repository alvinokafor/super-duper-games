import { updateMeSchema, usernameSchema } from "@bankroll/contracts";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client";
import { profiles } from "../db/generated/schema";
import { conflict, isUniqueViolation, notFound, readJson } from "../lib/http";
import { profileColumns } from "../lib/profiles";
import type { AuthVariables } from "../middleware/auth";

// Used by the sign-up form before an account exists, so it needs no login.
// Usernames are public anyway because friends search by them.
export const publicMeRoutes = new Hono().get("/usernames/:username", async (c) => {
  const parsed = usernameSchema.safeParse(c.req.param("username"));
  if (!parsed.success) return c.json({ available: false });
  const [taken] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, parsed.data));
  return c.json({ available: !taken });
});

export const meRoutes = new Hono<{ Variables: AuthVariables }>()
  .get("/me", async (c) => {
    const [me] = await db.select(profileColumns).from(profiles).where(eq(profiles.id, c.get("userId")));
    if (!me) throw notFound("Profile not found");
    return c.json(me);
  })
  .patch("/me", async (c) => {
    const input = await readJson(c, updateMeSchema);
    try {
      const [me] = await db
        .update(profiles)
        .set({ ...input, updatedAt: new Date().toISOString() })
        .where(eq(profiles.id, c.get("userId")))
        .returning(profileColumns);
      if (!me) throw notFound("Profile not found");
      return c.json(me);
    } catch (err) {
      if (isUniqueViolation(err)) throw conflict("That username is taken");
      throw err;
    }
  });
