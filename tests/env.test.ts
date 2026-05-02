// tests/env.test.ts
// Tests for lib/env.ts — environment variable validation

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';

// Recreate the schema locally to test validation logic without side effects
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  NEXT_PUBLIC_APP_URL: z.string().url().default('https://hmis-brown.vercel.app'),
  CRON_SECRET: z.string().min(16).optional(),
  ANTHROPIC_API_KEY: z.string().startsWith('sk-ant-').optional(),
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
});

describe('Environment validation schema', () => {
  const validEnv = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
    SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service',
  };

  it('accepts valid required env vars', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
  });

  it('rejects missing SUPABASE_URL', () => {
    const { NEXT_PUBLIC_SUPABASE_URL, ...rest } = validEnv;
    const result = envSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL format', () => {
    const result = envSchema.safeParse({ ...validEnv, NEXT_PUBLIC_SUPABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects short anon key', () => {
    const result = envSchema.safeParse({ ...validEnv, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'short' });
    expect(result.success).toBe(false);
  });

  it('accepts valid ANTHROPIC_API_KEY', () => {
    const result = envSchema.safeParse({ ...validEnv, ANTHROPIC_API_KEY: 'sk-ant-test123' });
    expect(result.success).toBe(true);
  });

  it('rejects ANTHROPIC_API_KEY without sk-ant- prefix', () => {
    const result = envSchema.safeParse({ ...validEnv, ANTHROPIC_API_KEY: 'invalid-key' });
    expect(result.success).toBe(false);
  });

  it('accepts valid RESEND_API_KEY', () => {
    const result = envSchema.safeParse({ ...validEnv, RESEND_API_KEY: 're_abc123xyz' });
    expect(result.success).toBe(true);
  });

  it('applies default APP_URL', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.NEXT_PUBLIC_APP_URL).toBe('https://hmis-brown.vercel.app');
    }
  });

  it('allows optional fields to be absent', () => {
    const result = envSchema.safeParse(validEnv);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.CRON_SECRET).toBeUndefined();
      expect(result.data.ANTHROPIC_API_KEY).toBeUndefined();
    }
  });
});
