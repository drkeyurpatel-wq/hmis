import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
import { parseBody } from '@/lib/validation/parse-body';
import { serviceCreateSchema } from '@/lib/validation/billing';

export async function GET(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  if (!centreId) return NextResponse.json({ error: 'centre_id required' }, { status: 400 });

  const { data, error } = await supabase
    .from('billing_service_masters').select('*').eq('centre_id', centreId)
    .order('department').order('sort_order').order('service_name');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const parsed = await parseBody(request, serviceCreateSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  
  if (!body.centre_id || !body.service_code || !body.service_name || !body.department) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  const { data, error } = await supabase
    .from('billing_service_masters')
    .insert({
      centre_id: body.centre_id, service_code: body.service_code,
      service_name: body.service_name, department: body.department_id,
      service_category: body.service_category || 'MISCELLANEOUS',
      base_rate: body.base_rate || 0, gst_applicable: body.gst_applicable || false,
      gst_percentage: body.gst_percentage || 0, hsn_sac_code: body.hsn_sac_code || null,
      is_payable_to_doctor: body.is_payable_to_doctor ?? true,
      doctor_payout_type: body.doctor_payout_type || null,
      is_active: true, effective_from: new Date().toISOString().split('T')[0],
    }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('billing_audit_log').insert({
    entity_type: 'billing_service_masters', entity_id: data.id,
    action: 'CREATE', new_values: { service_code: data.service_code, service_name: data.service_name, base_rate: data.base_rate },
    performed_by: staff?.id || 'unknown',
  });
  return NextResponse.json(data, { status: 201 });
}
