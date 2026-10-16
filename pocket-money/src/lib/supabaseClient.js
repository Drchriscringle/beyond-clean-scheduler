import { createClient } from "@supabase/supabase-js";

// Set these in a .env file (Vite: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
// Find them in Supabase: Project Settings → API
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your project URL + anon key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
