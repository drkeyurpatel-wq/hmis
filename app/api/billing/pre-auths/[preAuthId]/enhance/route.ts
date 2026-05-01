// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function POST(
  request: NextRequest,
  { params }: { params: { preAuthId: string } }
) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const body = await request.json();
  const user = { id: 'service-role' };

  const { error } = await supabase
    .from('billing_pre_auths')
    .update({
      status: 'ENHANCEMENT_PENDING',
      enhancement_requested: true,
      enhancement_amount: body.enhancement_amount,
      enhancement_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.preAuthId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('billing_audit_log').insert({
    entity_type: 'billing_pre_auths', entity_id: params.preAuthId,
    action: 'UPDATE', new_values: { enhancement_amount: body.enhancement_amount }, performed_by: user.id,
  });

  return NextResponse.json({ success: true });
}
