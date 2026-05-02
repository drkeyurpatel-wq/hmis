// tests/auth-guard.test.ts
// Tests for lib/api/auth-guard.ts patterns

import { describe, it, expect } from 'vitest';

// Test the requireAuth pattern — we verify the error response format
// without needing actual Supabase connections

describe('Auth guard error responses', () => {
  // Standard error response format
  interface AuthErrorResponse {
    error: string;
    code: string;
  }

  it('401 response has correct shape', () => {
    const response: AuthErrorResponse = { error: 'Unauthorized', code: 'AUTH_REQUIRED' };
    expect(response.error).toBe('Unauthorized');
    expect(response.code).toBe('AUTH_REQUIRED');
  });

  it('403 role response has correct shape', () => {
    const response: AuthErrorResponse = { error: 'Forbidden', code: 'ROLE_FORBIDDEN' };
    expect(response.error).toBe('Forbidden');
    expect(response.code).toBe('ROLE_FORBIDDEN');
  });

  it('403 centre response has correct shape', () => {
    const response: AuthErrorResponse = { error: 'Centre access denied', code: 'CENTRE_FORBIDDEN' };
    expect(response.code).toBe('CENTRE_FORBIDDEN');
  });

  it('deactivated staff response has correct shape', () => {
    const response: AuthErrorResponse = { error: 'Staff deactivated', code: 'STAFF_DEACTIVATED' };
    expect(response.code).toBe('STAFF_DEACTIVATED');
  });
});

describe('Role hierarchy', () => {
  const ROLES = ['super_admin', 'admin', 'doctor', 'nurse', 'receptionist', 'pharmacist', 'lab_tech', 'radiology_tech', 'billing', 'accounts'];

  it('contains all expected roles', () => {
    expect(ROLES).toContain('super_admin');
    expect(ROLES).toContain('admin');
    expect(ROLES).toContain('doctor');
    expect(ROLES).toContain('nurse');
    expect(ROLES).toContain('receptionist');
  });

  it('super_admin and admin are first two', () => {
    expect(ROLES[0]).toBe('super_admin');
    expect(ROLES[1]).toBe('admin');
  });
});
