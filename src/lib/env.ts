const publicSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicSupabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const hasSupabasePublicEnv = Boolean(
  publicSupabaseUrl && publicSupabaseAnonKey,
);

export { publicSupabaseAnonKey, publicSupabaseUrl };
