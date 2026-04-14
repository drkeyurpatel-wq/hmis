// @ts-nocheck
// HEALTH1 HMIS — BILLING ENGINE — Core calculation logic, rate lookups, auto-charge
import { sb } from '@/lib/supabase/browser';
import type { BillingEncounter, BillingLineItem, ServiceMaster, RateCard, BillingPackage, BedChargeRule, DiscountScheme, PayorType, ServiceCategory, DiscountType, LineSource, EncounterType, AddLineItemForm, RecordPaymentForm, BillingDashboardStats } from '@/lib/billing/billing-v2-types';

const supabase = () => sb;

export async function getServiceRate(centreId: string, serviceMasterId: string, payorType: PayorType = 'SELF_PAY', payorId?: string | null): Promise<{ rate: number; source: 'RATE_CARD' | 'BASE_RATE'; rateCardId?: string }> {
  const today = new Date().toISOString().split('T')[0];
  let query = supabase().from('billing_rate_cards').select('id, rate').eq('centre_id', centreId).eq('service_master_id', serviceMasterId).eq('payor_type', payorType).eq('is_active', true).lte('effective_from', today).order('effective_from', { ascending: false }).limit(1);
  if (payorId) query = query.eq('payor_id', payorId); else query = query.is('payor_id', null);
  const { data: rateCards } = await query;
  if (rateCards && rateCards.length > 0) return { rate: rateCards[0].rate, source: 'RATE_CARD', rateCardId: rateCards[0].id };
  const { data: service } = await supabase().from('billing_service_masters').select('base_rate').eq('id', serviceMasterId).single();
  return { rate: service?.base_rate ?? 0, source: 'BASE_RATE' };
}

export async function searchServices(centreId: string, searchTerm: string, payorType: PayorType = 'SELF_PAY', department?: string, limit: number = 20): Promise<Array<ServiceMaster & { effective_rate: number }>> {
  let query = supabase().from('billing_service_masters').select('*').eq('centre_id', centreId).eq('is_active', true).or(`service_name.ilike.%${searchTerm}%,service_code.ilike.%${searchTerm}%`).order('sort_order', { ascending: true }).limit(limit);
  if (department) query = query.eq('department', department);
  const { data: services, error } = await query;
  if (error || !services) return [];
  return await Promise.all(services.map(async (svc) => { const { rate } = await getServiceRate(centreId, svc.id, payorType); return { ...svc, effective_rate: rate }; }));
}

export async function createEncounter(params: { centreId: string; patientId: string; encounterType: EncounterType; payorType: PayorType; userId: string; consultingDoctorId?: string; admittingDoctorId?: string; admissionId?: string; bedId?: string; appointmentId?: string; insuranceCompanyId?: string; tpaId?: string; policyNumber?: string; cardNumber?: string; packageId?: string; expectedDischargeDate?: string; }): Promise<BillingEncounter> {
  const centrePrefix = await getCentrePrefix(params.centreId);
  const { data: encNumber } = await supabase().rpc('billing_next_number', { p_centre_id: params.centreId, p_sequence_type: 'ENCOUNTER', p_prefix: `${centrePrefix}-${params.encounterType}` });
  const d: any = { centre_id: params.centreId, patient_id: params.patientId, encounter_type: params.encounterType, encounter_number: encNumber, primary_payor_type: params.payorType, status: 'OPEN', created_by: params.userId };
  if (params.encounterType === 'OPD') { d.consulting_doctor_id = params.consultingDoctorId || null; d.appointment_id = params.appointmentId || null; d.visit_date = new Date().toISOString(); }
  if (['IPD','ER','DAYCARE'].includes(params.encounterType)) { d.admitting_doctor_id = params.admittingDoctorId || null; d.admission_id = params.admissionId || null; d.bed_id = params.bedId || null; d.admission_date = new Date().toISOString(); d.expected_discharge_date = params.expectedDischargeDate || null; }
  if (params.payorType !== 'SELF_PAY') { d.insurance_company_id = params.insuranceCompanyId || null; d.tpa_id = params.tpaId || null; d.insurance_policy_number = params.policyNumber || null; d.insurance_card_number = params.cardNumber || null; d.package_id = params.packageId || null; }
  const { data, error } = await supabase().from('billing_encounters').insert(d).select().single();
  if (error) throw new Error(`Failed to create encounter: ${error.message}`);
  await logBillingAudit('billing_encounters', data.id, 'CREATE', null, data, params.userId);
  return data;
}

