// lib/bridge/cross-module-bridge.ts
// Connects modules that should talk to each other but don't yet.
// Called from UI action handlers after the primary action succeeds.

import { sb } from '@/lib/supabase/browser';
import { auditCreate } from '@/lib/audit/audit-logger';

// ============================================================
// TARIFF LOOKUP — find real rate from hmis_tariff_master
// ============================================================
export async function lookupTariff(centreId: string, serviceName: string, payorType: string = 'self', categoryHint?: string): Promise<{ tariffId: string; rate: number; serviceName: string; category: string } | null> {
  if (!sb()) return null;

  // Try exact match first
  let { data } = await sb().from('hmis_tariff_master')
    .select('id, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs')
    .eq('centre_id', centreId).eq('is_active', true)
    .ilike('service_name', serviceName)
    .limit(1).maybeSingle();
  // If category hint provided and no match, try with category filter
  if (!data && categoryHint) {
    const { data: catExact } = await sb().from('hmis_tariff_master')
      .select('id, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs')
      .eq('centre_id', centreId).eq('is_active', true).eq('category', categoryHint)
      .ilike('service_name', serviceName).limit(1).maybeSingle();
    data = catExact;
  }

  // Try fuzzy match
  if (!data) {
    const { data: fuzzy } = await sb().from('hmis_tariff_master')
      .select('id, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs')
      .eq('centre_id', centreId).eq('is_active', true)
      .ilike('service_name', `%${serviceName}%`).limit(1).maybeSingle();
    data = fuzzy;
  }

  // Try keyword match — with category filter to prevent cross-category mismatches
  if (!data) {
    const words = serviceName.split(/[\s\-\/\(\)]+/).filter(w => w.length > 2).slice(0, 2);
    if (words.length > 0) {
      let kwQ = sb().from('hmis_tariff_master')
        .select('id, service_name, category, rate_self, rate_insurance, rate_pmjay, rate_cghs')
        .eq('centre_id', centreId).eq('is_active', true)
        .ilike('service_name', `%${words[0]}%`);
      if (categoryHint) kwQ = kwQ.eq('category', categoryHint);
      const { data: keyword } = await kwQ.limit(1).maybeSingle();
      data = keyword;
    }
  }

  if (!data) return null;

  const rateMap: Record<string, string> = { self: 'rate_self', insurance: 'rate_insurance', cashless: 'rate_insurance', pmjay: 'rate_pmjay', cghs: 'rate_cghs', echs: 'rate_cghs' };
  const rateField = rateMap[payorType] || 'rate_self';
  const rate = parseFloat((data as any)[rateField] || data.rate_self || 0);

  return { tariffId: data.id, rate, serviceName: data.service_name, category: data.category };
}

// ============================================================
// SMART AUTO-CHARGE — lookup tariff + post charge in one call
// ============================================================
export async function smartPostLabCharge(params: {
  centreId: string; patientId: string; admissionId?: string;
  labOrderId?: string; testName: string; payorType?: string; staffId: string;
}): Promise<{ posted: boolean; amount: number }> {
  if (!sb()) return { posted: false, amount: 0 };
  const tariff = await lookupTariff(params.centreId, params.testName, params.payorType || 'self', 'lab');
  const amount = tariff?.rate || 0;
  if (amount <= 0) return { posted: false, amount: 0 };

  await sb().from('hmis_charge_log').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    admission_id: params.admissionId || null,
    tariff_id: tariff?.tariffId || null,
    description: `Lab: ${tariff?.serviceName || params.testName}`,
    service_name: tariff?.serviceName || params.testName,
    category: 'lab', quantity: 1, unit_rate: amount, amount,
    source: 'lab', source_ref_id: params.labOrderId, source_ref_type: 'lab_order',
    captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
    status: 'captured',
  });
  auditCreate(params.centreId, params.staffId, 'charge', '', `Lab: ${params.testName} → ₹${amount} (tariff: ${tariff?.serviceName})`);
  return { posted: true, amount };
}

export async function smartPostRadiologyCharge(params: {
  centreId: string; patientId: string; admissionId?: string;
  radiologyOrderId?: string; testName: string; payorType?: string; staffId: string;
}): Promise<{ posted: boolean; amount: number }> {
  if (!sb()) return { posted: false, amount: 0 };
  const tariff = await lookupTariff(params.centreId, params.testName, params.payorType || 'self', 'radiology');
  const amount = tariff?.rate || 0;
  if (amount <= 0) return { posted: false, amount: 0 };

  await sb().from('hmis_charge_log').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    admission_id: params.admissionId || null,
    tariff_id: tariff?.tariffId || null,
    description: `Radiology: ${tariff?.serviceName || params.testName}`,
    service_name: tariff?.serviceName || params.testName,
    category: 'radiology', quantity: 1, unit_rate: amount, amount,
    source: 'radiology', source_ref_id: params.radiologyOrderId, source_ref_type: 'radiology_order',
    captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
    status: 'captured',
  });
  auditCreate(params.centreId, params.staffId, 'charge', '', `Radiology: ${params.testName} → ₹${amount} (tariff: ${tariff?.serviceName})`);
  return { posted: true, amount };
}

