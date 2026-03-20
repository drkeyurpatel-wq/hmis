// lib/bridge/cross-module-bridge.ts
// Connects modules that should talk to each other but don't yet.
// Called from UI action handlers after the primary action succeeds.

import { createClient } from '@/lib/supabase/client';
import { auditCreate } from '@/lib/audit/audit-logger';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// 1. PHARMACY DISPENSE → CHARGE LOG
// Call after successful dispense
// ============================================================
export async function postPharmacyCharge(params: {
  centreId: string; patientId: string; admissionId?: string;
  dispensingId: string; drugName: string; quantity: number; amount: number;
  staffId: string;
}): Promise<void> {
  if (!sb()) return;
  await sb().from('hmis_charge_log').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    admission_id: params.admissionId || null,
    description: `Pharmacy: ${params.drugName} × ${params.quantity}`,
    category: 'pharmacy', quantity: params.quantity,
    unit_rate: params.amount / params.quantity, amount: params.amount,
    source: 'pharmacy', source_ref_id: params.dispensingId,
    source_ref_type: 'pharmacy_dispense',
    captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
    status: 'captured',
  });
  auditCreate(params.centreId, params.staffId, 'charge', '', `Pharmacy charge: ${params.drugName} ₹${params.amount}`);
}

// ============================================================
// 2. LAB ORDER → CHARGE LOG
// Call after lab order is created
// ============================================================
export async function postLabCharge(params: {
  centreId: string; patientId: string; admissionId?: string;
  labOrderId: string; testName: string; amount: number;
  staffId: string;
}): Promise<void> {
  if (!sb()) return;
  await sb().from('hmis_charge_log').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    admission_id: params.admissionId || null,
    description: `Lab: ${params.testName}`,
    category: 'lab', quantity: 1, unit_rate: params.amount, amount: params.amount,
    source: 'lab', source_ref_id: params.labOrderId, source_ref_type: 'lab_order',
    captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
    status: 'captured',
  });
  auditCreate(params.centreId, params.staffId, 'charge', '', `Lab charge: ${params.testName} ₹${params.amount}`);
}

// ============================================================
// 3. RADIOLOGY ORDER → CHARGE LOG
// Call after radiology order is created
// ============================================================
export async function postRadiologyCharge(params: {
  centreId: string; patientId: string; admissionId?: string;
  radiologyOrderId: string; testName: string; amount: number;
  staffId: string;
}): Promise<void> {
  if (!sb()) return;
  await sb().from('hmis_charge_log').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    admission_id: params.admissionId || null,
    description: `Radiology: ${params.testName}`,
    category: 'radiology', quantity: 1, unit_rate: params.amount, amount: params.amount,
    source: 'radiology', source_ref_id: params.radiologyOrderId, source_ref_type: 'radiology_order',
    captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
    status: 'captured',
  });
  auditCreate(params.centreId, params.staffId, 'charge', '', `Radiology charge: ${params.testName} ₹${params.amount}`);
}

