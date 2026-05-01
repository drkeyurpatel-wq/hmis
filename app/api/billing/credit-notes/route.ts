import { NextRequest, NextResponse } from 'next/server';
import { billingDb, billingRpc } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';
import { parseBody } from '@/lib/validation/parse-body';
import { creditNoteCreateSchema } from '@/lib/validation/billing';

export async function POST(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const parsed = await parseBody(request, creditNoteCreateSchema);
  if (parsed.error) return parsed.error;
  const { original_invoice_id, amount, reason, line_items, refund_mode } = parsed.data;

  try {
    const { data: invoice } = await supabase.from('billing_invoices')
      .select('centre_id, patient_id, encounter_id, invoice_number')
      .eq('id', original_invoice_id).single();
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { data: cnNumber } = await billingRpc('billing_next_number', {
      p_centre_id: invoice.centre_id, p_sequence_type: 'CREDIT_NOTE', p_prefix: 'H1-CN',
    });

    const { data, error } = await supabase.from('billing_credit_notes').insert({
      original_invoice_id, credit_note_number: cnNumber, centre_id: invoice.centre_id,
      patient_id: invoice.patient_id, amount, reason, line_items: line_items || [],
      refund_mode: refund_mode || null, status: 'DRAFT', created_by: staff?.id || 'unknown',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('billing_invoices')
      .update({ status: 'CREDIT_NOTE_ISSUED', updated_at: new Date().toISOString() })
      .eq('id', original_invoice_id);

    await supabase.from('billing_audit_log').insert({
      entity_type: 'billing_credit_notes', entity_id: data.id, action: 'CREATE',
      new_values: { credit_note_number: cnNumber, amount, reason }, performed_by: staff?.id || 'unknown',
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}

export async function GET(request: NextRequest) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const centreId = request.nextUrl.searchParams.get('centre_id');
  let query = supabase.from('billing_credit_notes')
    .select('*, billing_invoices!inner (invoice_number)')
    .order('created_at', { ascending: false }).limit(100);
  if (centreId) query = query.eq('centre_id', centreId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}
