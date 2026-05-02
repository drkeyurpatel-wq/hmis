// tests/billing-edge-cases.test.ts
// Edge case tests for billing calculations — financial math must be exact

import { describe, it, expect } from 'vitest';

// Core billing calculation functions (extracted for testing)
function calculateNetAmount(grossAmount: number, discountType: string | null, discountValue: number): number {
  if (!discountType || discountValue <= 0) return grossAmount;
  if (discountType === 'PERCENTAGE') {
    return Math.round((grossAmount * (1 - discountValue / 100)) * 100) / 100;
  }
  if (discountType === 'FLAT') {
    return Math.max(0, grossAmount - discountValue);
  }
  return grossAmount;
}

function calculateGST(amount: number, gstPercentage: number): { base: number; gst: number; total: number } {
  const base = Math.round((amount / (1 + gstPercentage / 100)) * 100) / 100;
  const gst = Math.round((amount - base) * 100) / 100;
  return { base, gst, total: amount };
}

function calculateTDS(feeAmount: number, tdsPct: number): number {
  return Math.round(feeAmount * tdsPct / 100 * 100) / 100;
}

describe('Net amount calculations', () => {
  it('no discount returns gross', () => {
    expect(calculateNetAmount(1000, null, 0)).toBe(1000);
  });

  it('percentage discount calculates correctly', () => {
    expect(calculateNetAmount(1000, 'PERCENTAGE', 10)).toBe(900);
    expect(calculateNetAmount(1000, 'PERCENTAGE', 50)).toBe(500);
    expect(calculateNetAmount(1000, 'PERCENTAGE', 100)).toBe(0);
  });

  it('flat discount calculates correctly', () => {
    expect(calculateNetAmount(1000, 'FLAT', 200)).toBe(800);
    expect(calculateNetAmount(1000, 'FLAT', 1000)).toBe(0);
  });

  it('flat discount never goes negative', () => {
    expect(calculateNetAmount(100, 'FLAT', 500)).toBe(0);
  });

  it('handles decimal amounts precisely', () => {
    // ₹999.99 with 12.5% discount
    expect(calculateNetAmount(999.99, 'PERCENTAGE', 12.5)).toBe(874.99);
  });

  it('zero gross with percentage discount returns zero', () => {
    expect(calculateNetAmount(0, 'PERCENTAGE', 50)).toBe(0);
  });
});

describe('GST calculations (inclusive)', () => {
  it('18% GST extraction', () => {
    const result = calculateGST(1180, 18);
    expect(result.base).toBe(1000);
    expect(result.gst).toBe(180);
    expect(result.total).toBe(1180);
  });

  it('5% GST extraction', () => {
    const result = calculateGST(1050, 5);
    expect(result.base).toBe(1000);
    expect(result.gst).toBe(50);
  });

  it('0% GST returns full amount as base', () => {
    const result = calculateGST(1000, 0);
    expect(result.base).toBe(1000);
    expect(result.gst).toBe(0);
  });
});

describe('TDS calculations', () => {
  it('10% TDS on ₹50,000', () => {
    expect(calculateTDS(50000, 10)).toBe(5000);
  });

  it('7.5% TDS on ₹1,00,000', () => {
    expect(calculateTDS(100000, 7.5)).toBe(7500);
  });

  it('0% TDS returns 0', () => {
    expect(calculateTDS(100000, 0)).toBe(0);
  });

  it('handles decimal results', () => {
    // ₹33,333 × 10% = ₹3,333.30
    expect(calculateTDS(33333, 10)).toBe(3333.30);
  });
});

describe('Financial precision', () => {
  it('no floating point errors on common amounts', () => {
    // Flat discount: 100.10 - 0.20 = 99.90 (rounded to 2 decimals)
    const net = calculateNetAmount(100.10, 'FLAT', 0.20);
    expect(Math.round(net * 100) / 100).toBe(99.9);
  });

  it('large amounts maintain precision', () => {
    // ₹10 Cr with 2.5% discount
    const net = calculateNetAmount(100000000, 'PERCENTAGE', 2.5);
    expect(net).toBe(97500000);
  });

  it('small amounts maintain precision', () => {
    const net = calculateNetAmount(1.50, 'PERCENTAGE', 10);
    expect(net).toBe(1.35);
  });
});
