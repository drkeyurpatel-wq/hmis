// lib/billing/auto-charge-engine.ts
// Runs daily (via cron or manual trigger) to post recurring charges for admitted patients:
// - Bed charges (per ward/room category tariff)
// - Nursing charges (ICU surcharge)
// - Diet charges
// - Monitoring charges (ICU)

import { sb } from '@/lib/supabase/browser';

interface AutoChargeResult {
  admissionId: string; patientName: string; ipdNumber: string;
  charges: { description: string; amount: number }[];
  total: number; error?: string;
}

export async function runDailyAutoCharges(centreId: string, chargeDate: string, staffId: string): Promise<{
  results: AutoChargeResult[]; totalCharged: number; patientsProcessed: number; errors: number;
}> {
  if (!sb()) return { results: [], totalCharged: 0, patientsProcessed: 0, errors: 0 };

  // Get all active admissions
  const { data: admissions } = await sb()!.from('hmis_admissions')
    .select(`id, ipd_number, payor_type, admission_date,
      patient:hmis_patients!inner(id, first_name, last_name, uhid),
      bed:hmis_beds(id, bed_number, room:hmis_rooms(room_number, ward:hmis_wards(name, type, bed_charge_per_day)))`)
    .eq('centre_id', centreId).eq('status', 'active');

  if (!admissions || admissions.length === 0) return { results: [], totalCharged: 0, patientsProcessed: 0, errors: 0 };

  // Check which admissions already have charges for this date
  const admIds = admissions.map((a: any) => a.id);
  const { data: existingRuns } = await sb()!.from('hmis_auto_charge_runs')
    .select('admission_id').eq('charge_date', chargeDate).in('admission_id', admIds);
  const alreadyCharged = new Set((existingRuns || []).map((r: any) => r.admission_id));

  const results: AutoChargeResult[] = [];
  let totalCharged = 0;
  let errors = 0;

  for (const adm of admissions) {
    if (alreadyCharged.has(adm.id)) continue; // Skip already processed

    const pt = adm.patient as any;
    const bed = adm.bed as any;
    const ward = bed?.room?.ward as any;
    const charges: { description: string; amount: number }[] = [];

    // Bed charge
    const bedCharge = ward?.bed_charge_per_day || 0;
    if (bedCharge > 0) {
      charges.push({ description: `Bed Charge — ${ward?.name} (${bed?.bed_number})`, amount: bedCharge });
    }

    // ICU surcharge
    if (ward?.type === 'icu' || ward?.type === 'transplant_icu') {
      const icuSurcharge = bedCharge * 0.5; // 50% ICU surcharge
      if (icuSurcharge > 0) charges.push({ description: 'ICU Monitoring & Nursing', amount: icuSurcharge });
    }

    // Diet charge (if active diet order)
    const { data: diet } = await sb()!.from('hmis_diet_orders')
      .select('diet_type').eq('patient_id', pt.id).eq('centre_id', centreId).eq('status', 'active').limit(1).maybeSingle();
    if (diet) {
      const dietRate = diet.diet_type === 'npo' ? 0 : diet.diet_type === 'liquid' ? 150 : diet.diet_type === 'soft' ? 200 : 250;
      if (dietRate > 0) charges.push({ description: `Diet — ${diet.diet_type?.replace(/_/g, ' ')}`, amount: dietRate });
    }

    if (charges.length === 0) continue;

    const total = charges.reduce((s: number, c: any) => s + c.amount, 0);

    try {
      // Post to charge log
      await sb()!.from('hmis_charge_log').insert(charges.map((c: any) => ({
        centre_id: centreId, patient_id: pt.id, admission_id: adm.id,
        description: c.description, amount: c.amount, charge_date: chargeDate,
        charge_type: 'auto_daily', created_by: staffId,
      })));

      // Mark as processed
      await sb()!.from('hmis_auto_charge_runs').insert({
        centre_id: centreId, admission_id: adm.id, charge_date: chargeDate,
        total_amount: total, items_count: charges.length, created_by: staffId,
      });

      results.push({
        admissionId: adm.id, patientName: `${pt.first_name} ${pt.last_name || ''}`,
        ipdNumber: adm.ipd_number, charges, total,
      });
      totalCharged += total;
    } catch (err: any) {
      results.push({
        admissionId: adm.id, patientName: `${pt.first_name} ${pt.last_name || ''}`,
        ipdNumber: adm.ipd_number, charges, total, error: err.message,
      });
      errors++;
    }
  }

  return { results, totalCharged, patientsProcessed: results.length, errors };
}