// ============================================================
// 4. CPOE ORDER → DOWNSTREAM MODULE
// Routes CPOE orders to pharmacy/lab/radiology queues
// ============================================================
export async function routeCPOEOrder(params: {
  centreId: string; patientId: string; admissionId: string;
  orderType: string; orderText: string; details: any;
  priority: string; staffId: string;
}): Promise<{ success: boolean; routed: boolean; targetId?: string }> {
  if (!sb()) return { success: false, routed: false };

  if (params.orderType === 'medication' && params.details?.drug) {
    // Create pharmacy dispensing record
    const { data, error } = await sb().from('hmis_pharmacy_dispensing').insert({
      centre_id: params.centreId, patient_id: params.patientId,
      encounter_id: params.admissionId,
      prescription_data: [{ drug: params.details.drug, dose: params.details.dose, route: params.details.route, frequency: params.details.frequency }],
      status: 'pending',
    }).select('id').maybeSingle();
    if (!error && data) {
      auditCreate(params.centreId, params.staffId, 'pharmacy_order', data.id, `CPOE→Pharmacy: ${params.details.drug}`);
      return { success: true, routed: true, targetId: data.id };
    }
  }

  if (params.orderType === 'lab' && params.details?.tests) {
    // Create lab orders
    for (const testName of (params.details.tests || [params.orderText])) {
      await sb().from('hmis_lab_orders').insert({
        centre_id: params.centreId, patient_id: params.patientId,
        admission_id: params.admissionId,
        test_name: testName, status: 'ordered', ordered_by: params.staffId,
        priority: params.priority === 'stat' ? 'stat' : params.priority === 'urgent' ? 'urgent' : 'routine',
      });
    }
    auditCreate(params.centreId, params.staffId, 'lab_order', '', `CPOE→Lab: ${params.orderText}`);
    return { success: true, routed: true };
  }

  if (params.orderType === 'radiology' && params.details?.modality) {
    const { data, error } = await sb().from('hmis_radiology_orders').insert({
      centre_id: params.centreId, patient_id: params.patientId,
      admission_id: params.admissionId,
      modality: params.details.modality, body_part: params.details.bodyPart,
      status: 'ordered', ordered_by: params.staffId,
      urgency: params.priority === 'stat' ? 'stat' : 'routine',
    }).select('id').maybeSingle();
    if (!error && data) {
      auditCreate(params.centreId, params.staffId, 'radiology_order', data.id, `CPOE→Radiology: ${params.orderText}`);
      return { success: true, routed: true, targetId: data.id };
    }
  }

  // Diet, nursing, activity, consult, procedure — no downstream module yet, just logged
  return { success: true, routed: false };
}

// ============================================================
// 5. APPOINTMENT CHECK-IN → OPD VISIT
// Creates OPD visit when appointment is checked in
// ============================================================
export async function createOPDVisitFromAppointment(params: {
  centreId: string; patientId: string; doctorId: string;
  appointmentId: string; visitReason?: string; staffId: string;
}): Promise<{ success: boolean; visitId?: string }> {
  if (!sb()) return { success: false };

  const { data, error } = await sb().from('hmis_opd_visits').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    doctor_id: params.doctorId, appointment_id: params.appointmentId,
    status: 'checked_in', check_in_time: new Date().toISOString(),
    visit_reason: params.visitReason || '',
  }).select('id').maybeSingle();

  if (!error && data) {
    auditCreate(params.centreId, params.staffId, 'opd_visit', data.id, `OPD from Appt: ${params.appointmentId}`);
    return { success: true, visitId: data.id };
  }
  return { success: false };
}

// ============================================================
// 6. DISCHARGE → TRIGGER FINAL BILL
// Call from discharge engine after discharge is saved
// ============================================================
export async function triggerFinalBillOnDischarge(params: {
  centreId: string; patientId: string; admissionId: string;
  staffId: string;
}): Promise<{ billExists: boolean; billId?: string }> {
  if (!sb()) return { billExists: false };

  // Check if final bill already exists
  const { data: existing } = await sb().from('hmis_bills')
    .select('id, bill_number').eq('encounter_id', params.admissionId).eq('bill_type', 'ipd').maybeSingle();

  if (existing) return { billExists: true, billId: existing.id };

  // Check if there are any charges to bill
  const { count } = await sb().from('hmis_charge_log')
    .select('id', { count: 'exact', head: true })
    .eq('admission_id', params.admissionId).eq('status', 'captured');

  if (!count || count === 0) return { billExists: false }; // No charges to bill

  auditCreate(params.centreId, params.staffId, 'discharge', params.admissionId, 'Discharge: final bill pending');
  return { billExists: false }; // Caller should redirect to final bill page
}

// ============================================================
// BILL NUMBER GENERATOR (sequence-safe, replaces Math.random)
// ============================================================
export async function generateBillNumber(centreId: string, billType: string): Promise<string> {
  if (!sb()) return `${billType.toUpperCase()}-${Date.now()}`;
  const prefix = billType === 'ipd' ? 'IPD' : billType === 'opd' ? 'OPD' : 'BIL';
  const dateStr = new Date().toISOString().slice(2, 10).replace(/-/g, '');
  const today = new Date().toISOString().split('T')[0];
  const { count } = await sb().from('hmis_bills')
    .select('id', { count: 'exact', head: true })
    .eq('centre_id', centreId).eq('bill_type', billType).eq('bill_date', today);
  const seq = ((count || 0) + 1).toString().padStart(4, '0');
  return `${prefix}-${dateStr}-${seq}`;
}
