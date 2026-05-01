// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb, billingRpc } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

export async function GET(request: NextRequest, { params }: { params: { encounterId: string } }) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const { data, error } = await supabase.from('billing_payments').select('*')
    .eq('encounter_id', params.encounterId).eq('status', 'COMPLETED')
    .order('payment_date', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

export async function POST(request: NextRequest, { params }: { params: { encounterId: string } }) {
  const { error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const body = await request.json();
  const user = { id: 'service-role' };
  if (!body.amount || body.amount <= 0) return NextResponse.json({ error: 'Amount must be > 0' }, { status: 400 });

  try {
    const { data: encounter } = await supabase.from('billing_encounters')
      .select('centre_id, patient_id').eq('id', params.encounterId).single();
    if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });

    const { data: receiptNumber } = await billingRpc('billing_next_number', {
      p_centre_id: encounter.centre_id, p_sequence_type: 'RECEIPT', p_prefix: 'H1-RCP',
    });

    const { data, error } = await supabase.from('billing_payments').insert({
      encounter_id: params.encounterId, invoice_id: body.invoice_id || null,
      centre_id: encounter.centre_id, patient_id: encounter.patient_id,
      receipt_number: receiptNumber, payment_date: new Date().toISOString(),
      amount: body.amount, payment_mode: body.payment_mode || 'CASH',
      payment_reference: body.payment_reference || null,
      card_last_four: body.card_last_four || null, upi_id: body.upi_id || null,
      bank_name: body.bank_name || null, payment_type: body.payment_type || 'COLLECTION',
      is_advance: body.is_advance || false,
      advance_balance: body.is_advance ? body.amount : 0,
      status: 'COMPLETED', created_by: user.id,
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('billing_audit_log').insert({
      entity_type: 'billing_payments', entity_id: data.id, action: 'CREATE',
      new_values: { amount: data.amount, payment_mode: data.payment_mode, receipt_number: data.receipt_number },
      performed_by: user.id,
    });
    return NextResponse.json(data, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
