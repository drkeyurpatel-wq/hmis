// lib/bridge/module-events.ts
// ============================================================
// CROSS-MODULE EVENT BRIDGE
// Every function here connects Module A's action to Module B's reaction.
// Called from hooks AFTER the primary action succeeds.
// No circular deps — only uses sb() directly.
// ============================================================

import { sb } from '@/lib/supabase/browser';

// ============================================================
// WORKFLOW 1: OT Booking → Surgical Planning auto-create
// Called from: OT hooks after booking is created
// ============================================================
export async function onOTBookingCreated(params: {
  centreId: string; otBookingId: string; admissionId: string;
  patientId: string; surgeonId?: string; scheduledDate: string;
  procedureName: string; staffId: string;
}) {
  if (!sb()) return;
  // Check if planning case already exists for this booking
  const { data: existing } = await sb()!.from('hmis_surgical_planning')
    .select('id').eq('ot_booking_id', params.otBookingId).maybeSingle();
  if (existing) return; // already exists

  // Create planning case
  const { data: plan } = await sb()!.from('hmis_surgical_planning').insert({
    centre_id: params.centreId, ot_booking_id: params.otBookingId,
    admission_id: params.admissionId, patient_id: params.patientId,
    surgeon_id: params.surgeonId || null, planned_date: params.scheduledDate,
    procedure_name: params.procedureName, priority: 'routine',
    overall_status: 'planning', readiness_pct: 0, created_by: params.staffId,
  }).select('id').single();

  if (!plan) return;

  // Seed default checklist
  const items = [
    { category: 'pre_op_investigation', item_name: 'CBC, BMP, Coagulation panel ordered', is_mandatory: true, sort_order: 1 },
    { category: 'pre_op_investigation', item_name: 'Chest X-ray / ECG done', is_mandatory: true, sort_order: 2 },
    { category: 'pre_op_investigation', item_name: 'All investigation results received', is_mandatory: true, sort_order: 3 },
    { category: 'anaesthesia_fitness', item_name: 'Pre-anaesthesia check-up (PAC) done', is_mandatory: true, sort_order: 4 },
    { category: 'anaesthesia_fitness', item_name: 'ASA grade documented', is_mandatory: true, sort_order: 5 },
    { category: 'insurance_preauth', item_name: 'Pre-authorisation submitted', is_mandatory: false, sort_order: 6 },
    { category: 'insurance_preauth', item_name: 'Pre-authorisation approved', is_mandatory: false, sort_order: 7 },
    { category: 'consent', item_name: 'Surgical consent signed', is_mandatory: true, sort_order: 8 },
    { category: 'consent', item_name: 'Anaesthesia consent signed', is_mandatory: true, sort_order: 9 },
    { category: 'blood_arrangement', item_name: 'Blood group & cross-match done', is_mandatory: true, sort_order: 10 },
    { category: 'cssd_booking', item_name: 'CSSD instrument set booked', is_mandatory: true, sort_order: 11 },
    { category: 'ot_slot', item_name: 'OT slot confirmed', is_mandatory: true, sort_order: 12 },
    { category: 'bed_reservation', item_name: 'Post-op bed/ICU reserved', is_mandatory: true, sort_order: 13 },
  ].map(i => ({ ...i, planning_id: plan.id, centre_id: params.centreId }));
  await sb()!.from('hmis_surgical_checklist_items').insert(items);
}

// ============================================================
// WORKFLOW 1: Lab result → auto-check surgical planning checklist
// Called from: Lab hooks after result is verified
// ============================================================
export async function onLabResultVerified(params: {
  centreId: string; patientId: string; admissionId?: string; labOrderId: string;
}) {
  if (!sb() || !params.admissionId) return;
  // Find active surgical planning for this admission
  const { data: plans } = await sb()!.from('hmis_surgical_planning')
    .select('id').eq('admission_id', params.admissionId).in('overall_status', ['planning', 'blocked']);
  if (!plans || plans.length === 0) return;

  for (const plan of plans) {
    // Auto-mark investigation items that mention "results received"
    await sb()!.from('hmis_surgical_checklist_items')
      .update({ status: 'done', actual_date: new Date().toISOString().split('T')[0], completed_at: new Date().toISOString() })
      .eq('planning_id', plan.id).eq('category', 'pre_op_investigation')
      .ilike('item_name', '%results received%').eq('status', 'pending');
    await recalcPlanningReadiness(plan.id);
  }
}