export async function getEncounterDetail(encounterId: string): Promise<BillingEncounter | null> {
  const { data: enc, error } = await supabase().from('billing_encounters').select(`*, billing_line_items(*), billing_payments(*), billing_invoices(*), billing_pre_auths(*), billing_tpa_masters!billing_encounters_tpa_id_fkey(tpa_name, tpa_code), billing_insurance_companies!billing_encounters_insurance_company_id_fkey(company_name, company_code), billing_packages!billing_encounters_package_id_fkey(package_name, package_code, base_price, inclusions)`).eq('id', encounterId).single();
  if (error || !enc) return null;
  return { ...enc, tpa: enc.billing_tpa_masters || undefined, insurance_company: enc.billing_insurance_companies || undefined, package: enc.billing_packages || undefined, line_items: (enc.billing_line_items || []).filter((li: any) => li.status === 'ACTIVE').sort((a: any, b: any) => new Date(a.service_date).getTime() - new Date(b.service_date).getTime()), payments: (enc.billing_payments || []).filter((p: any) => p.status === 'COMPLETED').sort((a: any, b: any) => new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime()), invoices: enc.billing_invoices || [], pre_auth: enc.billing_pre_auths?.[0] || undefined } as BillingEncounter;
}

export async function addLineItem(params: { encounterId: string; centreId: string; serviceMasterId: string; quantity: number; unitRate?: number; serviceDoctorId?: string; referringDoctorId?: string; orderingDoctorId?: string; sourceType?: LineSource; sourceId?: string; discountType?: DiscountType; discountValue?: number; serviceDate?: string; userId: string; }): Promise<BillingLineItem> {
  const { data: service } = await supabase().from('billing_service_masters').select('*').eq('id', params.serviceMasterId).single();
  if (!service) throw new Error('Service not found');
  const { data: encounter } = await supabase().from('billing_encounters').select('primary_payor_type, primary_payor_id, package_id, billing_locked').eq('id', params.encounterId).single();
  if (!encounter) throw new Error('Encounter not found');
  if (encounter.billing_locked) throw new Error('Encounter is locked');
  let unitRate = params.unitRate;
  if (unitRate === undefined) { const r = await getServiceRate(params.centreId, params.serviceMasterId, encounter.primary_payor_type, encounter.primary_payor_id); unitRate = r.rate; }
  const grossAmount = roundToTwo(params.quantity * unitRate);
  let discountAmount = 0;
  if (params.discountType && params.discountValue) { if (params.discountType === 'PERCENTAGE') discountAmount = roundToTwo(grossAmount * params.discountValue / 100); else if (params.discountType === 'FLAT') discountAmount = roundToTwo(Math.min(params.discountValue, grossAmount)); }
  let coveredByPackage = false;
  if (encounter.package_id) { coveredByPackage = await isServiceCoveredByPackage(encounter.package_id, params.serviceMasterId, service.service_category); if (coveredByPackage) discountAmount = grossAmount; }
  let taxAmount = 0;
  if (service.gst_applicable && service.gst_percentage > 0) taxAmount = roundToTwo((grossAmount - discountAmount) * service.gst_percentage / 100);
  const netAmount = roundToTwo(grossAmount - discountAmount + taxAmount);
  const lid = { encounter_id: params.encounterId, centre_id: params.centreId, service_master_id: params.serviceMasterId, service_code: service.service_code, service_name: service.service_name, department: service.department, service_category: service.service_category, quantity: params.quantity, unit_rate: unitRate, gross_amount: grossAmount, discount_type: params.discountType || null, discount_value: params.discountValue || 0, discount_amount: discountAmount, tax_percentage: service.gst_applicable ? service.gst_percentage : 0, tax_amount: taxAmount, net_amount: netAmount, service_doctor_id: params.serviceDoctorId || null, referring_doctor_id: params.referringDoctorId || null, ordering_doctor_id: params.orderingDoctorId || null, source_type: params.sourceType || 'MANUAL', source_id: params.sourceId || null, is_package_item: coveredByPackage, package_id: coveredByPackage ? encounter.package_id : null, covered_by_package: coveredByPackage, service_date: params.serviceDate || new Date().toISOString(), status: 'ACTIVE', created_by: params.userId };
  const { data, error } = await supabase().from('billing_line_items').insert(lid).select().single();
  if (error) throw new Error(`Failed to add line item: ${error.message}`);
  await logBillingAudit('billing_line_items', data.id, 'CREATE', null, data, params.userId);
  return data;
}

