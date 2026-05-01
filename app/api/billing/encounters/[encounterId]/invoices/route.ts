// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb, billingRpc } from '@/lib/billing/api-helpers';
import { requireAuth } from '@/lib/api/auth-guard';

function roundTwo(n: number): number { return Math.round((n + Number.EPSILON) * 100) / 100; }

export async function POST(request: NextRequest, { params }: { params: { encounterId: string } }) {
  const { staff, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const supabase = billingDb();
  const body = await request.json();
  

  try {
    const { data: encounter } = await supabase.from('billing_encounters')
      .select('centre_id, patient_id, total_paid, net_amount')
      .eq('id', params.encounterId).single();
    if (!encounter) return NextResponse.json({ error: 'Encounter not found' }, { status: 404 });

    let liQuery = supabase.from('billing_line_items').select('*')
      .eq('encounter_id', params.encounterId).eq('status', 'ACTIVE');
    if (body.line_item_ids?.length > 0) liQuery = liQuery.in('id', body.line_item_ids);
    const { data: lineItems } = await liQuery;
    if (!lineItems || lineItems.length === 0) return NextResponse.json({ error: 'No billable items' }, { status: 400 });

    const subtotal = roundTwo(lineItems.reduce((s: number, li: any) => s + li.gross_amount, 0));
    const totalDiscount = roundTwo(lineItems.reduce((s: number, li: any) => s + li.discount_amount, 0));
    const totalTax = roundTwo(lineItems.reduce((s: number, li: any) => s + li.tax_amount, 0));
    const grandTotal = roundTwo(lineItems.reduce((s: number, li: any) => s + li.net_amount, 0));
    const amountPaid = encounter.total_paid || 0;
    const balanceDue = roundTwo(grandTotal - amountPaid);

    const { data: invoiceNumber } = await billingRpc('billing_next_number', {
      p_centre_id: encounter.centre_id, p_sequence_type: 'INVOICE', p_prefix: 'H1-INV',
    });

    const invoiceType = body.invoice_type || 'OPD';
    const { data: invoice, error } = await supabase.from('billing_invoices').insert({
      encounter_id: params.encounterId, centre_id: encounter.centre_id,
      patient_id: encounter.patient_id, invoice_number: invoiceNumber,
      invoice_type: invoiceType, invoice_date: new Date().toISOString(),
      subtotal, total_discount: totalDiscount, total_tax: totalTax,
      grand_total: grandTotal, amount_paid: roundTwo(amountPaid),
      balance_due: roundTwo(Math.max(0, balanceDue)),
      status: balanceDue <= 0 ? 'PAID' : amountPaid > 0 ? 'PARTIALLY_PAID' : 'GENERATED',
      created_by: staff?.id || 'unknown',
    }).select().single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await supabase.from('billing_invoice_line_items')
      .insert(lineItems.map(li => ({ invoice_id: invoice.id, line_item_id: li.id, amount: li.net_amount })));

    const isFinal = invoiceType === 'IPD_FINAL' || invoiceType === 'DISCHARGE';
    await supabase.from('billing_encounters').update({
      status: isFinal ? 'FINAL_BILLED' : 'INTERIM_BILLED', billing_locked: isFinal,
      updated_at: new Date().toISOString(),
    }).eq('id', params.encounterId);

    await supabase.from('billing_audit_log').insert({
      entity_type: 'billing_invoices', entity_id: invoice.id, action: 'CREATE',
      new_values: { invoice_number: invoice.invoice_number, grand_total: invoice.grand_total },
      performed_by: staff?.id || 'unknown',
    });
    return NextResponse.json(invoice, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
