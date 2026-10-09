import { z } from "zod";

export const env = z
  .object({
    VITE_API_URL: z.url(),
    VITE_SUPABASE_URL: z.url(),
    VITE_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  })
  .parse(import.meta.env);
