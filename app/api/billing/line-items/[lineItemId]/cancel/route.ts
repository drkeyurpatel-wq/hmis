// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
import { parseBody } from '@/lib/validation/parse-body';
import { lineItemCancelSchema } from '@/lib/validation/billing';

export async function POST(
  request: NextRequest,
  { params }: { params: { lineItemId: string } }
) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const parsed = await parseBody(request, lineItemCancelSchema);
  if (parsed.error) return parsed.error;
  const body = parsed.data;
  

  if (!body.reason) {
    return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });
  }

  try {
    const { data: existing } = await supabase
      .from('billing_line_items')
      .select('*, billing_encounters!inner(billing_locked)')
      .eq('id', params.lineItemId)
      .single();

    if (!existing) return NextResponse.json({ error: 'Line item not found' }, { status: 404 });
    if (existing.status !== 'ACTIVE') return NextResponse.json({ error: 'Item already cancelled' }, { status: 400 });
    if (existing.billing_encounters?.billing_locked) {
      return NextResponse.json({ error: 'Encounter is locked' }, { status: 400 });
    }

    const { error } = await supabase
      .from('billing_line_items')
      .update({
        status: 'CANCELLED',
        cancel_reason: body.reason,
        cancelled_by: staff?.id || 'unknown',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.lineItemId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('billing_audit_log').insert({
      entity_type: 'billing_line_items', entity_id: params.lineItemId,
      action: 'CANCEL',
      old_values: { status: 'ACTIVE', net_amount: existing.net_amount },
      new_values: { status: 'CANCELLED', cancel_reason: body.reason },
      performed_by: staff?.id || 'unknown',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
