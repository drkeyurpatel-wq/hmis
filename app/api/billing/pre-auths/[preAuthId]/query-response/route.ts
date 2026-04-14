import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: { preAuthId: string } }
) {
  const supabase = billingDb();
  const body = await request.json();
  const user = { id: 'service-role' };

  if (!body.response?.trim()) {
    return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
  }

  const { error } = await supabase
    .from('billing_pre_auths')
    .update({
      status: 'SUBMITTED',
      query_response: body.response,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.preAuthId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('billing_audit_log').insert({
    entity_type: 'billing_pre_auths', entity_id: params.preAuthId,
    action: 'UPDATE', new_values: { query_response: body.response }, performed_by: user.id,
  });

  return NextResponse.json({ success: true });
}
