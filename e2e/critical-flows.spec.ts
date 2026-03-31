// e2e/critical-flows.spec.ts
// Full E2E test suite — runs against LIVE Supabase instance
// Tests the exact same REST API calls the browser makes
import { test, expect } from '@playwright/test';
import {
  supabaseGet, supabasePost, supabasePatch, supabaseDelete, supabaseRpc,
  SUPABASE_URL, SERVICE_KEY, CENTRE_ID, KEYUR_STAFF_ID,
} from './setup';

// ═══════════════════════════════════════════════════════
// Test state — created records get cleaned up after
// ═══════════════════════════════════════════════════════
let testPatientId: string;
let testOPDVisitId: string;
let testEncounterId: string;
let testLabOrderIds: string[] = [];
let testRadOrderId: string;
let testPharmacyId: string;
let testChargeIds: string[] = [];
let testBillId: string;
let testPaymentId: string;
let testAppointmentId: string;
let testAdmissionId: string;

const TEST_PREFIX = 'E2E_TEST_';
const timestamp = Date.now().toString(36);

// ═══════════════════════════════════════════════════════
// FLOW 1: PATIENT REGISTRATION
// ═══════════════════════════════════════════════════════
test.describe('Flow 1: Patient Registration', () => {
  test('1.1 Register new patient', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_patients', {
      registration_centre_id: CENTRE_ID,
      first_name: `${TEST_PREFIX}Arjun`,
      last_name: `${TEST_PREFIX}${timestamp}`,
      gender: 'male',
      date_of_birth: '1985-03-15',
      age_years: 41,
      phone_primary: '9876500001',
      uhid: `E2E-${timestamp}`,
      is_active: true,
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    testPatientId = data[0].id;
    expect(testPatientId).toBeTruthy();
  });

  test('1.2 Patient visible in patient list', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_patients',
      'id,uhid,first_name,last_name,is_active',
      `id=eq.${testPatientId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].first_name).toContain(TEST_PREFIX);
    expect(data[0].is_active).toBe(true);
  });

  test('1.3 Patient searchable by name', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_patients',
      'id,first_name',
      `first_name=ilike.%${TEST_PREFIX}Arjun%&is_active=eq.true`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 2: OPD VISIT CREATION
// ═══════════════════════════════════════════════════════
test.describe('Flow 2: OPD Visit', () => {
  test('2.1 Create OPD visit', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_opd_visits', {
      centre_id: CENTRE_ID,
      patient_id: testPatientId,
      doctor_id: KEYUR_STAFF_ID,
      token_number: 999,
      visit_number: `E2E-V-${timestamp}`,
      status: 'waiting',
      visit_type: 'new',
      check_in_time: new Date().toISOString(),
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    testOPDVisitId = data[0].id;
    expect(testOPDVisitId).toBeTruthy();
  });

  test('2.2 OPD visit visible in queue', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_opd_visits',
      'id,status,token_number,patient_id,doctor_id,centre_id',
      `id=eq.${testOPDVisitId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data.length).toBe(1);
    expect(data[0].status).toBe('waiting');
    expect(data[0].centre_id).toBe(CENTRE_ID);
  });

  test('2.3 OPD visit links to patient data', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_opd_visits',
      'id,patient:hmis_patients!inner(first_name,uhid)',
      `id=eq.${testOPDVisitId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data[0].patient.first_name).toContain(TEST_PREFIX);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 3: EMR ENCOUNTER — SAVE + SIGN
// ═══════════════════════════════════════════════════════
test.describe('Flow 3: EMR Encounter', () => {
  test('3.1 Create encounter (save draft)', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_emr_encounters', {
      centre_id: CENTRE_ID,
      patient_id: testPatientId,
      doctor_id: KEYUR_STAFF_ID,
      opd_visit_id: testOPDVisitId,
      encounter_type: 'opd',
      encounter_date: new Date().toISOString(),
      status: 'in_progress',
      vitals: { systolic: '120', diastolic: '80', heartRate: '76', spo2: '98' },
      complaints: [{ complaint: 'Headache', text: 'C/O Headache | 3 days' }],
      diagnoses: [{ code: 'G43.9', name: 'Migraine', type: 'primary' }],
      prescriptions: [{ drug: 'Paracetamol', dose: '500mg', frequency: 'TDS', duration: '5 days' }],
      investigations: [{ name: 'CBC', type: 'lab', urgency: 'routine' }, { name: 'MRI Brain', type: 'radiology', urgency: 'routine' }],
      advice: 'Rest, hydrate',
      follow_up: '2026-04-07',
    });
    expect(res.status()).toBe(201);
    const data = await res.json();
    testEncounterId = data[0].id;
    expect(testEncounterId).toBeTruthy();
  });

  test('3.2 Encounter links to OPD visit', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_emr_encounters',
      'id,opd_visit_id,encounter_date,status',
      `id=eq.${testEncounterId}`);
    const data = await res.json();
    expect(data[0].opd_visit_id).toBe(testOPDVisitId);
    expect(data[0].encounter_date).toBeTruthy();
    expect(data[0].status).toBe('in_progress');
  });

  test('3.3 Sign encounter', async ({ request }) => {
    const res = await supabasePatch(request, 'hmis_emr_encounters',
      { status: 'signed', signed_at: new Date().toISOString() },
      `id=eq.${testEncounterId}`);
    expect(res.status()).toBe(200);
    const data = await res.json();
    expect(data[0].status).toBe('signed');
    expect(data[0].signed_at).toBeTruthy();
  });

  test('3.4 Encounter visible in past encounters', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_emr_encounters',
      'id,encounter_date,status,diagnoses',
      `patient_id=eq.${testPatientId}&order=encounter_date.desc`);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
    expect(data[0].status).toBe('signed');
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 4: EMR → LAB ORDERS (cross-module)
// ═══════════════════════════════════════════════════════
test.describe('Flow 4: EMR → Lab Orders', () => {
  test('4.1 Create lab order (CBC)', async ({ request }) => {
    // Resolve test_id from master — same as EMR does
    const masterRes = await supabaseGet(request, 'hmis_lab_test_master',
      'id,test_code,test_name',
      `test_code=ilike.CBC&is_active=eq.true&limit=1`);
    const master = await masterRes.json();
    const testId = master.length > 0 ? master[0].id : null;

    const res = await supabasePost(request, 'hmis_lab_orders', {
      centre_id: CENTRE_ID,
      patient_id: testPatientId,
      test_id: testId,
      test_name: 'CBC',
      encounter_id: testEncounterId,
      status: 'ordered',
      ordered_by: KEYUR_STAFF_ID,
      priority: 'routine',
    });
    expect(res.status()).toBe(201);
    testLabOrderIds.push((await res.json())[0].id);
  });

  test('4.2 Create lab order (HbA1c)', async ({ request }) => {
    const masterRes = await supabaseGet(request, 'hmis_lab_test_master',
      'id', `test_code=ilike.HBA1C&is_active=eq.true&limit=1`);
    const master = await masterRes.json();

    const res = await supabasePost(request, 'hmis_lab_orders', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      test_id: master[0]?.id || null, test_name: 'HbA1c',
      encounter_id: testEncounterId,
      status: 'ordered', ordered_by: KEYUR_STAFF_ID, priority: 'routine',
    });
    expect(res.status()).toBe(201);
    testLabOrderIds.push((await res.json())[0].id);
  });

  test('4.3 Lab orders visible in worklist', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_lab_orders',
      'id,test_name,status,priority,ordered_by,test_id',
      `patient_id=eq.${testPatientId}&status=eq.ordered`);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(2);
    // Verify CBC has test_id
    const cbc = data.find((d: any) => d.test_name === 'CBC');
    expect(cbc).toBeTruthy();
    expect(cbc.test_id).toBeTruthy(); // Should be resolved from test_code
  });

  test('4.4 Lab order JOINs test master', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_lab_orders',
      'id,test_name,test:hmis_lab_test_master(test_code,test_name,category)',
      `id=eq.${testLabOrderIds[0]}`);
    const data = await res.json();
    expect(data[0].test).toBeTruthy();
    expect(data[0].test.test_code).toBe('CBC');
  });

  test('4.5 Enter lab result + critical flag', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_lab_results', {
      lab_order_id: testLabOrderIds[0],
      parameter_name: 'Haemoglobin',
      result_value: '6.2',
      unit: 'g/dL',
      reference_range: '12-16',
      is_abnormal: true,
      is_critical: true,
    });
    expect(res.status()).toBe(201);
  });

  test('4.6 Update lab order status to completed', async ({ request }) => {
    const res = await supabasePatch(request, 'hmis_lab_orders',
      { status: 'completed' }, `id=eq.${testLabOrderIds[0]}`);
    expect(res.status()).toBe(200);
  });

  test('4.7 Lab results visible (EMR history panel)', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_lab_orders',
      'id,test_name,status,results:hmis_lab_results(parameter_name,result_value,is_critical)',
      `patient_id=eq.${testPatientId}`);
    const data = await res.json();
    const cbc = data.find((d: any) => d.test_name === 'CBC');
    expect(cbc.status).toBe('completed');
    expect(cbc.results.length).toBeGreaterThanOrEqual(1);
    expect(cbc.results[0].is_critical).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 5: EMR → RADIOLOGY ORDERS (cross-module)
// ═══════════════════════════════════════════════════════
test.describe('Flow 5: EMR → Radiology', () => {
  test('5.1 Create radiology order (MRI Brain)', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_radiology_orders', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      test_name: 'MRI Brain', modality: 'MRI', body_part: 'Brain',
      accession_number: `RAD-E2E-${timestamp}`,
      encounter_id: testEncounterId,
      status: 'ordered', ordered_by: KEYUR_STAFF_ID, urgency: 'routine',
    });
    expect(res.status()).toBe(201);
    testRadOrderId = (await res.json())[0].id;
  });

  test('5.2 Radiology order visible in worklist', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_radiology_orders',
      'id,test_name,modality,body_part,accession_number,status,patient:hmis_patients!inner(first_name,uhid)',
      `id=eq.${testRadOrderId}`);
    const data = await res.json();
    expect(data[0].modality).toBe('MRI');
    expect(data[0].patient.first_name).toContain(TEST_PREFIX);
  });

  test('5.3 Create radiology report', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_radiology_reports', {
      radiology_order_id: testRadOrderId,
      findings: 'Normal brain parenchyma. No acute intracranial pathology.',
      impression: 'Normal MRI Brain',
      is_critical: false,
      status: 'reported',
      reported_by: KEYUR_STAFF_ID,
    });
    expect(res.status()).toBe(201);
  });

  test('5.4 Report visible in EMR imaging panel', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_radiology_orders',
      'id,test_name,status,report:hmis_radiology_reports(findings,impression,is_critical,status)',
      `patient_id=eq.${testPatientId}`);
    const data = await res.json();
    const mri = data.find((d: any) => d.test_name === 'MRI Brain');
    expect(mri.report.length).toBeGreaterThanOrEqual(1);
    expect(mri.report[0].impression).toContain('Normal');
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 6: EMR → PHARMACY (cross-module)
// ═══════════════════════════════════════════════════════
test.describe('Flow 6: EMR → Pharmacy', () => {
  test('6.1 Create pharmacy dispensing record', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_pharmacy_dispensing', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      encounter_id: testEncounterId,
      prescription_data: [
        { drug: 'Paracetamol', generic: 'Paracetamol', dose: '500mg', route: 'Oral', frequency: 'TDS', duration: '5 days' },
      ],
      status: 'pending',
    });
    expect(res.status()).toBe(201);
    testPharmacyId = (await res.json())[0].id;
  });

  test('6.2 Pharmacy visible in pending queue', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_pharmacy_dispensing',
      'id,status,prescription_data,patient:hmis_patients!inner(first_name,uhid)',
      `id=eq.${testPharmacyId}`);
    const data = await res.json();
    expect(data[0].status).toBe('pending');
    expect(data[0].prescription_data.length).toBe(1);
    expect(data[0].patient.first_name).toContain(TEST_PREFIX);
  });

  test('6.3 Dispense medication (status → dispensed)', async ({ request }) => {
    const res = await supabasePatch(request, 'hmis_pharmacy_dispensing',
      { status: 'dispensed', dispensed_at: new Date().toISOString() },
      `id=eq.${testPharmacyId}`);
    expect(res.status()).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 7: CHARGE LOG → AUTO-BILL (cross-module)
// ═══════════════════════════════════════════════════════
test.describe('Flow 7: Charges → Billing', () => {
  test('7.1 Post consultation charge', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_charge_log', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      service_name: 'OPD Consultation', description: 'Consultation: Dr. Keyur',
      category: 'consultation', amount: 500, unit_rate: 500, quantity: 1,
      service_date: new Date().toISOString().split('T')[0],
      status: 'captured', source: 'emr', captured_by: KEYUR_STAFF_ID,
    });
    expect(res.status()).toBe(201);
    testChargeIds.push((await res.json())[0].id);
  });

  test('7.2 Post lab charge', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_charge_log', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      service_name: 'CBC', description: 'Lab: CBC', category: 'lab',
      amount: 350, unit_rate: 350, quantity: 1,
      service_date: new Date().toISOString().split('T')[0],
      status: 'captured', source: 'lab', captured_by: KEYUR_STAFF_ID,
    });
    expect(res.status()).toBe(201);
    testChargeIds.push((await res.json())[0].id);
  });

  test('7.3 Post radiology charge', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_charge_log', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      service_name: 'MRI Brain', description: 'Radiology: MRI Brain', category: 'radiology',
      amount: 6000, unit_rate: 6000, quantity: 1,
      service_date: new Date().toISOString().split('T')[0],
      status: 'captured', source: 'radiology', captured_by: KEYUR_STAFF_ID,
    });
    expect(res.status()).toBe(201);
    testChargeIds.push((await res.json())[0].id);
  });

  test('7.4 All charges unbilled', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_charge_log',
      'id,service_name,amount,bill_id,status',
      `patient_id=eq.${testPatientId}&status=eq.captured&bill_id=is.null`);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(3);
    const total = data.reduce((s: number, c: any) => s + parseFloat(c.amount), 0);
    expect(total).toBe(6850); // 500 + 350 + 6000
  });

  test('7.5 Create bill from charges', async ({ request }) => {
    const billRes = await supabasePost(request, 'hmis_bills', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      bill_number: `E2E-BILL-${timestamp}`, bill_type: 'opd',
      bill_date: new Date().toISOString().split('T')[0],
      payor_type: 'self', encounter_id: testEncounterId,
      gross_amount: 6850, discount_amount: 0, tax_amount: 0,
      net_amount: 6850, paid_amount: 0, balance_amount: 6850,
      status: 'draft', created_by: KEYUR_STAFF_ID,
    });
    expect(billRes.status()).toBe(201);
    testBillId = (await billRes.json())[0].id;

    // Create bill items
    const items = [
      { bill_id: testBillId, centre_id: CENTRE_ID, service_name: 'OPD Consultation', category: 'consultation', amount: 500, unit_rate: 500, quantity: 1, service_date: new Date().toISOString().split('T')[0], sort_order: 1 },
      { bill_id: testBillId, centre_id: CENTRE_ID, service_name: 'CBC', category: 'lab', amount: 350, unit_rate: 350, quantity: 1, service_date: new Date().toISOString().split('T')[0], sort_order: 2 },
      { bill_id: testBillId, centre_id: CENTRE_ID, service_name: 'MRI Brain', category: 'radiology', amount: 6000, unit_rate: 6000, quantity: 1, service_date: new Date().toISOString().split('T')[0], sort_order: 3 },
    ];
    const itemRes = await supabasePost(request, 'hmis_bill_items', items);
    expect(itemRes.status()).toBe(201);

    // Mark charges as billed
    for (const cid of testChargeIds) {
      await supabasePatch(request, 'hmis_charge_log', { bill_id: testBillId, status: 'billed' }, `id=eq.${cid}`);
    }
  });

  test('7.6 Bill has correct items', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_bill_items',
      'id,service_name,amount,category', `bill_id=eq.${testBillId}&order=sort_order`);
    const data = await res.json();
    expect(data.length).toBe(3);
    expect(data[0].service_name).toBe('OPD Consultation');
    expect(data[1].service_name).toBe('CBC');
    expect(data[2].service_name).toBe('MRI Brain');
  });

  test('7.7 Charges marked as billed', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_charge_log',
      'id,status,bill_id', `patient_id=eq.${testPatientId}&bill_id=eq.${testBillId}`);
    const data = await res.json();
    expect(data.length).toBe(3);
    data.forEach((c: any) => expect(c.status).toBe('billed'));
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 8: PAYMENT → BILL STATUS UPDATE
// ═══════════════════════════════════════════════════════
test.describe('Flow 8: Payment → Bill Update', () => {
  test('8.1 Collect partial payment ₹2000', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_payments', {
      centre_id: CENTRE_ID, bill_id: testBillId,
      amount: 2000, payment_mode: 'cash',
      payment_date: new Date().toISOString().split('T')[0],
      receipt_number: `REC-E2E-${timestamp}`,
    });
    expect(res.status()).toBe(201);
    testPaymentId = (await res.json())[0].id;
  });

  test('8.2 Update bill balance after payment', async ({ request }) => {
    const res = await supabasePatch(request, 'hmis_bills',
      { paid_amount: 2000, balance_amount: 4850, status: 'partial' },
      `id=eq.${testBillId}`);
    expect(res.status()).toBe(200);
  });

  test('8.3 Bill shows partial status', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_bills',
      'id,net_amount,paid_amount,balance_amount,status', `id=eq.${testBillId}`);
    const data = await res.json();
    expect(data[0].status).toBe('partial');
    expect(parseFloat(data[0].paid_amount)).toBe(2000);
    expect(parseFloat(data[0].balance_amount)).toBe(4850);
  });

  test('8.4 Collect remaining ₹4850', async ({ request }) => {
    await supabasePost(request, 'hmis_payments', {
      centre_id: CENTRE_ID, bill_id: testBillId,
      amount: 4850, payment_mode: 'upi',
      payment_date: new Date().toISOString().split('T')[0],
      receipt_number: `REC-E2E-${timestamp}-2`,
    });
    await supabasePatch(request, 'hmis_bills',
      { paid_amount: 6850, balance_amount: 0, status: 'paid' },
      `id=eq.${testBillId}`);
  });

  test('8.5 Bill fully paid', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_bills',
      'id,status,paid_amount,balance_amount', `id=eq.${testBillId}`);
    const data = await res.json();
    expect(data[0].status).toBe('paid');
    expect(parseFloat(data[0].balance_amount)).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 9: OPD VISIT COMPLETION
// ═══════════════════════════════════════════════════════
test.describe('Flow 9: OPD Visit Lifecycle', () => {
  test('9.1 Mark OPD visit completed', async ({ request }) => {
    const res = await supabasePatch(request, 'hmis_opd_visits',
      { status: 'completed', consultation_end: new Date().toISOString() },
      `id=eq.${testOPDVisitId}`);
    expect(res.status()).toBe(200);
  });

  test('9.2 Dashboard counts updated', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const res = await supabaseGet(request, 'hmis_opd_visits',
      'id', `centre_id=eq.${CENTRE_ID}&status=eq.completed&created_at=gte.${today}T00:00:00`);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 10: IPD ADMISSION → BED → DISCHARGE
// ═══════════════════════════════════════════════════════
test.describe('Flow 10: IPD Lifecycle', () => {
  let testBedId: string;

  test('10.1 Admit patient', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_admissions', {
      centre_id: CENTRE_ID, patient_id: testPatientId,
      ipd_number: `IPD-E2E-${timestamp}`,
      admitting_doctor_id: KEYUR_STAFF_ID, primary_doctor_id: KEYUR_STAFF_ID,
      admission_type: 'elective', admission_date: new Date().toISOString(),
      payor_type: 'self', status: 'active',
      provisional_diagnosis: 'Migraine for evaluation',
    });
    expect(res.status()).toBe(201);
    testAdmissionId = (await res.json())[0].id;
  });

  test('10.2 Assign bed (mark occupied)', async ({ request }) => {
    // Get first available bed
    const bedRes = await supabaseGet(request, 'hmis_beds',
      'id,bed_number', `status=eq.available&limit=1`);
    const beds = await bedRes.json();
    if (beds.length > 0) {
      testBedId = beds[0].id;
      const res = await supabasePatch(request, 'hmis_beds',
        { status: 'occupied', current_admission_id: testAdmissionId },
        `id=eq.${testBedId}`);
      expect(res.status()).toBe(200);
    }
  });

  test('10.3 Admission visible in nursing station', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_admissions',
      'id,ipd_number,status,patient:hmis_patients!inner(first_name,uhid)',
      `id=eq.${testAdmissionId}`);
    const data = await res.json();
    expect(data[0].status).toBe('active');
    expect(data[0].patient.first_name).toContain(TEST_PREFIX);
  });

  test('10.4 Post daily charges (bed+nursing)', async ({ request }) => {
    const res = await supabasePost(request, 'hmis_charge_log', [
      { centre_id: CENTRE_ID, patient_id: testPatientId, admission_id: testAdmissionId,
        service_name: 'General Ward Bed', category: 'room', amount: 1500,
        unit_rate: 1500, quantity: 1, service_date: new Date().toISOString().split('T')[0],
        status: 'captured', source: 'auto_daily' },
      { centre_id: CENTRE_ID, patient_id: testPatientId, admission_id: testAdmissionId,
        service_name: 'Nursing Care', category: 'nursing', amount: 500,
        unit_rate: 500, quantity: 1, service_date: new Date().toISOString().split('T')[0],
        status: 'captured', source: 'auto_daily' },
    ]);
    expect(res.status()).toBe(201);
  });

  test('10.5 Discharge patient', async ({ request }) => {
    const res = await supabasePatch(request, 'hmis_admissions',
      { status: 'discharged', actual_discharge: new Date().toISOString(), discharge_type: 'normal' },
      `id=eq.${testAdmissionId}`);
    expect(res.status()).toBe(200);
  });

  test('10.6 Bed freed after discharge', async ({ request }) => {
    if (testBedId) {
      await supabasePatch(request, 'hmis_beds',
        { status: 'available', current_admission_id: null }, `id=eq.${testBedId}`);
      const res = await supabaseGet(request, 'hmis_beds', 'id,status', `id=eq.${testBedId}`);
      const data = await res.json();
      expect(data[0].status).toBe('available');
    }
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 11: TARIFF + MASTER DATA INTEGRITY
// ═══════════════════════════════════════════════════════
test.describe('Flow 11: Master Data', () => {
  test('11.1 Tariff master has active entries', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_tariff_master',
      'id,service_name,category,rate_self',
      `centre_id=eq.${CENTRE_ID}&is_active=eq.true`);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(10);
  });

  test('11.2 Lab test master has active tests', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_lab_test_master',
      'id,test_code,test_name,category', `is_active=eq.true`);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(50);
  });

  test('11.3 Drug master has active drugs', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_drug_master',
      'id,generic_name,brand_name', `is_active=eq.true`);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(50);
  });

  test('11.4 Staff list accessible', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_staff',
      'id,full_name,staff_type,is_active', `is_active=eq.true`);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(20);
  });

  test('11.5 Departments configured', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_departments',
      'id,name,is_active', `centre_id=eq.${CENTRE_ID}&is_active=eq.true`);
    const data = await res.json();
    expect(data.length).toBeGreaterThan(5);
  });

  test('11.6 Centres active', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_centres',
      'id,name,is_active', `is_active=eq.true`);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════
// FLOW 12: CROSS-MODULE JOIN INTEGRITY
// ═══════════════════════════════════════════════════════
test.describe('Flow 12: Cross-Module JOINs', () => {
  test('12.1 Lab orders JOIN patients', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_lab_orders',
      'id,test_name,patient:hmis_patients!inner(first_name,uhid)',
      `centre_id=eq.${CENTRE_ID}&limit=3`);
    expect(res.status()).toBe(200);
  });

  test('12.2 Radiology orders JOIN patients + test master', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_radiology_orders',
      'id,test_name,patient:hmis_patients!inner(first_name,uhid),test:hmis_radiology_test_master(test_name,modality)',
      `centre_id=eq.${CENTRE_ID}&limit=3`);
    expect(res.status()).toBe(200);
  });

  test('12.3 Bills JOIN patients', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_bills',
      'id,bill_number,net_amount,patient:hmis_patients!inner(first_name,uhid)',
      `centre_id=eq.${CENTRE_ID}&limit=3`);
    expect(res.status()).toBe(200);
  });

  test('12.4 OPD visits JOIN patients + doctors', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_opd_visits',
      'id,status,patient:hmis_patients!inner(first_name,uhid),doctor:hmis_staff!hmis_opd_visits_doctor_id_fkey(full_name)',
      `centre_id=eq.${CENTRE_ID}&limit=3`);
    expect(res.status()).toBe(200);
  });

  test('12.5 Admissions JOIN patients + beds', async ({ request }) => {
    const res = await supabaseGet(request, 'hmis_admissions',
      'id,ipd_number,status,patient:hmis_patients!inner(first_name,uhid)',
      `centre_id=eq.${CENTRE_ID}&limit=3`);
    expect(res.status()).toBe(200);
  });
});

// ═══════════════════════════════════════════════════════
// CLEANUP — remove all test records
// ═══════════════════════════════════════════════════════
test.describe('Cleanup', () => {
  test('Remove test data', async ({ request }) => {
    // Delete in reverse dependency order
    if (testPaymentId) await supabaseDelete(request, 'hmis_payments', `receipt_number=like.REC-E2E-${timestamp}*`);
    if (testBillId) {
      await supabaseDelete(request, 'hmis_bill_items', `bill_id=eq.${testBillId}`);
      await supabaseDelete(request, 'hmis_bills', `id=eq.${testBillId}`);
    }
    for (const cid of testChargeIds) {
      await supabaseDelete(request, 'hmis_charge_log', `id=eq.${cid}`);
    }
    await supabaseDelete(request, 'hmis_charge_log', `patient_id=eq.${testPatientId}`);
    await supabaseDelete(request, 'hmis_lab_results', `lab_order_id=in.(${testLabOrderIds.join(',')})`);
    for (const lid of testLabOrderIds) {
      await supabaseDelete(request, 'hmis_lab_orders', `id=eq.${lid}`);
    }
    if (testRadOrderId) {
      await supabaseDelete(request, 'hmis_radiology_reports', `radiology_order_id=eq.${testRadOrderId}`);
      await supabaseDelete(request, 'hmis_radiology_orders', `id=eq.${testRadOrderId}`);
    }
    if (testPharmacyId) await supabaseDelete(request, 'hmis_pharmacy_dispensing', `id=eq.${testPharmacyId}`);
    if (testAdmissionId) await supabaseDelete(request, 'hmis_admissions', `id=eq.${testAdmissionId}`);
    if (testEncounterId) await supabaseDelete(request, 'hmis_emr_encounters', `id=eq.${testEncounterId}`);
    if (testOPDVisitId) await supabaseDelete(request, 'hmis_opd_visits', `id=eq.${testOPDVisitId}`);
    if (testPatientId) await supabaseDelete(request, 'hmis_patients', `id=eq.${testPatientId}`);
  });
});
