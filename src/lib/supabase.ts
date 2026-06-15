import { createClient } from "@supabase/supabase-js";

const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase credentials are not fully configured inside environment variables yet. " +
    "Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment/Secrets panel."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
