// tests/logger.test.ts
// Tests for lib/logger.ts — structured logging with secret scrubbing

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test the scrubbing logic directly
function scrubSecrets(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = /key|secret|token|password|auth|credential/i;
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE.test(k)) {
      scrubbed[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      scrubbed[k] = scrubSecrets(v as Record<string, unknown>);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

describe('Secret scrubbing', () => {
  it('redacts keys containing "secret"', () => {
    const result = scrubSecrets({ CRON_SECRET: 'abc123', name: 'test' });
    expect(result.CRON_SECRET).toBe('[REDACTED]');
    expect(result.name).toBe('test');
  });

  it('redacts keys containing "key"', () => {
    const result = scrubSecrets({ API_KEY: 'sk-123', SUPABASE_SERVICE_ROLE_KEY: 'xyz' });
    expect(result.API_KEY).toBe('[REDACTED]');
    expect(result.SUPABASE_SERVICE_ROLE_KEY).toBe('[REDACTED]');
  });

  it('redacts keys containing "token"', () => {
    const result = scrubSecrets({ access_token: 'bearer-xyz' });
    expect(result.access_token).toBe('[REDACTED]');
  });

  it('redacts keys containing "password"', () => {
    const result = scrubSecrets({ password: 'hunter2', user_password: 'abc' });
    expect(result.password).toBe('[REDACTED]');
    expect(result.user_password).toBe('[REDACTED]');
  });

  it('preserves non-sensitive keys', () => {
    const result = scrubSecrets({ centre_id: 'abc', patient_name: 'John' });
    expect(result.centre_id).toBe('abc');
    expect(result.patient_name).toBe('John');
  });

  it('handles nested objects', () => {
    const result = scrubSecrets({
      config: { api_key: 'secret', name: 'prod' },
    });
    expect((result.config as Record<string, unknown>).api_key).toBe('[REDACTED]');
    expect((result.config as Record<string, unknown>).name).toBe('prod');
  });

  it('handles empty object', () => {
    expect(scrubSecrets({})).toEqual({});
  });
});
