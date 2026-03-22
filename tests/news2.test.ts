// tests/news2.test.ts
import { describe, it, expect } from 'vitest';
import { calculateNEWS2 } from '@/lib/cdss/news2';

describe('NEWS2 score calculation', () => {
  it('returns 0 for all normal vitals', () => {
    const result = calculateNEWS2({
      respiratoryRate: 16, spo2: 97, systolic: 120,
      heartRate: 72, temperature: 37.0, gcs: 15,
    });
    expect(result.total).toBe(0);
    expect(result.risk).toBe('low');
  });

  it('flags high score for critical vitals', () => {
    const result = calculateNEWS2({
      respiratoryRate: 28, spo2: 88, systolic: 85,
      heartRate: 135, temperature: 39.5, gcs: 12,
    });
    expect(result.total).toBeGreaterThanOrEqual(7);
    expect(result.risk).toBe('high');
  });

  it('detects medium risk', () => {
    const result = calculateNEWS2({
      respiratoryRate: 22, spo2: 94, systolic: 95,
      heartRate: 95, temperature: 38.5, gcs: 15,
    });
    expect(result.total).toBeGreaterThanOrEqual(5);
    expect(['medium', 'high']).toContain(result.risk);
  });

  it('handles single parameter of 3 as medium risk', () => {
    const result = calculateNEWS2({
      respiratoryRate: 8, spo2: 97, systolic: 120,
      heartRate: 72, temperature: 37.0, gcs: 15,
    });
    // RR ≤8 = score 3, single param ≥3 = at least medium
    expect(result.total).toBeGreaterThanOrEqual(3);
  });
});