export async function smartPostConsultationCharge(params: {
  centreId: string; patientId: string;
  doctorName: string; isSuper: boolean; visitType: string;
  visitId: string; payorType?: string; staffId: string;
}): Promise<{ posted: boolean; amount: number }> {
  if (!sb()) return { posted: false, amount: 0 };
  // Lookup consultation fee from tariff
  const searchTerm = params.isSuper
    ? (params.visitType === 'follow_up' ? 'OPD FOLLOW UP CONSULTATION (SUPER SPECIALIST)' : 'OPD CONSULTATION (SUPER SPECIALIST)')
    : (params.visitType === 'follow_up' ? 'OPD FOLLOW UP CONSULTATION (SPECIALIST)' : 'OPD CONSULTATION (SPECIALIST)');

  const tariff = await lookupTariff(params.centreId, searchTerm, params.payorType || 'self');
  const amount = tariff?.rate || (params.isSuper ? 1500 : 1000); // Fallback from SOC

  await sb().from('hmis_charge_log').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    description: `Consultation: Dr. ${params.doctorName} (${params.isSuper ? 'Super Specialist' : 'Specialist'})`,
    category: 'consultation', quantity: 1, unit_rate: amount, amount,
    source: 'manual', source_ref_id: params.visitId, source_ref_type: 'opd_visit',
    captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
    status: 'captured',
  });
  auditCreate(params.centreId, params.staffId, 'charge', '', `OPD Consult: Dr. ${params.doctorName} ₹${amount}`);
  return { posted: true, amount };
}

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
    // Create pharmacy dispensing record + AUTO-POST CHARGE
    const { data, error } = await sb().from('hmis_pharmacy_dispensing').insert({
      centre_id: params.centreId, patient_id: params.patientId,
      encounter_id: params.admissionId,
      prescription_data: [{ drug: params.details.drug, dose: params.details.dose, route: params.details.route, frequency: params.details.frequency }],
      status: 'pending',
    }).select('id').maybeSingle();
    if (!error && data) {
      // Auto-post pharmacy charge from tariff
      const tariff = await lookupTariff(params.centreId, params.details.drug, 'self');
      if (tariff) {
        await sb().from('hmis_charge_log').insert({
          centre_id: params.centreId, patient_id: params.patientId,
          admission_id: params.admissionId, service_name: tariff.serviceName,
          tariff_id: tariff.tariffId, amount: tariff.rate, status: 'posted',
          service_date: new Date().toISOString().split('T')[0],
          posted_by: params.staffId, category: 'pharmacy',
        });
      }
      auditCreate(params.centreId, params.staffId, 'pharmacy_order', data.id, `CPOE→Pharmacy+Charge: ${params.details.drug}`);
      return { success: true, routed: true, targetId: data.id };
    }
  }

  if (params.orderType === 'lab' && params.details?.tests) {
    // Create lab orders + resolve test_id so worklist picks them up
    for (const testName of (params.details.tests || [params.orderText])) {
      let testId: string | null = null;
      const { data: testExact } = await sb().from('hmis_lab_test_master')
        .select('id').ilike('test_name', testName).eq('is_active', true).limit(1).maybeSingle();
      if (testExact) { testId = testExact.id; }
      else {
        const keyword = testName.split(/[\s\-\/\(\)]+/).filter((w: string) => w.length > 2)[0];
        if (keyword) {
          const { data: testFuzzy } = await sb().from('hmis_lab_test_master')
            .select('id').ilike('test_name', `%${keyword}%`).eq('is_active', true).limit(1).maybeSingle();
          if (testFuzzy) testId = testFuzzy.id;
        }
      }
      const { data: labOrder } = await sb().from('hmis_lab_orders').insert({
        centre_id: params.centreId, patient_id: params.patientId,
        admission_id: params.admissionId,
        test_id: testId, test_name: testName,
        status: 'ordered', ordered_by: params.staffId,
        priority: params.priority === 'stat' ? 'stat' : params.priority === 'urgent' ? 'urgent' : 'routine',
      }).select('id').maybeSingle();
      // Auto-post charge from tariff
      await smartPostLabCharge({ centreId: params.centreId, patientId: params.patientId, admissionId: params.admissionId, testName, staffId: params.staffId, labOrderId: labOrder?.id });
    }
    auditCreate(params.centreId, params.staffId, 'lab_order', '', `CPOE→Lab+Charge: ${params.orderText}`);
    return { success: true, routed: true };
  }

  if (params.orderType === 'radiology' && params.details?.modality) {
    // Resolve test_id from radiology test master
    let radTestId: string | null = null;
    const bodyPart = params.details.bodyPart || '';
    const { data: radExact } = await sb().from('hmis_radiology_test_master')
      .select('id').ilike('test_name', `${params.details.modality} ${bodyPart}`.trim()).eq('is_active', true).limit(1).maybeSingle();
    if (radExact) { radTestId = radExact.id; }
    else {
      const { data: radFuzzy } = await sb().from('hmis_radiology_test_master')
        .select('id').eq('modality', params.details.modality).ilike('test_name', `%${bodyPart}%`).eq('is_active', true).limit(1).maybeSingle();
      if (radFuzzy) radTestId = radFuzzy.id;
    }
    const testName = `${params.details.modality} ${bodyPart}`.trim();
    const accession = `RAD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    const { data, error } = await sb().from('hmis_radiology_orders').insert({
      centre_id: params.centreId, patient_id: params.patientId,
      admission_id: params.admissionId,
      test_id: radTestId, test_name: testName,
      accession_number: accession,
      modality: params.details.modality, body_part: bodyPart,
      status: 'ordered', ordered_by: params.staffId,
      urgency: params.priority === 'stat' ? 'stat' : 'routine',
    }).select('id').maybeSingle();
    if (!error && data) {
      // Auto-post charge from tariff
      await smartPostRadiologyCharge({ centreId: params.centreId, patientId: params.patientId, admissionId: params.admissionId, radiologyOrderId: data.id, testName, staffId: params.staffId });
      auditCreate(params.centreId, params.staffId, 'radiology_order', data.id, `CPOE→Radiology+Charge: ${params.orderText}`);
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
