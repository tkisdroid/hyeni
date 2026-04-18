import { createClient } from "@supabase/supabase-js";
import { supabase as mockSupabase, isMockEnabled } from "./supabase.mock.js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const useMock = (!supabaseUrl || !supabaseAnonKey) && isMockEnabled();

if (useMock) {
  console.warn("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Falling back to local mock backend.");
} else if (!supabaseUrl || !supabaseAnonKey) {
  console.error("[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = useMock
  ? mockSupabase
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        detectSessionInUrl: true,
        flowType: "implicit",
      },
    });
