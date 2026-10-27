import { beforeEach, describe, expect, it, vi } from "vitest";

const createClient = vi.fn(() => ({ auth: {} }));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (
    url: string,
    key: string,
    options?: Record<string, unknown>,
  ) => createClient(url, key, options),
}));

describe("browser auth client policy (T01)", () => {
  beforeEach(() => {
    vi.resetModules();
    createClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publishable-test-key";
  });

  it("uses publishable key with persistSession disabled", async () => {
    const { createBrowserAuthClient } = await import("./browser");
    createBrowserAuthClient();

    expect(createClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "publishable-test-key",
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      }),
    );
  });
});
