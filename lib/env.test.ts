import { describe, expect, it } from "vitest";
import { getPublicEnv, getServerEnv, isServerEnvConfigured } from "./env";

const validPublic = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "publishable-key",
};

const validReplay = {
  ...validPublic,
  SUPABASE_SECRET_KEY: "secret-key",
  ANALYSIS_MODE: "replay",
};

describe("getPublicEnv", () => {
  it("rejects empty public values", () => {
    expect(() =>
      getPublicEnv({
        NEXT_PUBLIC_SUPABASE_URL: " ",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "key",
      }),
    ).toThrow(/환경 변수 설정 오류/);
  });

  it("accepts filled public values", () => {
    expect(getPublicEnv(validPublic)).toEqual(validPublic);
  });
});

describe("getServerEnv", () => {
  it("rejects missing ANALYSIS_MODE without defaulting", () => {
    expect(() =>
      getServerEnv({
        ...validPublic,
        SUPABASE_SECRET_KEY: "secret",
        ANALYSIS_MODE: undefined,
      }),
    ).toThrow(/ANALYSIS_MODE/);
  });

  it("rejects invalid ANALYSIS_MODE", () => {
    expect(() =>
      getServerEnv({
        ...validPublic,
        SUPABASE_SECRET_KEY: "secret",
        ANALYSIS_MODE: "auto",
      }),
    ).toThrow(/ANALYSIS_MODE/);
  });

  it("allows empty OPENAI_API_KEY in replay mode", () => {
    const env = getServerEnv({
      ...validReplay,
      OPENAI_API_KEY: "",
    });
    expect(env.ANALYSIS_MODE).toBe("replay");
  });

  it("requires OpenAI settings in live mode", () => {
    expect(() =>
      getServerEnv({
        ...validPublic,
        SUPABASE_SECRET_KEY: "secret",
        ANALYSIS_MODE: "live",
      }),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("accepts complete live mode settings", () => {
    const env = getServerEnv({
      ...validPublic,
      SUPABASE_SECRET_KEY: "secret",
      ANALYSIS_MODE: "live",
      OPENAI_API_KEY: "sk-test",
      OPENAI_MODEL: "gpt-5.4-mini-2026-03-17",
    });
    expect(env.ANALYSIS_MODE).toBe("live");
  });
});

describe("isServerEnvConfigured", () => {
  it("reports whether server env is ready", () => {
    expect(isServerEnvConfigured(validReplay)).toBe(true);
    expect(isServerEnvConfigured({})).toBe(false);
  });
});
