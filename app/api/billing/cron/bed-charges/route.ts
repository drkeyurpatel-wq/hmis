// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

const supabase = billingDb();
function roundTwo(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const chargeDate = body.date || new Date().toISOString().split('T')[0];
  const centreId = body.centre_id;
  const results: Array<{ centre_id: string; generated: number; errors: string[] }> = [];

  try {
    let centreQuery = supabase.from('centres').select('id, name').eq('is_active', true);
    if (centreId) centreQuery = centreQuery.eq('id', centreId);
    const { data: centres } = await centreQuery;

    for (const centre of centres || []) {
      const centreResult = { centre_id: centre.id, generated: 0, errors: [] as string[] };

      const { data: encounters } = await supabase.from('billing_encounters')
        .select('id, patient_id, bed_id, primary_payor_type, package_id')
        .eq('centre_id', centre.id).in('encounter_type', ['IPD', 'ER', 'DAYCARE'])
        .eq('status', 'OPEN').eq('billing_locked', false).not('bed_id', 'is', null);

      for (const enc of encounters || []) {
        try {
          const { data: existing } = await supabase.from('billing_line_items')
            .select('id').eq('encounter_id', enc.id).eq('source_type', 'BED_CHARGE').eq('status', 'ACTIVE')
            .gte('service_date', `${chargeDate}T00:00:00`).lt('service_date', `${chargeDate}T23:59:59`).limit(1);
          if (existing && existing.length > 0) continue;

          const { data: bed } = await supabase.from('beds')
            .select('room_category, ward_type').eq('id', enc.bed_id).single();
          if (!bed) { centreResult.errors.push(`No bed for encounter ${enc.id}`); continue; }

          const { data: rules } = await supabase.from('billing_bed_charge_rules')
            .select('*').eq('centre_id', centre.id).eq('room_category', bed.room_category)
            .eq('ward_type', bed.ward_type).eq('is_active', true)
            .lte('effective_from', chargeDate).order('effective_from', { ascending: false }).limit(1);
          if (!rules || rules.length === 0) { centreResult.errors.push(`No rule for ${bed.room_category}/${bed.ward_type}`); continue; }

          const rule = rules[0];
          const systemUserId = '00000000-0000-0000-0000-000000000000';
          const bedCode = `BED-${bed.room_category}-${bed.ward_type}`.toUpperCase();

          let { data: bedService } = await supabase.from('billing_service_masters')
            .select('id').eq('centre_id', centre.id).eq('service_code', bedCode).eq('is_active', true).limit(1).single();
          if (!bedService) {
            const { data: created } = await supabase.from('billing_service_masters').insert({
              centre_id: centre.id, service_code: bedCode,
              service_name: `${bed.room_category} ${bed.ward_type} - Bed Charge`,
              department: bed.ward_type, service_category: 'ROOM',
              base_rate: rule.charge_per_day, is_payable_to_doctor: false,
              is_active: true, effective_from: chargeDate,
            }).select('id').single();
            bedService = created;
          }

          if (bedService && rule.charge_per_day > 0) {
            await supabase.from('billing_line_items').insert({
              encounter_id: enc.id, centre_id: centre.id, service_master_id: bedService.id,
              service_code: bedCode, service_name: `${bed.room_category} ${bed.ward_type} - Bed Charge`,
              department: bed.ward_type, service_category: 'ROOM', quantity: 1,
              unit_rate: rule.charge_per_day, gross_amount: rule.charge_per_day,
              discount_amount: 0, tax_amount: 0, net_amount: rule.charge_per_day,
              source_type: 'BED_CHARGE', service_date: `${chargeDate}T00:00:00`,
              status: 'ACTIVE', created_by: systemUserId,
            });
            centreResult.generated++;
          }

          if (rule.nursing_charge_per_day > 0) {
            const nursCode = `NURS-${bed.ward_type}`.toUpperCase();
            let { data: nursService } = await supabase.from('billing_service_masters')
              .select('id').eq('centre_id', centre.id).eq('service_code', nursCode).eq('is_active', true).limit(1).single();
            if (!nursService) {
              const { data: created } = await supabase.from('billing_service_masters').insert({
                centre_id: centre.id, service_code: nursCode,
                service_name: `${bed.ward_type} - Nursing Charge`,
                department: bed.ward_type, service_category: 'NURSING',
                base_rate: rule.nursing_charge_per_day, is_payable_to_doctor: false,
                is_active: true, effective_from: chargeDate,
              }).select('id').single();
              nursService = created;
            }
            if (nursService) {
              await supabase.from('billing_line_items').insert({
                encounter_id: enc.id, centre_id: centre.id, service_master_id: nursService.id,
                service_code: nursCode, service_name: `${bed.ward_type} - Nursing Charge`,
                department: bed.ward_type, service_category: 'NURSING', quantity: 1,
                unit_rate: rule.nursing_charge_per_day, gross_amount: rule.nursing_charge_per_day,
                discount_amount: 0, tax_amount: 0, net_amount: rule.nursing_charge_per_day,
                source_type: 'NURSING', service_date: `${chargeDate}T00:00:00`,
                status: 'ACTIVE', created_by: systemUserId,
              });
            }
          }
        } catch (err: any) { centreResult.errors.push(`Encounter ${enc.id}: ${err.message}`); }
      }
      results.push(centreResult);
    }

    const totalGenerated = results.reduce((s, r) => s + r.generated, 0);
    const totalErrors = results.reduce((s, r) => s + r.errors.length, 0);
    return NextResponse.json({ success: true, date: chargeDate, total_generated: totalGenerated,
      total_errors: totalErrors, details: results });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function GET() {
  return NextResponse.json({ message: 'POST to trigger bed charge generation',
    usage: 'POST with Authorization: Bearer <CRON_SECRET>', body: '{ "date": "YYYY-MM-DD" }' });
}
