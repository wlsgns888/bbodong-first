import { afterEach, describe, expect, it, vi } from "vitest";

describe("env", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalPublishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

  afterEach(() => {
    vi.resetModules();

    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalAnonKey;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
      originalPublishableKey;
  });

  it("prefers the publishable default key when it is present", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
      "publishable-key";

    const env = await import("@/lib/env");

    expect(env.publicSupabaseUrl).toBe("https://example.supabase.co");
    expect(env.publicSupabaseAnonKey).toBe("publishable-key");
    expect(env.hasSupabasePublicEnv).toBe(true);
  });

  it("reports missing config when the public URL is absent", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    const env = await import("@/lib/env");

    expect(env.publicSupabaseUrl).toBeUndefined();
    expect(env.publicSupabaseAnonKey).toBe("anon-key");
    expect(env.hasSupabasePublicEnv).toBe(false);
  });
});
