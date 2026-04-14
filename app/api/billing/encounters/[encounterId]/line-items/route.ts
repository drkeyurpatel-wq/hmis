// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

function roundTwo(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function GET(request: NextRequest, { params }: { params: { encounterId: string } }) {
  const supabase = billingDb();
  const { data, error } = await supabase.from('billing_line_items').select('*')
    .eq('encounter_id', params.encounterId).eq('status', 'ACTIVE')
    .order('service_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest, { params }: { params: { encounterId: string } }) {
  const supabase = billingDb();
  const body = await request.json();
  const user = { id: 'service-role' };

  try {
    const { data: encounter } = await supabase.from('billing_encounters')
      .select('centre_id, primary_payor_type, primary_payor_id, package_id, billing_locked')
      .eq('id', params.encounterId).single();
    if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });
    if (encounter.billing_locked) return NextResponse.json({ error: 'Encounter is locked' }, { status: 400 });

    const { data: service } = await supabase.from('billing_service_masters')
      .select('*').eq('id', body.service_master_id).single();
    if (!service) return NextResponse.json({ error: 'Service not found' }, { status: 404 });

    let unitRate = body.unit_rate;
    if (unitRate === undefined || unitRate === null) {
      const today = new Date().toISOString().split('T')[0];
      const { data: rateCards } = await supabase.from('billing_rate_cards')
        .select('rate').eq('centre_id', encounter.centre_id)
        .eq('service_master_id', body.service_master_id)
        .eq('payor_type', encounter.primary_payor_type).eq('is_active', true)
        .lte('effective_from', today).order('effective_from', { ascending: false }).limit(1);
      unitRate = rateCards?.[0]?.rate ?? service.base_rate;
    }

    const quantity = body.quantity || 1;
    const grossAmount = roundTwo(quantity * unitRate);
    let discountAmount = 0;
    const discountType = body.discount_type || null;
    const discountValue = body.discount_value || 0;
    if (discountType === 'PERCENTAGE' && discountValue > 0) discountAmount = roundTwo(grossAmount * discountValue / 100);
    else if (discountType === 'FLAT' && discountValue > 0) discountAmount = roundTwo(Math.min(discountValue, grossAmount));

    let coveredByPackage = false;
    if (encounter.package_id) {
      const { data: pkgInclusions } = await supabase.from('billing_package_inclusions').select('id')
        .eq('package_id', encounter.package_id)
        .or(`service_master_id.eq.${body.service_master_id},service_category.eq.${service.service_category}`).limit(1);
      if (pkgInclusions && pkgInclusions.length > 0) { coveredByPackage = true; discountAmount = grossAmount; }
    }

    let taxAmount = 0;
    if (service.gst_applicable && service.gst_percentage > 0)
      taxAmount = roundTwo((grossAmount - discountAmount) * service.gst_percentage / 100);
    const netAmount = roundTwo(grossAmount - discountAmount + taxAmount);

    const { data, error } = await supabase.from('billing_line_items').insert({
      encounter_id: params.encounterId, centre_id: encounter.centre_id,
      service_master_id: body.service_master_id, service_code: service.service_code,
      service_name: service.service_name, department: service.department,
      service_category: service.service_category, quantity, unit_rate: unitRate,
      gross_amount: grossAmount, discount_type: discountType, discount_value: discountValue,
      discount_amount: discountAmount, tax_percentage: service.gst_applicable ? service.gst_percentage : 0,
      tax_amount: taxAmount, net_amount: netAmount,
      service_doctor_id: body.service_doctor_id || null,
      referring_doctor_id: body.referring_doctor_id || null,
      source_type: body.source_type || 'MANUAL', source_id: body.source_id || null,
      is_package_item: coveredByPackage, package_id: coveredByPackage ? encounter.package_id : null,
      covered_by_package: coveredByPackage,
      service_date: body.service_date || new Date().toISOString(),
      status: 'ACTIVE', created_by: user.id,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('billing_audit_log').insert({
      entity_type: 'billing_line_items', entity_id: data.id, action: 'CREATE',
      new_values: { service_code: data.service_code, net_amount: data.net_amount }, performed_by: user.id,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
