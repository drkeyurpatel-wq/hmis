// tests/validation.test.ts
// Tests for lib/validation/parse-body.ts and billing schemas

import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

// We test the parse logic directly without Next.js Request
// by recreating the core validation logic

function parseSync<T>(schema: z.ZodSchema<T>, data: unknown) {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      data: null,
      issues: result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    };
  }
  return { data: result.data, issues: null };
}

// Import billing schemas
import {
  encounterCreateSchema,
  lineItemCreateSchema,
  paymentCreateSchema,
  creditNoteCreateSchema,
  preAuthCreateSchema,
  preAuthApproveSchema,
  lineItemCancelSchema,
  serviceCreateSchema,
} from '@/lib/validation/billing';

describe('encounterCreateSchema', () => {
  const validEncounter = {
    centre_id: '550e8400-e29b-41d4-a716-446655440000',
    patient_id: '550e8400-e29b-41d4-a716-446655440001',
    encounter_type: 'OPD',
  };

  it('accepts valid OPD encounter', () => {
    const result = parseSync(encounterCreateSchema, validEncounter);
    expect(result.issues).toBeNull();
    expect(result.data?.encounter_type).toBe('OPD');
    expect(result.data?.primary_payor_type).toBe('SELF_PAY'); // default
  });

  it('accepts all encounter types', () => {
    for (const type of ['OPD', 'IPD', 'ER', 'DAYCARE']) {
      const result = parseSync(encounterCreateSchema, { ...validEncounter, encounter_type: type });
      expect(result.issues).toBeNull();
    }
  });

  it('rejects invalid encounter type', () => {
    const result = parseSync(encounterCreateSchema, { ...validEncounter, encounter_type: 'INVALID' });
    expect(result.issues).not.toBeNull();
    expect(result.issues![0].field).toBe('encounter_type');
  });

  it('rejects missing centre_id', () => {
    const { centre_id, ...rest } = validEncounter;
    const result = parseSync(encounterCreateSchema, rest);
    expect(result.issues).not.toBeNull();
  });

  it('rejects non-UUID centre_id', () => {
    const result = parseSync(encounterCreateSchema, { ...validEncounter, centre_id: 'not-a-uuid' });
    expect(result.issues).not.toBeNull();
  });

  it('rejects missing patient_id', () => {
    const { patient_id, ...rest } = validEncounter;
    const result = parseSync(encounterCreateSchema, rest);
    expect(result.issues).not.toBeNull();
  });

  it('accepts optional fields when null', () => {
    const result = parseSync(encounterCreateSchema, {
      ...validEncounter,
      insurance_company_id: null,
      tpa_id: null,
      notes: null,
    });
    expect(result.issues).toBeNull();
  });

  it('rejects notes exceeding 2000 chars', () => {
    const result = parseSync(encounterCreateSchema, {
      ...validEncounter,
      notes: 'x'.repeat(2001),
    });
    expect(result.issues).not.toBeNull();
  });
});

describe('paymentCreateSchema', () => {
  it('accepts valid cash payment', () => {
    const result = parseSync(paymentCreateSchema, { amount: 500 });
    expect(result.issues).toBeNull();
    expect(result.data?.payment_mode).toBe('CASH'); // default
    expect(result.data?.payment_type).toBe('COLLECTION'); // default
  });

  it('rejects zero amount', () => {
    const result = parseSync(paymentCreateSchema, { amount: 0 });
    expect(result.issues).not.toBeNull();
  });

  it('rejects negative amount', () => {
    const result = parseSync(paymentCreateSchema, { amount: -100 });
    expect(result.issues).not.toBeNull();
  });

  it('accepts all payment modes', () => {
    for (const mode of ['CASH', 'CARD', 'UPI', 'NEFT', 'CHEQUE', 'DD', 'ONLINE']) {
      const result = parseSync(paymentCreateSchema, { amount: 100, payment_mode: mode });
      expect(result.issues).toBeNull();
    }
  });

  it('validates card_last_four format', () => {
    const valid = parseSync(paymentCreateSchema, { amount: 100, card_last_four: '1234' });
    expect(valid.issues).toBeNull();

    const invalid = parseSync(paymentCreateSchema, { amount: 100, card_last_four: '12' });
    expect(invalid.issues).not.toBeNull();

    const nonDigit = parseSync(paymentCreateSchema, { amount: 100, card_last_four: 'abcd' });
    expect(nonDigit.issues).not.toBeNull();
  });
});

describe('creditNoteCreateSchema', () => {
  const validCreditNote = {
    original_invoice_id: '550e8400-e29b-41d4-a716-446655440000',
    amount: 1000,
    reason: 'Duplicate billing',
  };

  it('accepts valid credit note', () => {
    const result = parseSync(creditNoteCreateSchema, validCreditNote);
    expect(result.issues).toBeNull();
  });

  it('rejects missing reason', () => {
    const { reason, ...rest } = validCreditNote;
    const result = parseSync(creditNoteCreateSchema, rest);
    expect(result.issues).not.toBeNull();
  });

  it('rejects empty reason', () => {
    const result = parseSync(creditNoteCreateSchema, { ...validCreditNote, reason: '' });
    expect(result.issues).not.toBeNull();
  });

  it('rejects zero amount', () => {
    const result = parseSync(creditNoteCreateSchema, { ...validCreditNote, amount: 0 });
    expect(result.issues).not.toBeNull();
  });
});

describe('preAuthApproveSchema', () => {
  it('accepts APPROVED with amount', () => {
    const result = parseSync(preAuthApproveSchema, { status: 'APPROVED', approved_amount: 50000 });
    expect(result.issues).toBeNull();
  });

  it('accepts REJECTED without amount', () => {
    const result = parseSync(preAuthApproveSchema, { status: 'REJECTED' });
    expect(result.issues).toBeNull();
  });

  it('rejects invalid status', () => {
    const result = parseSync(preAuthApproveSchema, { status: 'PENDING' });
    expect(result.issues).not.toBeNull();
  });
});

describe('lineItemCancelSchema', () => {
  it('accepts cancellation_reason', () => {
    const result = parseSync(lineItemCancelSchema, { cancellation_reason: 'Wrong service' });
    expect(result.issues).toBeNull();
  });

  it('accepts reason field', () => {
    const result = parseSync(lineItemCancelSchema, { reason: 'Wrong service' });
    expect(result.issues).toBeNull();
  });

  it('rejects empty body', () => {
    const result = parseSync(lineItemCancelSchema, {});
    expect(result.issues).not.toBeNull();
  });
});

describe('serviceCreateSchema', () => {
  it('accepts valid service', () => {
    const result = parseSync(serviceCreateSchema, {
      service_code: 'CONS-001',
      service_name: 'General Consultation',
      service_category: 'OPD',
      base_rate: 500,
      centre_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.issues).toBeNull();
    expect(result.data?.is_active).toBe(true); // default
  });

  it('rejects negative base_rate', () => {
    const result = parseSync(serviceCreateSchema, {
      service_code: 'X', service_name: 'X', service_category: 'X',
      base_rate: -100,
      centre_id: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(result.issues).not.toBeNull();
  });
});