// ============================================================
// WORKFLOW 1: Pre-auth approved → auto-check surgical planning
// Called from: Insurance hooks after pre-auth status changes
// ============================================================
export async function onPreAuthStatusChanged(params: {
  centreId: string; admissionId: string; status: string; approvedAmount?: number;
}) {
  if (!sb()) return;
  if (params.status !== 'approved') return;

  const { data: plans } = await sb()!.from('hmis_surgical_planning')
    .select('id').eq('admission_id', params.admissionId).in('overall_status', ['planning', 'blocked']);
  if (!plans || plans.length === 0) return;

  for (const plan of plans) {
    await sb()!.from('hmis_surgical_checklist_items')
      .update({ status: 'done', actual_date: new Date().toISOString().split('T')[0], completed_at: new Date().toISOString(),
        remarks: params.approvedAmount ? `Approved: ₹${params.approvedAmount}` : 'Approved' })
      .eq('planning_id', plan.id).eq('category', 'insurance_preauth')
      .ilike('item_name', '%approved%').in('status', ['pending', 'in_progress']);
    await recalcPlanningReadiness(plan.id);
  }
}

// ============================================================
// WORKFLOW 1: Consent signed → auto-check surgical planning
// Called from: Digital consent hooks after consent finalized
// ============================================================
export async function onConsentFinalized(params: {
  centreId: string; admissionId?: string; otBookingId?: string; consentType: string;
}) {
  if (!sb()) return;
  const matchField = params.otBookingId ? 'ot_booking_id' : 'admission_id';
  const matchVal = params.otBookingId || params.admissionId;
  if (!matchVal) return;

  const { data: plans } = await sb()!.from('hmis_surgical_planning')
    .select('id').eq(matchField, matchVal).in('overall_status', ['planning', 'blocked']);
  if (!plans || plans.length === 0) return;

  const keyword = params.consentType === 'anaesthesia' ? 'anaesthesia consent' : 'surgical consent';
  for (const plan of plans) {
    await sb()!.from('hmis_surgical_checklist_items')
      .update({ status: 'done', actual_date: new Date().toISOString().split('T')[0], completed_at: new Date().toISOString() })
      .eq('planning_id', plan.id).eq('category', 'consent')
      .ilike('item_name', `%${keyword}%`).in('status', ['pending', 'in_progress']);
    await recalcPlanningReadiness(plan.id);
  }
}

// ============================================================
// WORKFLOW 1: CSSD instrument issued → auto-check surgical planning
// Called from: CSSD hooks after issue
// ============================================================
export async function onCSSDIssued(params: {
  centreId: string; otBookingId?: string; surgeryName?: string;
}) {
  if (!sb() || !params.surgeryName) return;
  // Try to find planning by procedure name match
  const { data: plans } = await sb()!.from('hmis_surgical_planning')
    .select('id').eq('centre_id', params.centreId)
    .ilike('procedure_name', `%${params.surgeryName}%`)
    .in('overall_status', ['planning', 'blocked']);
  if (!plans || plans.length === 0) return;

  for (const plan of plans) {
    await sb()!.from('hmis_surgical_checklist_items')
      .update({ status: 'done', actual_date: new Date().toISOString().split('T')[0], completed_at: new Date().toISOString() })
      .eq('planning_id', plan.id).eq('category', 'cssd_booking')
      .in('status', ['pending', 'in_progress']);
    await recalcPlanningReadiness(plan.id);
  }
}

