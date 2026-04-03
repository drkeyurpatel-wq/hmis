// app/api/cron/auto-charges/route.ts
// Run daily to post recurring bed/nursing/diet charges for all admitted patients
// Can be triggered by Vercel cron or manually via dashboard

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CRON_SECRET = process.env.CRON_SECRET || '';

function adminSb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
  // Auth: cron secret or skip in dev
  const authHeader = request.headers.get('authorization');
  if (process.env.NODE_ENV === 'production') {
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const sb = adminSb();
  const today = new Date().toISOString().split('T')[0];

  // Get all active centres
  const { data: centres } = await sb.from('hmis_centres').select('id, name').eq('is_active', true);
  if (!centres) return NextResponse.json({ error: 'No centres found' }, { status: 500 });

  const results: any[] = [];

  for (const centre of centres) {
    // Get active admissions with bed info
    const { data: admissions } = await sb.from('hmis_admissions')
      .select(`id, ipd_number, payor_type, patient:hmis_patients!inner(id, first_name, last_name),
        bed:hmis_beds(bed_number, room:hmis_rooms(room_number, ward:hmis_wards(name, type, bed_charge_per_day)))`)
      .eq('centre_id', centre.id).eq('status', 'active');

    if (!admissions || admissions.length === 0) continue;

    // Check existing charges for today
    const admIds = admissions.map((a: any) => a.id);
    const { data: existing } = await sb.from('hmis_auto_charge_runs')
      .select('admission_id').eq('charge_date', today).in('admission_id', admIds);
    const done = new Set((existing || []).map((e: any) => e.admission_id));

    let centreTotal = 0;
    let centreCount = 0;

    for (const adm of admissions) {
      if (done.has(adm.id)) continue;

      const bed = adm.bed as any;
      const ward = bed?.room?.ward as any;
      const pt = adm.patient as any;
      const charges: { description: string; amount: number }[] = [];

      const bedCharge = ward?.bed_charge_per_day || 0;
      if (bedCharge > 0) charges.push({ description: `Bed — ${ward?.name} (${bed?.bed_number})`, amount: bedCharge });
      if ((ward?.type === 'icu' || ward?.type === 'transplant_icu') && bedCharge > 0) {
        charges.push({ description: 'ICU Monitoring', amount: bedCharge * 0.5 });
      }

      // Diet charges — lookup active diet order for this admission
      const { data: diet } = await sb.from('hmis_diet_orders')
        .select('diet_type').eq('patient_id', pt.id).eq('status', 'active').limit(1).maybeSingle();
      if (diet) {
        const dietRates: Record<string, number> = { regular: 250, diabetic: 350, renal: 400, soft: 300, liquid: 200, npo: 0 };
        const dietRate = dietRates[diet.diet_type] || 250;
        if (dietRate > 0) charges.push({ description: `Diet — ${(diet.diet_type || 'regular').replace(/_/g, ' ')}`, amount: dietRate });
      }

      // Nursing charge for all inpatients
      const nursingRate = (ward?.type === 'icu' || ward?.type === 'transplant_icu') ? 1500 : 500;
      charges.push({ description: 'Nursing Care', amount: nursingRate });

      if (charges.length === 0) continue;
      const total = charges.reduce((s: number, c: any) => s + c.amount, 0);

      await sb.from('hmis_charge_log').insert(charges.map(c => ({
        centre_id: centre.id, patient_id: pt.id, admission_id: adm.id,
        service_name: c.description, description: c.description,
        category: c.description.startsWith('Bed') ? 'room' : c.description.startsWith('ICU') ? 'icu' : c.description.startsWith('Diet') ? 'diet' : 'nursing',
        amount: c.amount, unit_rate: c.amount, quantity: 1,
        service_date: today, status: 'captured',
        source: 'auto_daily', captured_by: 'system',
      })));

      await sb.from('hmis_auto_charge_runs').insert({
        centre_id: centre.id, admission_id: adm.id, charge_date: today,
        total_amount: total, items_count: charges.length, created_by: 'system',
      });

      centreTotal += total;
      centreCount++;
    }

    results.push({ centre: centre.name, patients: centreCount, total: centreTotal });
  }

  return NextResponse.json({ date: today, centres: results, totalPatients: results.reduce((s, r) => s + r.patients, 0) });
  } catch (err: unknown) {
    console.error("[cron] Error:", err);
    return NextResponse.json({ error: "Internal error", detail: String(err) }, { status: 500 });
  }
}
