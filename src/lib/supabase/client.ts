import { createClient } from "@supabase/supabase-js";
import {
  hasSupabasePublicEnv,
  publicSupabaseAnonKey,
  publicSupabaseUrl,
} from "@/lib/env";

export const hasSupabaseConfig = hasSupabasePublicEnv;

export const supabase = hasSupabaseConfig
  ? createClient(publicSupabaseUrl!, publicSupabaseAnonKey!)
  : null;