// ============================================================
// WORKFLOW 1: OT completed → auto-post charges + mark planning complete
// Called from: OT hooks after surgery status = completed
// ============================================================
export async function onOTCompleted(params: {
  centreId: string; otBookingId: string; admissionId: string;
  patientId: string; procedureName: string; staffId: string;
  surgeonCharges: number; anaesthetistCharges: number; otCharges: number;
}) {
  if (!sb()) return;
  // Post OT charges to billing
  const charges = [
    { desc: `OT: ${params.procedureName} (Surgeon)`, category: 'ot_charges', amount: params.surgeonCharges },
    { desc: `OT: ${params.procedureName} (Anaesthetist)`, category: 'ot_charges', amount: params.anaesthetistCharges },
    { desc: `OT: ${params.procedureName} (OT charges)`, category: 'ot_charges', amount: params.otCharges },
  ].filter(c => c.amount > 0);

  for (const c of charges) {
    await sb()!.from('hmis_charge_log').insert({
      centre_id: params.centreId, patient_id: params.patientId,
      admission_id: params.admissionId,
      description: c.desc, category: c.category, quantity: 1,
      unit_rate: c.amount, amount: c.amount,
      source: 'ot', source_ref_id: params.otBookingId, source_ref_type: 'ot_booking',
      captured_by: params.staffId, service_date: new Date().toISOString().split('T')[0],
      status: 'captured',
    });
  }

  // Mark surgical planning as completed
  await sb()!.from('hmis_surgical_planning')
    .update({ overall_status: 'completed', readiness_pct: 100, updated_at: new Date().toISOString() })
    .eq('ot_booking_id', params.otBookingId);
}

// ============================================================
// WORKFLOW 2: Discharge confirmed → auto-trigger bed turnover
// Called from: Discharge engine / IPD after admission status → discharged
// ============================================================
export async function onDischargeConfirmed(params: {
  centreId: string; admissionId: string; bedId: string;
  roomId?: string; wardId?: string; staffId: string;
}) {
  if (!sb()) return;
  // Check not already triggered
  const { data: existing } = await sb()!.from('hmis_bed_turnover')
    .select('id').eq('discharged_admission_id', params.admissionId).maybeSingle();
  if (existing) return;

  // Create bed turnover
  const hkChecklist = [
    { item: 'Bed stripped & linen removed', done: false },
    { item: 'Mattress sanitized', done: false },
    { item: 'Bed frame wiped down', done: false },
    { item: 'Fresh linen placed', done: false },
    { item: 'Bathroom cleaned', done: false },
    { item: 'Floor mopped', done: false },
    { item: 'Equipment checked & functional', done: false },
    { item: 'Bedside table sanitized', done: false },
    { item: 'Waste bin replaced', done: false },
    { item: 'Call bell tested', done: false },
  ];

  const { data: turnover } = await sb()!.from('hmis_bed_turnover').insert({
    centre_id: params.centreId, bed_id: params.bedId,
    room_id: params.roomId || null, ward_id: params.wardId || null,
    discharged_admission_id: params.admissionId,
    discharge_confirmed_by: params.staffId,
    hk_checklist: hkChecklist,
  }).select('id').single();

  if (!turnover) return;

  // Auto-create housekeeping task
  const { data: bedInfo } = await sb()!.from('hmis_beds')
    .select('bed_number, room:hmis_rooms(name, ward:hmis_wards(name))')
    .eq('id', params.bedId).single();
  const b = bedInfo as any;
  const areaName = `${b?.room?.ward?.name || 'Ward'} - ${b?.room?.name || 'Room'} - Bed ${b?.bed_number || '?'}`;

  const { data: hkTask } = await sb()!.from('hmis_housekeeping_tasks').insert({
    centre_id: params.centreId, task_type: 'discharge', area_type: 'room',
    area_name: areaName, bed_id: params.bedId, room_id: params.roomId || null,
    priority: 'high', requested_by: params.staffId, checklist: hkChecklist,
  }).select('id').single();

  if (hkTask) {
    await sb()!.from('hmis_bed_turnover').update({ hk_task_id: hkTask.id }).eq('id', turnover.id);
  }

  // Set bed to cleaning
  await sb()!.from('hmis_beds').update({ status: 'cleaning', current_admission_id: null }).eq('id', params.bedId);
}

// ============================================================
// WORKFLOW 2: Admission → auto-create default diet order
// Called from: IPD hooks after admission created
// ============================================================
export async function onAdmissionCreated(params: {
  centreId: string; admissionId: string; patientId: string; staffId: string;
}) {
  if (!sb()) return;
  // Create default general diet order
  await sb()!.from('hmis_diet_orders').insert({
    centre_id: params.centreId, admission_id: params.admissionId,
    patient_id: params.patientId, diet_type: 'normal',
    meal_preference: 'vegetarian', allergies: [],
    special_instructions: '', status: 'active', ordered_by: params.staffId,
  });
}

