// tests/rate-limit.test.ts
// Tests for lib/rate-limit.ts — in-memory sliding window rate limiter

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  const config = { maxRequests: 3, windowMs: 1000 };

  it('allows requests under the limit', () => {
    const key = `test-under-${Date.now()}`;
    const r1 = checkRateLimit(key, config);
    const r2 = checkRateLimit(key, config);
    const r3 = checkRateLimit(key, config);

    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(r3.success).toBe(true);
    expect(r1.remaining).toBe(2);
    expect(r2.remaining).toBe(1);
    expect(r3.remaining).toBe(0);
  });

  it('blocks requests over the limit', () => {
    const key = `test-over-${Date.now()}`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const r4 = checkRateLimit(key, config);

    expect(r4.success).toBe(false);
    expect(r4.remaining).toBe(0);
    expect(r4.resetMs).toBeGreaterThan(0);
  });

  it('isolates different keys', () => {
    const key1 = `test-key1-${Date.now()}`;
    const key2 = `test-key2-${Date.now()}`;

    checkRateLimit(key1, config);
    checkRateLimit(key1, config);
    checkRateLimit(key1, config);

    const r = checkRateLimit(key2, config);
    expect(r.success).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('resets after window expires', async () => {
    const shortConfig = { maxRequests: 2, windowMs: 100 };
    const key = `test-reset-${Date.now()}`;

    checkRateLimit(key, shortConfig);
    checkRateLimit(key, shortConfig);
    const blocked = checkRateLimit(key, shortConfig);
    expect(blocked.success).toBe(false);

    // Wait for window to expire
    await new Promise(resolve => setTimeout(resolve, 150));

    const allowed = checkRateLimit(key, shortConfig);
    expect(allowed.success).toBe(true);
  });

  it('has correct tier presets', () => {
    expect(RATE_LIMIT_TIERS.auth.maxRequests).toBe(5);
    expect(RATE_LIMIT_TIERS.auth.windowMs).toBe(60_000);
    expect(RATE_LIMIT_TIERS.api.maxRequests).toBe(100);
    expect(RATE_LIMIT_TIERS.webhook.maxRequests).toBe(500);
  });

  it('returns positive resetMs when blocked', () => {
    const key = `test-reset-ms-${Date.now()}`;
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    checkRateLimit(key, config);
    const blocked = checkRateLimit(key, config);

    expect(blocked.resetMs).toBeGreaterThan(0);
    expect(blocked.resetMs).toBeLessThanOrEqual(config.windowMs);
  });
});
