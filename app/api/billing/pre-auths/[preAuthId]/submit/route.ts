import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { preAuthId: string } }
) {
  const supabase = billingDb();
  const user = { id: 'service-role' };

  const { error } = await supabase
    .from('billing_pre_auths')
    .update({
      status: 'SUBMITTED',
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.preAuthId)
    .eq('status', 'DRAFT');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('billing_audit_log').insert({
    entity_type: 'billing_pre_auths', entity_id: params.preAuthId,
    action: 'SUBMIT', new_values: { status: 'SUBMITTED' }, performed_by: user.id,
  });

  return NextResponse.json({ success: true });
}
