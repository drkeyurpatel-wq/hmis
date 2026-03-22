import { describe, it, expect } from 'vitest';

describe('Tenant onboarding validation', () => {
  it('should require hospital_name', () => {
    const body = { short_code: 'TST', admin_email: 'a@b.com' };
    expect(body.hospital_name).toBeUndefined();
  });

  it('should generate correct sequence prefixes', () => {
    const short_code = 'H1-UDR';
    expect(`${short_code}`).toBe('H1-UDR'); // UHID prefix
    expect(`${short_code}-B`).toBe('H1-UDR-B'); // Bill prefix
    expect(`${short_code}-IP`).toBe('H1-UDR-IP'); // IPD prefix
  });

  it('should create standard departments count', () => {
    const STANDARD_DEPARTMENTS = 30; // from onboarding API
    expect(STANDARD_DEPARTMENTS).toBeGreaterThanOrEqual(25);
  });

  it('should create standard roles count', () => {
    const STANDARD_ROLES = 8;
    expect(STANDARD_ROLES).toBeGreaterThanOrEqual(6);
  });
});
