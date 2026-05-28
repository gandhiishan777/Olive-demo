import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// Load .env from cwd first (when running from backend/), then fall back to the
// repo root (so it works whether you run from backend/ or the project root).
config();
const here = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(here, "../../../.env") });

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  SUPABASE_DB_URL: z.string().url().optional(),

  RESTAURANT_NAME: z.string().default("Paradise Biryani"),
  RESTAURANT_TIMEZONE: z.string().default("America/Los_Angeles"),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment variables:");
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join(".")}: ${issue.message}`);
    }
    process.exit(1);
  }
  if (parsed.data.NODE_ENV !== "test" && !parsed.data.SUPABASE_DB_URL) {
    console.error("SUPABASE_DB_URL required. Get from Supabase → Settings → Database → Connection string → Session pooler.");
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
