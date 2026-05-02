// tests/security-headers.test.ts
// Verify next.config.js security headers are correctly configured

import { describe, it, expect } from 'vitest';

// Extract the headers config programmatically
const nextConfig = require('../next.config.js');

describe('Security headers configuration', () => {
  let headers: Array<{ key: string; value: string }>;

  beforeAll(async () => {
    const result = await nextConfig.headers();
    headers = result[0].headers;
  });

  it('has Content-Security-Policy', () => {
    const csp = headers.find(h => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("default-src 'self'");
    expect(csp!.value).toContain("frame-ancestors 'none'");
    expect(csp!.value).toContain('upgrade-insecure-requests');
  });

  it('has X-Frame-Options DENY', () => {
    const xfo = headers.find(h => h.key === 'X-Frame-Options');
    expect(xfo).toBeDefined();
    expect(xfo!.value).toBe('DENY');
  });

  it('has Strict-Transport-Security', () => {
    const hsts = headers.find(h => h.key === 'Strict-Transport-Security');
    expect(hsts).toBeDefined();
    expect(hsts!.value).toContain('max-age=63072000');
    expect(hsts!.value).toContain('includeSubDomains');
    expect(hsts!.value).toContain('preload');
  });

  it('has X-Content-Type-Options nosniff', () => {
    const xcto = headers.find(h => h.key === 'X-Content-Type-Options');
    expect(xcto).toBeDefined();
    expect(xcto!.value).toBe('nosniff');
  });

  it('has Referrer-Policy', () => {
    const rp = headers.find(h => h.key === 'Referrer-Policy');
    expect(rp).toBeDefined();
    expect(rp!.value).toBe('strict-origin-when-cross-origin');
  });

  it('has Permissions-Policy disabling dangerous features', () => {
    const pp = headers.find(h => h.key === 'Permissions-Policy');
    expect(pp).toBeDefined();
    expect(pp!.value).toContain('camera=()');
    expect(pp!.value).toContain('microphone=()');
    expect(pp!.value).toContain('geolocation=()');
    expect(pp!.value).toContain('payment=()');
  });

  it('CSP allows Supabase connections', () => {
    const csp = headers.find(h => h.key === 'Content-Security-Policy');
    expect(csp!.value).toContain('*.supabase.co');
    expect(csp!.value).toContain('wss://*.supabase.co');
  });

  it('CSP allows Sentry', () => {
    const csp = headers.find(h => h.key === 'Content-Security-Policy');
    expect(csp!.value).toContain('*.ingest.sentry.io');
  });

  it('has all 8 security headers', () => {
    expect(headers.length).toBeGreaterThanOrEqual(8);
  });
});
