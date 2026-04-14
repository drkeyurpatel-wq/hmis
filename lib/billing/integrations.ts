// HEALTH1 HMIS — BILLING INTEGRATIONS
// MedPay auto-tagging, CashFlow PWA sync, WhatsApp bill sharing
import { sb } from '@/lib/supabase/browser';

const supabase = () => sb;

export async function syncToMedPay(encounterId: string): Promise<{ synced: number; skipped: number; errors: string[]; }> {
  const errors: string[] = []; let synced = 0; let skipped = 0;
  try {
    const { data: lineItems } = await supabase().from('billing_line_items')
      .select('id, encounter_id, centre_id, service_code, service_name, department, service_category, quantity, unit_rate, gross_amount, discount_amount, net_amount, service_doctor_id, referring_doctor_id, source_type, service_date, payout_processed, is_covered_by_insurance, covered_by_package')
      .eq('encounter_id', encounterId).eq('status', 'ACTIVE').eq('payout_processed', false);
    if (!lineItems || lineItems.length === 0) return { synced: 0, skipped: 0, errors: [] };
    const { data: encounter } = await supabase().from('billing_encounters')
      .select('primary_payor_type, patient_id, actual_discharge_date').eq('id', encounterId).single();
    if (!encounter) return { synced: 0, skipped: 0, errors: ['Encounter not found'] };
    for (const li of lineItems) {
      try {
        if (li.service_category === 'ROOM' || li.service_category === 'NURSING' || !li.service_doctor_id) { skipped++; continue; }
        await supabase().from('billing_line_items').update({ payout_processed: true, updated_at: new Date().toISOString() }).eq('id', li.id);
        synced++;
      } catch (err: any) { errors.push(`Line ${li.id}: ${err.message}`); }
    }
    return { synced, skipped, errors };
  } catch (err: any) { return { synced, skipped, errors: [err.message] }; }
}

export async function getMedPayExtract(centreId: string, dateFrom: string, dateTo: string) {
  const { data: lineItems } = await supabase().from('billing_line_items')
    .select('*, billing_encounters!inner (primary_payor_type, patient_id)')
    .eq('centre_id', centreId).eq('status', 'ACTIVE').not('service_doctor_id', 'is', null)
    .gte('service_date', dateFrom).lte('service_date', dateTo);
  if (!lineItems) return [];
  const docIds = new Set<string>();
  lineItems.forEach(li => { if (li.service_doctor_id) docIds.add(li.service_doctor_id); });
  const { data: doctors } = await supabase().from('doctors').select('id, name').in('id', Array.from(docIds));
  const docMap: Record<string, string> = {};
  (doctors || []).forEach(d => { docMap[d.id] = d.name; });
  const doctorGroups: Record<string, any[]> = {};
  lineItems.forEach(li => {
    const docId = li.service_doctor_id!;
    if (!doctorGroups[docId]) doctorGroups[docId] = [];
    doctorGroups[docId].push({
      service_code: li.service_code, service_name: li.service_name, department: li.department,
      category: li.service_category, payor_type: li.billing_encounters?.primary_payor_type || 'SELF_PAY',
      quantity: li.quantity, net_amount: li.net_amount, gross_amount: li.gross_amount,
      patient_id: li.billing_encounters?.patient_id, encounter_id: li.encounter_id,
      service_date: li.service_date,
      is_self_or_other: li.referring_doctor_id && li.referring_doctor_id !== li.service_doctor_id ? 'OTHER' : 'SELF',
    });
  });
  return Object.entries(doctorGroups).map(([docId, items]) => ({
    doctor_id: docId, doctor_name: docMap[docId] || 'Unknown', items,
    total_amount: items.reduce((s, i) => s + i.net_amount, 0),
  }));
}

export async function syncToCashFlow(centreId: string, date: string): Promise<{ success: boolean; error?: string }> {
  try {
    const dateStart = `${date}T00:00:00`, dateEnd = `${date}T23:59:59.999`;
    const { data: payments } = await supabase().from('billing_payments').select('amount, payment_mode, payment_type')
      .eq('centre_id', centreId).eq('status', 'COMPLETED').in('payment_type', ['COLLECTION', 'ADVANCE', 'DEPOSIT'])
      .gte('payment_date', dateStart).lte('payment_date', dateEnd);
    const totalCollection = (payments || []).reduce((s, p) => s + p.amount, 0);
    const cashAmount = (payments || []).filter(p => p.payment_mode === 'CASH').reduce((s, p) => s + p.amount, 0);
    const { data: centre } = await supabase().from('centres').select('name, code').eq('id', centreId).single();
    if (!centre) return { success: false, error: 'Centre not found' };
    const response = await fetch('https://h1cashflow.drkeyurpatel.workers.dev/api/upload-day', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ center: centre.name, date, collection: totalCollection, cash: cashAmount, digital: totalCollection - cashAmount, source: 'HMIS_BILLING' }),
    });
    if (!response.ok) return { success: false, error: `CashFlow sync failed: ${response.status}` };
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function sendBillViaWhatsApp(params: { patientPhone: string; patientName: string; invoiceNumber: string; invoiceId: string; amount: number; balanceDue: number; centreUrl: string; }): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return { success: false, error: 'WhatsApp credentials not configured' };
  let phone = params.patientPhone.replace(/[\s\-\+]/g, '');
  if (phone.length === 10) phone = '91' + phone;
  if (phone.startsWith('+')) phone = phone.slice(1);
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'template',
        template: { name: 'billing_receipt', language: { code: 'en' },
          components: [{ type: 'body', parameters: [
            { type: 'text', text: params.patientName }, { type: 'text', text: params.invoiceNumber },
            { type: 'text', text: `₹${params.amount.toLocaleString('en-IN')}` },
            { type: 'text', text: params.balanceDue > 0 ? `Balance: ₹${params.balanceDue.toLocaleString('en-IN')}` : 'Fully paid' },
          ]}] } }),
    });
    if (!response.ok) { const errBody = await response.json(); return { success: false, error: JSON.stringify(errBody) }; }
    const result = await response.json();
    return { success: true, messageId: result.messages?.[0]?.id };
  } catch (err: any) { return { success: false, error: err.message }; }
}

export async function sendPaymentLinkViaWhatsApp(params: { patientPhone: string; patientName: string; amount: number; encounterId: string; paymentUrl: string; }): Promise<{ success: boolean; error?: string }> {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!phoneNumberId || !accessToken) return { success: false, error: 'WhatsApp credentials not configured' };
  let phone = params.patientPhone.replace(/[\s\-\+]/g, '');
  if (phone.length === 10) phone = '91' + phone;
  try {
    const response = await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone, type: 'text',
        text: { body: `Dear ${params.patientName},\n\nPlease pay ₹${params.amount.toLocaleString('en-IN')} for your hospital charges at Health1.\n\nPayment link: ${params.paymentUrl}\n\nThank you,\nHealth1 Super Speciality Hospital` } }),
    });
    if (!response.ok) return { success: false, error: `WhatsApp send failed: ${response.status}` };
    return { success: true };
  } catch (err: any) { return { success: false, error: err.message }; }
}
