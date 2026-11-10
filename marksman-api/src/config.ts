import "dotenv/config";
import { z } from "zod";

export const allowlistSchema = z
  .string()
  .default("")
  .transform((value) =>
    value.trim() === "" ? [] : value.split(",").map((id) => id.trim()),
  )
  .pipe(z.array(z.coerce.number<string>().pipe(z.int().positive())));

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z.url(),
  FRONTEND_URL: z.url(),
  OSU_CLIENT_ID: z.string().regex(/^[1-9]\d*$/),
  OSU_CLIENT_SECRET: z.string().min(1),
  OSU_REDIRECT_URI: z.url(),
  SESSION_SECRET: z.string().min(32),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(1).default(0),
  ALLOWED_OSU_USER_IDS: allowlistSchema,
});

export const config = envSchema.parse(process.env);
