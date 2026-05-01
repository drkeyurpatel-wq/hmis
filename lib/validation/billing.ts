// lib/validation/billing.ts
// Zod schemas for billing API input validation.
// Each schema matches the body shape consumed by the corresponding API route.

import { z } from 'zod';

// Reusable field validators
const uuid = z.string().uuid();
const optionalUuid = z.string().uuid().optional().nullable();
const centreId = z.string().uuid({ message: 'Valid centre_id (UUID) required' });

// ─── POST /api/billing/encounters ───
export const encounterCreateSchema = z.object({
  centre_id: centreId,
  patient_id: uuid,
  encounter_type: z.enum(['OPD', 'IPD', 'ER', 'DAYCARE'], {
    message: 'encounter_type must be OPD, IPD, ER, or DAYCARE',
  }),
  primary_payor_type: z.enum(['SELF_PAY', 'INSURANCE', 'CORPORATE', 'GOVT', 'PMJAY']).default('SELF_PAY'),
  primary_payor_id: optionalUuid,
  insurance_company_id: optionalUuid,
  tpa_id: optionalUuid,
  insurance_policy_number: z.string().max(100).optional().nullable(),
  consulting_doctor_id: optionalUuid,
  admitting_doctor_id: optionalUuid,
  bed_id: optionalUuid,
  package_id: optionalUuid,
  notes: z.string().max(2000).optional().nullable(),
});

export type EncounterCreate = z.infer<typeof encounterCreateSchema>;

// ─── POST /api/billing/encounters/[id]/line-items ───
export const lineItemCreateSchema = z.object({
  service_master_id: uuid,
  quantity: z.number().int().min(1).max(9999).default(1),
  unit_rate: z.number().min(0).optional(),
  discount_type: z.enum(['PERCENTAGE', 'FLAT']).optional().nullable(),
  discount_value: z.number().min(0).max(100000).default(0),
  service_doctor_id: optionalUuid,
  referring_doctor_id: optionalUuid,
  source_type: z.enum(['MANUAL', 'PHARMACY', 'LAB', 'RADIOLOGY', 'OT', 'BED', 'PACKAGE', 'AUTO']).default('MANUAL'),
  source_id: optionalUuid,
  service_date: z.string().datetime().optional(),
});

export type LineItemCreate = z.infer<typeof lineItemCreateSchema>;

// ─── POST /api/billing/encounters/[id]/payments ───
export const paymentCreateSchema = z.object({
  amount: z.number().positive({ message: 'Amount must be > 0' }),
  payment_mode: z.enum(['CASH', 'CARD', 'UPI', 'NEFT', 'CHEQUE', 'DD', 'ONLINE']).default('CASH'),
  payment_type: z.enum(['COLLECTION', 'ADVANCE', 'DEPOSIT', 'REFUND']).default('COLLECTION'),
  invoice_id: optionalUuid,
  payment_reference: z.string().max(100).optional().nullable(),
  card_last_four: z.string().length(4).regex(/^\d{4}$/).optional().nullable(),
  upi_id: z.string().max(100).optional().nullable(),
  bank_name: z.string().max(100).optional().nullable(),
  is_advance: z.boolean().default(false),
});

export type PaymentCreate = z.infer<typeof paymentCreateSchema>;

// ─── POST /api/billing/encounters/[id]/invoices ───
export const invoiceCreateSchema = z.object({
  line_item_ids: z.array(uuid).optional(),
  invoice_type: z.enum(['OPD', 'IPD', 'ER', 'DAYCARE', 'PHARMACY', 'LAB', 'RADIOLOGY']).default('OPD'),
});

export type InvoiceCreate = z.infer<typeof invoiceCreateSchema>;

// ─── POST /api/billing/credit-notes ───
export const creditNoteCreateSchema = z.object({
  original_invoice_id: uuid,
  amount: z.number().positive({ message: 'Amount must be > 0' }),
  reason: z.string().min(1, 'Reason is required').max(500),
  line_items: z.array(z.object({
    line_item_id: uuid,
    amount: z.number().positive(),
    reason: z.string().optional(),
  })).optional(),
  refund_mode: z.enum(['CASH', 'CARD', 'UPI', 'NEFT', 'ADJUST']).optional().nullable(),
});

export type CreditNoteCreate = z.infer<typeof creditNoteCreateSchema>;

// ─── POST /api/billing/pre-auths ───
export const preAuthCreateSchema = z.object({
  encounter_id: uuid,
  centre_id: centreId,
  patient_id: uuid,
  insurance_company_id: uuid,
  tpa_id: optionalUuid,
  policy_number: z.string().min(1).max(100),
  member_id: z.string().max(100).optional().nullable(),
  diagnosis_codes: z.array(z.string()).default([]),
  procedure_codes: z.array(z.string()).default([]),
  treating_doctor_id: optionalUuid,
  clinical_notes: z.string().max(5000).optional().nullable(),
  requested_amount: z.number().positive(),
  requested_stay_days: z.number().int().min(1).max(365).optional().nullable(),
  pmjay_package_code: z.string().max(50).optional().nullable(),
  pmjay_package_name: z.string().max(200).optional().nullable(),
});

export type PreAuthCreate = z.infer<typeof preAuthCreateSchema>;

// ─── POST /api/billing/pre-auths/[id]/approve ───
export const preAuthApproveSchema = z.object({
  status: z.enum(['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'QUERY']),
  approved_amount: z.number().min(0).optional(),
  remarks: z.string().max(2000).optional().nullable(),
  approved_stay_days: z.number().int().min(0).max(365).optional().nullable(),
});

export type PreAuthApprove = z.infer<typeof preAuthApproveSchema>;

// ─── POST /api/billing/pre-auths/[id]/enhance ───
export const preAuthEnhanceSchema = z.object({
  enhancement_amount: z.number().positive(),
  enhancement_reason: z.string().min(1).max(2000),
});

export type PreAuthEnhance = z.infer<typeof preAuthEnhanceSchema>;

// ─── POST /api/billing/pre-auths/[id]/query-response ───
export const preAuthQueryResponseSchema = z.object({
  response: z.string().min(1).max(5000),
  attachments: z.array(z.string().url()).optional(),
});

export type PreAuthQueryResponse = z.infer<typeof preAuthQueryResponseSchema>;

// ─── POST /api/billing/pre-auths/[id]/submit ───
export const preAuthSubmitSchema = z.object({
  submission_notes: z.string().max(2000).optional().nullable(),
});

export type PreAuthSubmit = z.infer<typeof preAuthSubmitSchema>;

// ─── POST /api/billing/settings/services ───
export const serviceCreateSchema = z.object({
  service_code: z.string().min(1).max(50),
  service_name: z.string().min(1).max(200),
  service_category: z.string().min(1).max(100),
  department_id: optionalUuid,
  base_rate: z.number().min(0),
  is_active: z.boolean().default(true),
  centre_id: centreId,
});

export type ServiceCreate = z.infer<typeof serviceCreateSchema>;

// ─── POST /api/billing/line-items/[id]/cancel ───
export const lineItemCancelSchema = z.object({
  cancellation_reason: z.string().min(1, 'Cancellation reason required').max(500),
});

export type LineItemCancel = z.infer<typeof lineItemCancelSchema>;
