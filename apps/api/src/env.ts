import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().default(8787),
  WEB_ORIGIN: z.url(),
  SUPABASE_URL: z.url(),
  DATABASE_URL: z.string().min(1),
});

export const env = envSchema.parse(process.env);