export async function cancelLineItem(lineItemId: string, reason: string, userId: string): Promise<void> {
  const { data: existing } = await supabase().from('billing_line_items').select('*').eq('id', lineItemId).single();
  if (!existing) throw new Error('Line item not found');
  const { error } = await supabase().from('billing_line_items').update({ status: 'CANCELLED', cancel_reason: reason, cancelled_by: userId, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', lineItemId);
  if (error) throw new Error(`Failed to cancel: ${error.message}`);
  await logBillingAudit('billing_line_items', lineItemId, 'CANCEL', existing, { status: 'CANCELLED', cancel_reason: reason }, userId);
}

export async function recordPayment(params: { encounterId: string; centreId: string; patientId: string; amount: number; paymentMode: string; paymentType: string; paymentReference?: string; cardLastFour?: string; upiId?: string; bankName?: string; invoiceId?: string; isAdvance?: boolean; userId: string; }): Promise<any> {
  const centrePrefix = await getCentrePrefix(params.centreId);
  const { data: receiptNumber } = await supabase().rpc('billing_next_number', { p_centre_id: params.centreId, p_sequence_type: 'RECEIPT', p_prefix: `${centrePrefix}-RCP` });
  const pd = { encounter_id: params.encounterId, invoice_id: params.invoiceId || null, centre_id: params.centreId, patient_id: params.patientId, receipt_number: receiptNumber, payment_date: new Date().toISOString(), amount: params.amount, payment_mode: params.paymentMode, payment_reference: params.paymentReference || null, card_last_four: params.cardLastFour || null, upi_id: params.upiId || null, bank_name: params.bankName || null, payment_type: params.paymentType, is_advance: params.isAdvance || false, advance_balance: params.isAdvance ? params.amount : 0, status: 'COMPLETED', created_by: params.userId };
  const { data, error } = await supabase().from('billing_payments').insert(pd).select().single();
  if (error) throw new Error(`Failed to record payment: ${error.message}`);
  await logBillingAudit('billing_payments', data.id, 'CREATE', null, data, params.userId);
  return data;
}

export async function generateInvoice(params: { encounterId: string; centreId: string; patientId: string; invoiceType: string; userId: string; lineItemIds?: string[]; }): Promise<any> {
  let query = supabase().from('billing_line_items').select('*').eq('encounter_id', params.encounterId).eq('status', 'ACTIVE');
  if (params.lineItemIds?.length) query = query.in('id', params.lineItemIds);
  const { data: lineItems } = await query;
  if (!lineItems?.length) throw new Error('No billable items found');
  const subtotal = lineItems.reduce((s, li) => s + li.gross_amount, 0);
  const totalDiscount = lineItems.reduce((s, li) => s + li.discount_amount, 0);
  const totalTax = lineItems.reduce((s, li) => s + li.tax_amount, 0);
  const grandTotal = lineItems.reduce((s, li) => s + li.net_amount, 0);
  const { data: enc } = await supabase().from('billing_encounters').select('total_paid').eq('id', params.encounterId).single();
  const amountPaid = enc?.total_paid || 0;
  const balanceDue = roundToTwo(grandTotal - amountPaid);
  const centrePrefix = await getCentrePrefix(params.centreId);
  const { data: invoiceNumber } = await supabase().rpc('billing_next_number', { p_centre_id: params.centreId, p_sequence_type: 'INVOICE', p_prefix: `${centrePrefix}-INV` });
  const id = { encounter_id: params.encounterId, centre_id: params.centreId, patient_id: params.patientId, invoice_number: invoiceNumber, invoice_type: params.invoiceType, invoice_date: new Date().toISOString(), subtotal: roundToTwo(subtotal), total_discount: roundToTwo(totalDiscount), total_tax: roundToTwo(totalTax), grand_total: roundToTwo(grandTotal), amount_paid: roundToTwo(amountPaid), balance_due: roundToTwo(balanceDue), status: balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'GENERATED', created_by: params.userId };
  const { data: invoice, error } = await supabase().from('billing_invoices').insert(id).select().single();
  if (error) throw new Error(`Failed to generate invoice: ${error.message}`);
  await supabase().from('billing_invoice_line_items').insert(lineItems.map(li => ({ invoice_id: invoice.id, line_item_id: li.id, amount: li.net_amount })));
  const newStatus = params.invoiceType === 'IPD_FINAL' ? 'FINAL_BILLED' : 'INTERIM_BILLED';
  await supabase().from('billing_encounters').update({ status: newStatus, billing_locked: params.invoiceType === 'IPD_FINAL', updated_at: new Date().toISOString() }).eq('id', params.encounterId);
  await logBillingAudit('billing_invoices', invoice.id, 'CREATE', null, invoice, params.userId);
  return invoice;
}

export function calculatePMJAYMultipleSurgery(surgeryAmounts: number[]): Array<{ amount: number; percentage: number; payable: number }> {
  const sorted = [...surgeryAmounts].sort((a, b) => b - a);
  return sorted.map((amount, idx) => ({ amount, percentage: idx === 0 ? 100 : idx === 1 ? 50 : 25, payable: roundToTwo(amount * (idx === 0 ? 100 : idx === 1 ? 50 : 25) / 100) }));
}

export async function generateDailyBedCharges(centreId: string, chargeDate: string, userId: string): Promise<{ generated: number; errors: string[] }> {
  const errors: string[] = []; let generated = 0;
  const { data: encounters } = await supabase().from('billing_encounters').select('id, patient_id, bed_id, primary_payor_type, package_id').eq('centre_id', centreId).in('encounter_type', ['IPD','ER','DAYCARE']).eq('status', 'OPEN').not('bed_id', 'is', null);
  if (!encounters?.length) return { generated: 0, errors: [] };
  for (const enc of encounters) {
    try {
      const { data: existing } = await supabase().from('billing_line_items').select('id').eq('encounter_id', enc.id).eq('source_type', 'BED_CHARGE').gte('service_date', `${chargeDate}T00:00:00`).lt('service_date', `${chargeDate}T23:59:59`).eq('status', 'ACTIVE').limit(1);
      if (existing?.length) continue;
      const { data: bed } = await supabase().from('beds').select('room_category, ward_type').eq('id', enc.bed_id).single();
      if (!bed) { errors.push(`Bed not found for encounter ${enc.id}`); continue; }
      const { data: rules } = await supabase().from('billing_bed_charge_rules').select('*').eq('centre_id', centreId).eq('room_category', bed.room_category).eq('ward_type', bed.ward_type).eq('is_active', true).lte('effective_from', chargeDate).order('effective_from', { ascending: false }).limit(1);
      if (!rules?.length) { errors.push(`No bed charge rule for ${bed.room_category}/${bed.ward_type}`); continue; }
      const rule = rules[0];
      const bedSvc = await getOrCreateBedService(centreId, bed.room_category, bed.ward_type);
      if (bedSvc) { await addLineItem({ encounterId: enc.id, centreId, serviceMasterId: bedSvc.id, quantity: 1, unitRate: rule.charge_per_day, sourceType: 'BED_CHARGE', serviceDate: `${chargeDate}T00:00:00`, userId }); generated++; }
      if (rule.nursing_charge_per_day > 0) { const nursSvc = await getOrCreateNursingService(centreId, bed.ward_type); if (nursSvc) await addLineItem({ encounterId: enc.id, centreId, serviceMasterId: nursSvc.id, quantity: 1, unitRate: rule.nursing_charge_per_day, sourceType: 'NURSING', serviceDate: `${chargeDate}T00:00:00`, userId }); }
    } catch (err: any) { errors.push(`Error ${enc.id}: ${err.message}`); }
  }
  return { generated, errors };
}

export async function createPreAuth(params: { encounterId: string; centreId: string; patientId: string; insuranceCompanyId: string; tpaId?: string; policyNumber: string; memberId?: string; diagnosisCodes: Array<{ code: string; description: string }>; procedureCodes?: Array<{ code: string; description: string }>; treatingDoctorId?: string; clinicalNotes?: string; requestedAmount: number; requestedStayDays?: number; pmjayPackageCode?: string; pmjayPackageName?: string; userId: string; }): Promise<any> {
  const pd = { encounter_id: params.encounterId, centre_id: params.centreId, patient_id: params.patientId, insurance_company_id: params.insuranceCompanyId, tpa_id: params.tpaId || null, policy_number: params.policyNumber, member_id: params.memberId || null, diagnosis_codes: params.diagnosisCodes, procedure_codes: params.procedureCodes || [], treating_doctor_id: params.treatingDoctorId || null, clinical_notes: params.clinicalNotes || null, requested_amount: params.requestedAmount, requested_stay_days: params.requestedStayDays || null, request_date: new Date().toISOString(), pmjay_package_code: params.pmjayPackageCode || null, pmjay_package_name: params.pmjayPackageName || null, status: 'DRAFT', created_by: params.userId };
  const { data, error } = await supabase().from('billing_pre_auths').insert(pd).select().single();
  if (error) throw new Error(`Failed to create pre-auth: ${error.message}`);
  await supabase().from('billing_encounters').update({ pre_auth_id: data.id, updated_at: new Date().toISOString() }).eq('id', params.encounterId);
  await logBillingAudit('billing_pre_auths', data.id, 'CREATE', null, data, params.userId);
  return data;
}

export async function submitPreAuth(preAuthId: string, userId: string): Promise<void> {
  const { error } = await supabase().from('billing_pre_auths').update({ status: 'SUBMITTED', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', preAuthId);
  if (error) throw new Error(`Failed: ${error.message}`);
  await logBillingAudit('billing_pre_auths', preAuthId, 'SUBMIT', null, { status: 'SUBMITTED' }, userId);
}

export async function approvePreAuth(params: { preAuthId: string; approvedAmount: number; approvedStayDays?: number; approvalReference?: string; userId: string; }): Promise<void> {
  const { error } = await supabase().from('billing_pre_auths').update({ status: 'APPROVED', approved_amount: params.approvedAmount, approved_stay_days: params.approvedStayDays || null, approval_reference: params.approvalReference || null, approval_date: new Date().toISOString(), first_response_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', params.preAuthId);
  if (error) throw new Error(`Failed: ${error.message}`);
  const { data: pa } = await supabase().from('billing_pre_auths').select('encounter_id').eq('id', params.preAuthId).single();
  if (pa) await supabase().from('billing_encounters').update({ insurance_approved_amount: params.approvedAmount, updated_at: new Date().toISOString() }).eq('id', pa.encounter_id);
  await logBillingAudit('billing_pre_auths', params.preAuthId, 'APPROVE', null, { approved_amount: params.approvedAmount }, params.userId);
}

export async function createClaim(params: { encounterId: string; centreId: string; patientId: string; preAuthId?: string; insuranceCompanyId: string; tpaId?: string; claimedAmount: number; userId: string; }): Promise<any> {
  const centrePrefix = await getCentrePrefix(params.centreId);
  const { data: claimNumber } = await supabase().rpc('billing_next_number', { p_centre_id: params.centreId, p_sequence_type: 'CLAIM', p_prefix: `${centrePrefix}-CLM` });
  const cd = { encounter_id: params.encounterId, pre_auth_id: params.preAuthId || null, centre_id: params.centreId, patient_id: params.patientId, claim_number: claimNumber, insurance_company_id: params.insuranceCompanyId, tpa_id: params.tpaId || null, claimed_amount: params.claimedAmount, status: 'DRAFT', created_by: params.userId };
  const { data, error } = await supabase().from('billing_claims').insert(cd).select().single();
  if (error) throw new Error(`Failed: ${error.message}`);
  await logBillingAudit('billing_claims', data.id, 'CREATE', null, data, params.userId);
  return data;
}

export async function settleClaim(params: { claimId: string; settledAmount: number; deductionAmount: number; tdsAmount: number; deductionDetails: Array<{ reason: string; amount: number }>; settlementUtr: string; userId: string; }): Promise<void> {
  const netReceived = roundToTwo(params.settledAmount - params.tdsAmount);
  const { data: claim } = await supabase().from('billing_claims').select('encounter_id, claimed_amount, claim_submission_date, centre_id, patient_id').eq('id', params.claimId).single();
  let tatDays = null;
  if (claim?.claim_submission_date) tatDays = Math.round((Date.now() - new Date(claim.claim_submission_date).getTime()) / 86400000);
  const { error } = await supabase().from('billing_claims').update({ status: 'SETTLED', settled_amount: params.settledAmount, deduction_amount: params.deductionAmount, tds_amount: params.tdsAmount, net_received: netReceived, deduction_details: params.deductionDetails, settlement_utr: params.settlementUtr, settlement_date: new Date().toISOString(), payment_received_date: new Date().toISOString(), submission_to_settlement_days: tatDays, aging_bucket: 'SETTLED', updated_at: new Date().toISOString() }).eq('id', params.claimId);
  if (error) throw new Error(`Failed: ${error.message}`);
  if (claim) { await recordPayment({ encounterId: claim.encounter_id, centreId: claim.centre_id, patientId: claim.patient_id, amount: netReceived, paymentMode: 'INSURANCE_SETTLEMENT', paymentType: 'COLLECTION', paymentReference: params.settlementUtr, userId: params.userId }); await supabase().from('billing_encounters').update({ insurance_settled_amount: netReceived, updated_at: new Date().toISOString() }).eq('id', claim.encounter_id); }
  await logBillingAudit('billing_claims', params.claimId, 'UPDATE', null, { status: 'SETTLED', settled_amount: params.settledAmount }, params.userId);
}

export async function getDashboardStats(centreId: string): Promise<BillingDashboardStats> {
  const today = new Date().toISOString().split('T')[0];
  const { data: todayPayments } = await supabase().from('billing_payments').select('amount').eq('centre_id', centreId).eq('status', 'COMPLETED').gte('payment_date', `${today}T00:00:00`).lt('payment_date', `${today}T23:59:59`);
  const todayCollection = (todayPayments || []).reduce((s, p) => s + p.amount, 0);
  const { count: todayBills } = await supabase().from('billing_invoices').select('*', { count: 'exact', head: true }).eq('centre_id', centreId).gte('invoice_date', `${today}T00:00:00`);
  const { count: pendingBills } = await supabase().from('billing_encounters').select('*', { count: 'exact', head: true }).eq('centre_id', centreId).eq('status', 'OPEN').gt('net_amount', 0);
  const { data: insurancePending } = await supabase().from('billing_claims').select('claimed_amount').eq('centre_id', centreId).not('status', 'in', '("SETTLED","WRITTEN_OFF","REJECTED")');
  const { data: advances } = await supabase().from('billing_payments').select('advance_balance').eq('centre_id', centreId).eq('is_advance', true).gt('advance_balance', 0);
  const { count: opdCount } = await supabase().from('billing_encounters').select('*', { count: 'exact', head: true }).eq('centre_id', centreId).eq('encounter_type', 'OPD').gte('created_at', `${today}T00:00:00`);
  const { count: ipdActive } = await supabase().from('billing_encounters').select('*', { count: 'exact', head: true }).eq('centre_id', centreId).in('encounter_type', ['IPD','ER','DAYCARE']).eq('status', 'OPEN');
  return { today_collection: todayCollection, today_bills: todayBills || 0, pending_bills: pendingBills || 0, insurance_pending_count: insurancePending?.length || 0, insurance_pending_amount: (insurancePending || []).reduce((s, c) => s + c.claimed_amount, 0), advance_balance: (advances || []).reduce((s, a) => s + a.advance_balance, 0), opd_count: opdCount || 0, ipd_active: ipdActive || 0 };
}

export async function getClaimsAgingSummary(centreId: string): Promise<any[]> {
  const { data } = await supabase().from('billing_claims_aging_v').select('computed_aging_bucket, claimed_amount').eq('centre_id', centreId);
  if (!data) return [];
  const buckets: Record<string, { count: number; amount: number }> = { '0-30': { count: 0, amount: 0 }, '31-60': { count: 0, amount: 0 }, '61-90': { count: 0, amount: 0 }, '91-120': { count: 0, amount: 0 }, '120+': { count: 0, amount: 0 } };
  data.forEach(row => { const b = row.computed_aging_bucket; if (buckets[b]) { buckets[b].count++; buckets[b].amount += row.claimed_amount; } });
  const total = Object.values(buckets).reduce((s, b) => s + b.amount, 0);
  return Object.entries(buckets).map(([bucket, stats]) => ({ aging_bucket: bucket, claim_count: stats.count, total_amount: stats.amount, percentage: total > 0 ? roundToTwo(stats.amount / total * 100) : 0 }));
}

export async function detectRevenueLeakage(centreId: string, dateFrom: string, dateTo: string): Promise<any[]> {
  const { data: labOrders } = await supabase().from('lab_orders').select('id, patient_id, test_name, order_date').eq('centre_id', centreId).gte('order_date', dateFrom).lte('order_date', dateTo).eq('status', 'completed');
  const { data: labBilled } = await supabase().from('billing_line_items').select('source_id').eq('centre_id', centreId).eq('source_type', 'LAB').eq('status', 'ACTIVE');
  const billedIds = new Set((labBilled || []).map(li => li.source_id));
  return (labOrders || []).filter(o => !billedIds.has(o.id)).map(o => ({ type: 'LAB', source_id: o.id, patient_id: o.patient_id, description: o.test_name, date: o.order_date, status: 'UNBILLED' }));
}

async function isServiceCoveredByPackage(packageId: string, serviceMasterId: string, serviceCategory: ServiceCategory): Promise<boolean> {
  const { data: d } = await supabase().from('billing_package_inclusions').select('id').eq('package_id', packageId).eq('service_master_id', serviceMasterId).limit(1);
  if (d?.length) return true;
  const { data: c } = await supabase().from('billing_package_inclusions').select('id').eq('package_id', packageId).eq('service_category', serviceCategory).is('service_master_id', null).limit(1);
  if (c?.length) return true;
  const { data: pkg } = await supabase().from('billing_packages').select('inclusions, exclusions').eq('id', packageId).single();
  if (!pkg) return false;
  const { data: svc } = await supabase().from('billing_service_masters').select('service_code').eq('id', serviceMasterId).single();
  if (!svc) return false;
  const inclusions = (pkg.inclusions as string[]) || []; const exclusions = (pkg.exclusions as string[]) || [];
  if (exclusions.includes(svc.service_code)) return false;
  if (inclusions.includes(svc.service_code) || inclusions.includes('*') || inclusions.includes('ALL')) return true;
  return false;
}

function roundToTwo(num: number): number { return Math.round((num + Number.EPSILON) * 100) / 100; }

async function getCentrePrefix(centreId: string): Promise<string> {
  const { data } = await supabase().from('centres').select('code').eq('id', centreId).single();
  return data?.code ? `H1-${data.code}` : 'H1-XX';
}

async function getOrCreateBedService(centreId: string, roomCategory: string, wardType: string): Promise<ServiceMaster | null> {
  const code = `BED-${roomCategory}-${wardType}`.toUpperCase();
  const { data: existing } = await supabase().from('billing_service_masters').select('*').eq('centre_id', centreId).eq('service_code', code).eq('is_active', true).limit(1);
  if (existing?.length) return existing[0];
  const { data: created } = await supabase().from('billing_service_masters').insert({ centre_id: centreId, service_code: code, service_name: `${roomCategory} ${wardType} - Bed Charge`, department: wardType, service_category: 'ROOM', base_rate: 0, is_payable_to_doctor: false, is_active: true }).select().single();
  return created;
}

async function getOrCreateNursingService(centreId: string, wardType: string): Promise<ServiceMaster | null> {
  const code = `NURS-${wardType}`.toUpperCase();
  const { data: existing } = await supabase().from('billing_service_masters').select('*').eq('centre_id', centreId).eq('service_code', code).eq('is_active', true).limit(1);
  if (existing?.length) return existing[0];
  const { data: created } = await supabase().from('billing_service_masters').insert({ centre_id: centreId, service_code: code, service_name: `${wardType} - Nursing Charge`, department: wardType, service_category: 'NURSING', base_rate: 0, is_payable_to_doctor: false, is_active: true }).select().single();
  return created;
}

async function logBillingAudit(entityType: string, entityId: string, action: string, oldValues: any, newValues: any, userId: string): Promise<void> {
  await supabase().from('billing_audit_log').insert({ entity_type: entityType, entity_id: entityId, action, old_values: oldValues, new_values: newValues, performed_by: userId });
}

export { roundToTwo, getCentrePrefix, isServiceCoveredByPackage, logBillingAudit };
