import { supabase } from "@/lib/supabase";

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
