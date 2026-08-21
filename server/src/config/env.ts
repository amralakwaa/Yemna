import { z } from "zod";

const optionalUrl = z.string().url().optional().or(z.literal(""));

export const DEVELOPMENT_JWT_ACCESS_SECRET = "yemna-development-access-secret-change-me";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3001),
  YEMNA_DATABASE_URL: optionalUrl,
  YEMNA_REDIS_URL: optionalUrl,
  YEMNA_JWT_ACCESS_SECRET: z.string().min(32).optional(),
  JWT_SECRET: z.string().optional(),
  YEMNA_JWT_ACCESS_TTL: z.string().default("15m"),
  YEMNA_REFRESH_TOKEN_DAYS: z.coerce.number().int().min(1).max(3650).default(3650),
  YEMNA_CORS_ORIGINS: z.string().optional(),
});

export type YemnaEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): YemnaEnv {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) throw new Error(`Invalid Yemna environment: ${parsed.error.message}`);
  const accessSecret = parsed.data.YEMNA_JWT_ACCESS_SECRET ?? parsed.data.JWT_SECRET;
  if (parsed.data.NODE_ENV === "production" && !accessSecret) {
    throw new Error("A JWT access secret is required in production");
  }
  return parsed.data;
}
