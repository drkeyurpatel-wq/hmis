// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { billingDb } from '@/lib/billing/api-helpers';

export async function GET(request: NextRequest, { params }: { params: { invoiceId: string } }) {
  const supabase = billingDb();
  const format = request.nextUrl.searchParams.get('format') || 'pdf';

  try {
    const { data: invoice, error } = await supabase.from('billing_invoices')
      .select('*').eq('id', params.invoiceId).single();
    if (error || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { data: encounter } = await supabase.from('billing_encounters')
      .select('*, billing_insurance_companies!billing_encounters_insurance_company_id_fkey (company_name, company_code)')
      .eq('id', invoice.encounter_id).single();

    const { data: patient } = await supabase.from('patients')
      .select('first_name, last_name, uhid, phone, gender, date_of_birth')
      .eq('id', invoice.patient_id).single();

    const { data: invoiceLineItems } = await supabase.from('billing_invoice_line_items')
      .select('line_item_id').eq('invoice_id', invoice.id);
    const lineItemIds = (invoiceLineItems || []).map((ili: any) => ili.line_item_id);

    let lineItems: any[] = [];
    if (lineItemIds.length > 0) {
      const { data: items } = await supabase.from('billing_line_items').select('*')
        .in('id', lineItemIds).order('service_date', { ascending: true });
      lineItems = items || [];
      const doctorIds = new Set<string>();
      lineItems.forEach((li: any) => { if (li.service_doctor_id) doctorIds.add(li.service_doctor_id); });
      if (doctorIds.size > 0) {
        const { data: docs } = await supabase.from('doctors').select('id, name').in('id', Array.from(doctorIds));
        const docMap: Record<string, string> = {};
        (docs || []).forEach((d: any) => { docMap[d.id] = d.name; });
        lineItems = lineItems.map((li: any) => ({ ...li, service_doctor_name: li.service_doctor_id ? docMap[li.service_doctor_id] : null }));
      }
    }

    const { data: payments } = await supabase.from('billing_payments').select('*')
      .eq('encounter_id', invoice.encounter_id).eq('status', 'COMPLETED')
      .order('payment_date', { ascending: true });

    const { data: centre } = await supabase.from('centres')
      .select('name, address, phone, gstin').eq('id', invoice.centre_id).single();

    const enrichedEncounter = { ...encounter,
      patient_name: patient ? `${patient.first_name} ${patient.last_name || ''}`.trim() : 'Unknown',
      patient_uhid: patient?.uhid || '', patient_phone: patient?.phone || '',
      insurance_company: encounter?.billing_insurance_companies || null,
    };

    const { generateInvoiceHTML, generateReceiptHTML } = await import('@/lib/billing/invoice-template');
    const pdfData = { invoice, encounter: enrichedEncounter, lineItems, payments: payments || [],
      centreName: centre?.name || 'Health1 Super Speciality Hospital',
      centreAddress: centre?.address || '', centrePhone: centre?.phone || '',
      centreGSTIN: centre?.gstin || undefined };

    const html = format === 'receipt' ? generateReceiptHTML(pdfData) : generateInvoiceHTML(pdfData);

    if (request.nextUrl.searchParams.get('html') === 'true')
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });

    let pdfBuffer: Buffer;
    try {
      const playwright = await import('playwright');
      const browser = await playwright.chromium.launch({ headless: true });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle' });
      pdfBuffer = await page.pdf({ format: format === 'receipt' ? undefined : 'A4',
        width: format === 'receipt' ? '80mm' : undefined, printBackground: true,
        margin: format === 'receipt' ? { top: '3mm', right: '3mm', bottom: '3mm', left: '3mm' }
          : { top: '12mm', right: '10mm', bottom: '15mm', left: '10mm' } });
      await browser.close();
    } catch (playwrightError) {
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
    }

    return new NextResponse(pdfBuffer, { headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    } });
  } catch (error: any) { return NextResponse.json({ error: error.message }, { status: 500 }); }
}
