// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
import { parseBody } from '@/lib/validation/parse-body';
import { preAuthQueryResponseSchema } from '@/lib/validation/billing';

export async function POST(
  request: NextRequest,
  { params }: { params: { preAuthId: string } }
) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const parsed = await parseBody(request, preAuthQueryResponseSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  

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
    action: 'UPDATE', new_values: { query_response: body.response }, performed_by: staff?.id || 'unknown',
  });

  return NextResponse.json({ success: true });
}