// ============================================================
// WORKFLOW 3: Lab critical alert → push to nursing station
// Called from: Lab hooks after critical result detected
// ============================================================
export async function onLabCriticalResult(params: {
  centreId: string; patientId: string; admissionId?: string;
  parameterName: string; resultValue: string; labOrderId: string;
}) {
  if (!sb()) return;
  // Insert into clinical_alerts (nursing station reads this)
  await sb()!.from('hmis_clinical_alerts').insert({
    centre_id: params.centreId, patient_id: params.patientId,
    admission_id: params.admissionId || null,
    alert_type: 'lab_critical', severity: 'high',
    message: `CRITICAL LAB: ${params.parameterName} = ${params.resultValue}`,
    source: 'lab', source_ref_id: params.labOrderId,
    status: 'active',
  });

  // Also insert notification log for push
  await sb()!.from('hmis_notification_log').insert({
    centre_id: params.centreId, type: 'lab_critical',
    title: `Critical Result: ${params.parameterName}`,
    body: `Patient lab result critical — ${params.parameterName}: ${params.resultValue}`,
    target_type: 'ward', target_id: params.admissionId || params.patientId,
    status: 'pending',
  });
}

// ============================================================
// WORKFLOW 3: Pharmacy dispensed → auto-update MAR
// Called from: Pharmacy hooks after dispensing
// ============================================================
export async function onPharmacyDispensed(params: {
  centreId: string; patientId: string; admissionId: string;
  drugName: string; dose: string; route: string; frequency: string;
  dispensingId: string; staffId: string;
}) {
  if (!sb() || !params.admissionId) return;
  // Find matching medication order
  const { data: medOrder } = await sb()!.from('hmis_ipd_medication_orders')
    .select('id').eq('admission_id', params.admissionId)
    .ilike('drug_name', `%${params.drugName}%`).eq('status', 'active')
    .limit(1).maybeSingle();

  if (medOrder) {
    // Insert MAR entry
    await sb()!.from('hmis_mar').insert({
      admission_id: params.admissionId, medication_order_id: medOrder.id,
      drug_name: params.drugName, dose: params.dose, route: params.route,
      scheduled_time: new Date().toISOString(),
      status: 'dispensed', administered_by: null, // Nurse will confirm
      notes: `Auto-linked from pharmacy dispense ${params.dispensingId}`,
    });
  }
}

// ============================================================
// WORKFLOW 3: Radiology report done → notify ordering doctor
// Called from: Radiology hooks after report verified
// ============================================================
export async function onRadiologyReportVerified(params: {
  centreId: string; patientId: string; radiologyOrderId: string;
  testName: string; orderedBy?: string;
}) {
  if (!sb()) return;
  await sb()!.from('hmis_notification_log').insert({
    centre_id: params.centreId, type: 'radiology_ready',
    title: `Radiology Report Ready: ${params.testName}`,
    body: `Report for ${params.testName} is verified and ready for review.`,
    target_type: 'staff', target_id: params.orderedBy || '',
    status: 'pending',
  });
}

// ============================================================
// WORKFLOW 4: Get on-duty staff for a ward (Nursing reads Roster)
// Utility function — called from nursing station hooks
// ============================================================
export async function getOnDutyStaff(centreId: string, wardId: string): Promise<{
  staffId: string; fullName: string; staffType: string; shiftType: string;
}[]> {
  if (!sb()) return [];
  const today = new Date().toISOString().split('T')[0];
  const hour = new Date().getHours();
  // Determine current shift
  const shiftType = hour >= 8 && hour < 14 ? 'morning' : hour >= 14 && hour < 20 ? 'afternoon' : 'night';

  const { data } = await sb()!.from('hmis_duty_roster')
    .select('staff_id, shift_type, staff:hmis_staff!hmis_duty_roster_staff_id_fkey(full_name, staff_type)')
    .eq('centre_id', centreId).eq('ward_id', wardId).eq('roster_date', today)
    .in('shift_type', [shiftType, 'general']);
  return (data || []).map((r: any) => ({
    staffId: r.staff_id, fullName: r.staff?.full_name || '?',
    staffType: r.staff?.staff_type || '', shiftType: r.shift_type,
  }));
}

