// tests/notifications.test.ts
import { describe, it, expect } from 'vitest';
import { validatePhone } from '@/lib/notifications/notification-status';

describe('Phone validation (Indian numbers)', () => {
  it('accepts 10-digit number starting with 6-9', () => {
    const result = validatePhone('9876543210');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('919876543210');
  });

  it('accepts 12-digit with 91 prefix', () => {
    const result = validatePhone('919876543210');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('919876543210');
  });

  it('strips spaces and dashes', () => {
    const result = validatePhone('+91 98765-43210');
    expect(result.valid).toBe(true);
    expect(result.formatted).toBe('919876543210');
  });

  it('rejects number starting with 0-5', () => {
    const result = validatePhone('1234567890');
    expect(result.valid).toBe(false);
  });

  it('rejects short numbers', () => {
    const result = validatePhone('98765');
    expect(result.valid).toBe(false);
  });

  it('rejects empty input', () => {
    const result = validatePhone('');
    expect(result.valid).toBe(false);
  });
});
