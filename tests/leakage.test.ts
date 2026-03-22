import { describe, it, expect } from 'vitest';

describe('Revenue leakage severity sorting', () => {
  const SEV_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

  const sortLeaks = (leaks: { severity: string; amount: number; days_old: number }[]) => {
    return [...leaks].sort((a, b) =>
      (SEV_ORDER[a.severity] - SEV_ORDER[b.severity]) || (b.amount - a.amount) || (b.days_old - a.days_old)
    );
  };

  it('sorts critical before high', () => {
    const sorted = sortLeaks([
      { severity: 'high', amount: 50000, days_old: 5 },
      { severity: 'critical', amount: 0, days_old: 1 },
    ]);
    expect(sorted[0].severity).toBe('critical');
  });

  it('sorts by amount within same severity', () => {
    const sorted = sortLeaks([
      { severity: 'high', amount: 10000, days_old: 3 },
      { severity: 'high', amount: 50000, days_old: 1 },
    ]);
    expect(sorted[0].amount).toBe(50000);
  });

  it('sorts by age as tiebreaker', () => {
    const sorted = sortLeaks([
      { severity: 'high', amount: 10000, days_old: 3 },
      { severity: 'high', amount: 10000, days_old: 10 },
    ]);
    expect(sorted[0].days_old).toBe(10);
  });
});