// ============================================================
// WORKFLOW 5: Equipment breakdown → flag affected OT bookings
// Called from: Equipment lifecycle hooks after breakdown logged
// ============================================================
export async function onEquipmentBreakdown(params: {
  centreId: string; equipmentId: string; equipmentName: string;
  location: string; severity: string; staffId: string;
}) {
  if (!sb()) return;
  // Find OT rooms that match this equipment location
  const { data: otRooms } = await sb()!.from('hmis_ot_rooms')
    .select('id, name').eq('centre_id', params.centreId)
    .ilike('name', `%${params.location}%`);
  if (!otRooms || otRooms.length === 0) return;

  const roomIds = otRooms.map(r => r.id);
  const today = new Date().toISOString().split('T')[0];
  const nextWeek = new Date(); nextWeek.setDate(nextWeek.getDate() + 7);

  // Find upcoming OT bookings in affected rooms
  const { data: bookings } = await sb()!.from('hmis_ot_bookings')
    .select('id, procedure_name, scheduled_date, surgeon_id')
    .in('ot_room_id', roomIds).gte('scheduled_date', today)
    .lte('scheduled_date', nextWeek.toISOString().split('T')[0])
    .in('status', ['scheduled', 'confirmed']);

  if (!bookings || bookings.length === 0) return;

  // Create notification for each affected booking
  for (const b of bookings) {
    await sb()!.from('hmis_notification_log').insert({
      centre_id: params.centreId, type: 'equipment_impact',
      title: `Equipment Down: ${params.equipmentName}`,
      body: `${params.equipmentName} is down in ${params.location}. OT booking "${b.procedure_name}" on ${b.scheduled_date} may be affected.`,
      target_type: 'staff', target_id: b.surgeon_id || params.staffId,
      status: 'pending',
    });
  }

  // Also notify management for critical equipment
  if (params.severity === 'critical') {
    await sb()!.from('hmis_notification_log').insert({
      centre_id: params.centreId, type: 'equipment_critical',
      title: `CRITICAL: ${params.equipmentName} DOWN`,
      body: `${params.equipmentName} is down. ${bookings.length} upcoming OT bookings may be affected. Immediate action required.`,
      target_type: 'role', target_id: 'admin',
      status: 'pending',
    });
  }
}

// ============================================================
// WORKFLOW 6: Discharge → auto-generate insurance claim
// Called from: Billing after final bill is created for insured patient
// ============================================================
export async function onFinalBillCreatedForInsured(params: {
  centreId: string; admissionId: string; billId: string;
  patientInsuranceId?: string; netAmount: number; staffId: string;
}) {
  if (!sb() || !params.patientInsuranceId) return;
  // Check if pre-auth exists
  const { data: preAuth } = await sb()!.from('hmis_pre_auth_requests')
    .select('id, pre_auth_number, approved_amount')
    .eq('admission_id', params.admissionId).eq('status', 'approved')
    .limit(1).maybeSingle();

  // Create claim
  await sb()!.from('hmis_claims').insert({
    centre_id: params.centreId, bill_id: params.billId,
    pre_auth_id: preAuth?.id || null,
    pre_auth_number: preAuth?.pre_auth_number || null,
    claimed_amount: params.netAmount,
    approved_amount: preAuth?.approved_amount || 0,
    status: 'submitted', submitted_at: new Date().toISOString(),
    submitted_by: params.staffId,
  });
}

// ============================================================
// HELPER: Recalculate surgical planning readiness %
// ============================================================
async function recalcPlanningReadiness(planningId: string) {
  if (!sb()) return;
  const { data: items } = await sb()!.from('hmis_surgical_checklist_items')
    .select('is_mandatory, status').eq('planning_id', planningId);
  if (!items || items.length === 0) return;
  const mandatory = items.filter(i => i.is_mandatory);
  const done = mandatory.filter(i => i.status === 'done' || i.status === 'waived').length;
  const pct = mandatory.length > 0 ? Math.round((done / mandatory.length) * 100 * 100) / 100 : 100;
  const hasBlocker = mandatory.some(i => i.status === 'blocked');
  const allDone = mandatory.every(i => i.status === 'done' || i.status === 'waived');
  const status = hasBlocker ? 'blocked' : allDone ? 'ready' : 'planning';
  await sb()!.from('hmis_surgical_planning').update({
    readiness_pct: pct, overall_status: status, updated_at: new Date().toISOString(),
  }).eq('id', planningId);
}
