import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

// Used only for login and listening on live channels. All data goes through the API.
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
