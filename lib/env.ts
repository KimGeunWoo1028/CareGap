import { z } from "zod";

const nonEmpty = z.string().trim().min(1, "값이 비어 있습니다.");

const analysisModeSchema = z.enum(["live", "replay"], {
  error: 'ANALYSIS_MODE는 "live" 또는 "replay"만 허용됩니다.',
});

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: nonEmpty,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: nonEmpty,
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SECRET_KEY: nonEmpty,
  ANALYSIS_MODE: analysisModeSchema,
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
}).superRefine((value, ctx) => {
  if (value.ANALYSIS_MODE === "live") {
    if (!value.OPENAI_API_KEY?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_API_KEY"],
        message: "live 모드에서는 OPENAI_API_KEY가 필요합니다.",
      });
    }
    if (!value.OPENAI_MODEL?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["OPENAI_MODEL"],
        message: "live 모드에서는 OPENAI_MODEL이 필요합니다.",
      });
    }
  }
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

function readPublicRaw(): Record<string, string | undefined> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function readServerRaw(): Record<string, string | undefined> {
  return {
    ...readPublicRaw(),
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ANALYSIS_MODE: process.env.ANALYSIS_MODE,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };
}

export function formatEnvError(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("; ");
}

/** Browser-safe public env. Throws if required values are missing or empty. */
export function getPublicEnv(
  source: Record<string, string | undefined> = readPublicRaw(),
): PublicEnv {
  const result = publicEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`환경 변수 설정 오류(공개): ${formatEnvError(result.error)}`);
  }
  return result.data;
}

/**
 * Server-only env. Never import this into client components.
 * Throws if required values are missing/empty. No silent defaults for ANALYSIS_MODE.
 */
export function getServerEnv(
  source: Record<string, string | undefined> = readServerRaw(),
): ServerEnv {
  const result = serverEnvSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`환경 변수 설정 오류(서버): ${formatEnvError(result.error)}`);
  }
  return result.data;
}

export function isServerEnvConfigured(
  source: Record<string, string | undefined> = readServerRaw(),
): boolean {
  return serverEnvSchema.safeParse(source).success;
}
