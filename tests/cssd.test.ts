import { describe, it, expect } from 'vitest';

describe('CSSD sterility expiry', () => {
  const calcExpiry = (sterilizedAt: string, expiryHours: number): { expiresAt: Date; isExpired: boolean; hoursLeft: number } => {
    const sterilized = new Date(sterilizedAt);
    const expiresAt = new Date(sterilized.getTime() + expiryHours * 3600000);
    const now = new Date();
    const hoursLeft = Math.round((expiresAt.getTime() - now.getTime()) / 3600000);
    return { expiresAt, isExpired: expiresAt < now, hoursLeft };
  };

  it('calculates 72h expiry', () => {
    const recent = new Date(Date.now() - 2 * 3600000).toISOString(); // 2 hours ago
    const result = calcExpiry(recent, 72);
    expect(result.isExpired).toBe(false);
    expect(result.hoursLeft).toBeGreaterThan(69);
  });

  it('marks expired sets', () => {
    const old = new Date(Date.now() - 100 * 3600000).toISOString(); // 100 hours ago
    const result = calcExpiry(old, 72);
    expect(result.isExpired).toBe(true);
    expect(result.hoursLeft).toBeLessThan(0);
  });
});

describe('Cycle life percentage', () => {
  const cycleLifePct = (used: number, max: number) => max > 0 ? Math.round((used / max) * 100) : 0;

  it('calculates correctly', () => {
    expect(cycleLifePct(450, 500)).toBe(90);
    expect(cycleLifePct(100, 500)).toBe(20);
    expect(cycleLifePct(0, 500)).toBe(0);
  });

  it('handles zero max', () => {
    expect(cycleLifePct(10, 0)).toBe(0);
  });
});
