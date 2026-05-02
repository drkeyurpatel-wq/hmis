// lib/env.ts
// Validates required environment variables at build/boot time.
// Throws clear error messages if critical vars are missing.
// Non-critical vars log warnings but don't block startup.

import { z } from 'zod';

const envSchema = z.object({
  // Required — app won't function without these
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20, 'NEXT_PUBLIC_SUPABASE_ANON_KEY too short'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, 'SUPABASE_SERVICE_ROLE_KEY too short'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('https://hmis-brown.vercel.app'),

  // Required for production
  CRON_SECRET: z.string().min(16).optional(),
  HMIS_API_SECRET: z.string().min(16).optional(),

  // Optional integrations
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  WHATSAPP_API_URL: z.string().url().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  MEDPAY_SUPABASE_URL: z.string().url().optional(),
  MEDPAY_SERVICE_ROLE_KEY: z.string().optional(),
  VPMS_SUPABASE_URL: z.string().url().optional(),
  VPMS_SUPABASE_SERVICE_KEY: z.string().optional(),
  ABDM_CLIENT_ID: z.string().optional(),
  ABDM_CLIENT_SECRET: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let _validated: Env | null = null;

export function validateEnv(): Env {
  if (_validated) return _validated;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues
      .map(i => `  • ${i.path.join('.')}: ${i.message}`)
      .join('\n');

    // In build context, warn but don't crash (CI may not have all vars)
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Environment validation failed:\n${missing}`);
    } else {
      console.warn(`[env] Validation warnings:\n${missing}`);
      // Return partial parse for dev
      _validated = result.data as unknown as Env;
      return _validated!;
    }
  }

  _validated = result.data;
  return _validated;
}
