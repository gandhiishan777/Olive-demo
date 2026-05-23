import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  OLIVE_AGENT_TOKEN: z.string().min(16, "OLIVE_AGENT_TOKEN must be at least 16 chars").optional(),

  SUPABASE_DB_URL: z.string().url().optional(),

  RESTAURANT_NAME: z.string().default("Paradise Biryani"),
  RESTAURANT_TIMEZONE: z.string().default("America/Los_Angeles"),
  RESTAURANT_PICKUP_ONLY: z.coerce.boolean().default(true),

  MAX_CALL_SECONDS: z.coerce.number().int().positive().default(480),
  MAX_TOKENS_PER_TURN: z.coerce.number().int().positive().default(500),
  MAX_TOKENS_PER_CALL: z.coerce.number().int().positive().default(20000),
  RATE_LIMIT_CALLS_PER_HOUR: z.coerce.number().int().positive().default(5),
  DAILY_CALL_BUDGET_USD: z.coerce.number().positive().default(25),

  PUBLIC_BASE_URL: z.string().url().optional(),

  ELEVENLABS_API_KEY: z.string().optional(),
  ELEVENLABS_AGENT_ID: z.string().optional(),
  ELEVENLABS_VOICE_ID: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  DEEPGRAM_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("❌ Invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  if (parsed.data.NODE_ENV === "production" && !parsed.data.OLIVE_AGENT_TOKEN) {
    console.error("❌ OLIVE_AGENT_TOKEN required in production");
    process.exit(1);
  }
  if (parsed.data.NODE_ENV !== "test" && !parsed.data.SUPABASE_DB_URL) {
    console.error("❌ SUPABASE_DB_URL required (Supabase → Project Settings → Database → Connection string → Session pooler)");
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
