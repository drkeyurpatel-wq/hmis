import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
import { parseBody } from '@/lib/validation/parse-body';
import { preAuthApproveSchema } from '@/lib/validation/billing';

export async function POST(
  request: NextRequest,
  { params }: { params: { preAuthId: string } }
) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const parsed = await parseBody(request, preAuthApproveSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  

  const paData = (await supabase.from('billing_pre_auths').select('requested_amount').eq('id', params.preAuthId).single()).data;
  const status = (body.approved_amount ?? 0) < (paData?.requested_amount || 0) ? 'PARTIALLY_APPROVED' : 'APPROVED';

  const { error } = await supabase
    .from('billing_pre_auths')
    .update({
      status,
      approved_amount: body.approved_amount || 0,
      approved_stay_days: body.approved_stay_days || null,
      approval_reference: body.approval_reference || null,
      approval_date: new Date().toISOString(),
      first_response_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.preAuthId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: pa } = await supabase.from('billing_pre_auths').select('encounter_id').eq('id', params.preAuthId).single();
  if (pa) {
    await supabase.from('billing_encounters').update({
      insurance_approved_amount: body.approved_amount || 0,
      updated_at: new Date().toISOString(),
    }).eq('id', pa.encounter_id);
  }

  await supabase.from('billing_audit_log').insert({
    entity_type: 'billing_pre_auths', entity_id: params.preAuthId,
    action: 'APPROVE', new_values: { status, approved_amount: body.approved_amount }, performed_by: staff?.id || 'unknown',
  });

  return NextResponse.json({ success: true, status });
}
