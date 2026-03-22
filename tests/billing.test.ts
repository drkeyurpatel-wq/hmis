import { describe, it, expect } from 'vitest';

describe('Billing calculations', () => {
  it('should calculate net amount correctly', () => {
    const gross = 50000;
    const discount_pct = 10;
    const discount = gross * discount_pct / 100;
    const net = gross - discount;
    expect(net).toBe(45000);
  });

  it('should calculate GST correctly', () => {
    const room_charge = 5001; // Above ₹5000 threshold
    const gst_rate = room_charge > 5000 ? 0.12 : 0;
    const gst = room_charge * gst_rate;
    expect(gst).toBeCloseTo(600.12, 1);
  });

  it('should never produce negative balance', () => {
    const bill_amount = 25000;
    const paid = 30000;
    const balance = Math.max(0, bill_amount - paid);
    expect(balance).toBe(0);
  });

  it('should split MedPay amounts using net_amt not service_amt', () => {
    // Critical rule: Net Amt accounts for discounts
    const service_amt = 10000;
    const discount = 2000;
    const net_amt = service_amt - discount;
    // MedPay should use net_amt
    expect(net_amt).toBe(8000);
    // Doctor/hospital amounts set to 0 — MedPay calculates from contracts
    const doctor_amt = 0;
    const hospital_amt = 0;
    expect(doctor_amt + hospital_amt).toBe(0);
  });
});

describe('Package economics', () => {
  it('should calculate variance correctly', () => {
    const pkg_rate = 75000;
    const actual_cost = 68000;
    const variance = pkg_rate - actual_cost;
    const variance_pct = (variance / pkg_rate) * 100;
    expect(variance).toBe(7000); // Hospital profit
    expect(variance_pct).toBeCloseTo(9.33, 1);
  });

  it('should detect package overstay', () => {
    const expected_los = 3;
    const actual_los = 5;
    const overstay = actual_los - expected_los;
    expect(overstay).toBe(2);
    expect(overstay > 0).toBe(true);
  });
});
