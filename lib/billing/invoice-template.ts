// @ts-nocheck
// HEALTH1 HMIS — INVOICE PDF TEMPLATE
import type { BillingEncounter, BillingLineItem, BillingInvoice, BillingPayment } from './billing-v2-types';
import { PAYOR_TYPE_LABELS, PAYMENT_MODE_LABELS, SERVICE_CATEGORY_LABELS } from './billing-v2-types';

function formatINR(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatINRWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen',
    'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertToWords(n: number): string {
    if (n === 0) return 'Zero';
    if (n < 0) return 'Minus ' + convertToWords(-n);
    let result = '';
    if (Math.floor(n / 10000000) > 0) { result += convertToWords(Math.floor(n / 10000000)) + ' Crore '; n %= 10000000; }
    if (Math.floor(n / 100000) > 0) { result += convertToWords(Math.floor(n / 100000)) + ' Lakh '; n %= 100000; }
    if (Math.floor(n / 1000) > 0) { result += convertToWords(Math.floor(n / 1000)) + ' Thousand '; n %= 1000; }
    if (Math.floor(n / 100) > 0) { result += convertToWords(Math.floor(n / 100)) + ' Hundred '; n %= 100; }
    if (n > 0) {
      if (result !== '') result += 'and ';
      if (n < 20) result += ones[n];
      else { result += tens[Math.floor(n / 10)]; if (n % 10 > 0) result += ' ' + ones[n % 10]; }
    }
    return result.trim();
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  let words = 'Rupees ' + convertToWords(rupees);
  if (paise > 0) words += ' and ' + convertToWords(paise) + ' Paise';
  words += ' Only';
  return words;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface InvoicePDFData {
  invoice: BillingInvoice;
  encounter: BillingEncounter;
  lineItems: BillingLineItem[];
  payments: BillingPayment[];
  centreName: string;
  centreAddress: string;
  centrePhone: string;
  centreGSTIN?: string;
  centreLogo?: string;
}

export function generateInvoiceHTML(data: InvoicePDFData): string {
  const { invoice, encounter, lineItems, payments, centreName, centreAddress, centrePhone, centreGSTIN, centreLogo } = data;
  const activeItems = lineItems.filter(li => li.status === 'ACTIVE');
  const isIPD = ['IPD', 'ER', 'DAYCARE'].includes(encounter.encounter_type);

  const deptGroups: Record<string, BillingLineItem[]> = {};
  activeItems.forEach(li => { if (!deptGroups[li.department]) deptGroups[li.department] = []; deptGroups[li.department].push(li); });

  const deptTotals = Object.entries(deptGroups).map(([dept, items]) => ({
    dept, count: items.length,
    gross: items.reduce((s, i) => s + i.gross_amount, 0),
    discount: items.reduce((s, i) => s + i.discount_amount, 0),
    net: items.reduce((s, i) => s + i.net_amount, 0),
  }));

  const totalPayments = payments.filter(p => p.status === 'COMPLETED' && ['COLLECTION', 'ADVANCE', 'DEPOSIT'].includes(p.payment_type)).reduce((s, p) => s + p.amount, 0);

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>
@page { size: A4; margin: 12mm 10mm 15mm 10mm; }
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9pt; color: #1a1a1a; line-height: 1.4; }
.header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0A2540; padding-bottom: 8px; margin-bottom: 10px; }
.header-left { display: flex; align-items: center; gap: 10px; }
.header-logo { width: 50px; height: 50px; }
.hospital-name { font-size: 16pt; font-weight: 700; color: #0A2540; }
.hospital-subtitle { font-size: 7pt; color: #666; letter-spacing: 1px; text-transform: uppercase; }
.header-right { text-align: right; }
.invoice-title { font-size: 14pt; font-weight: 700; color: #0A2540; text-transform: uppercase; letter-spacing: 2px; }
.invoice-number { font-size: 9pt; color: #444; font-family: monospace; margin-top: 2px; }
.info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
.info-box { border: 1px solid #ddd; border-radius: 4px; padding: 8px 10px; }
.info-label { font-size: 7pt; color: #888; text-transform: uppercase; }
.info-value { font-size: 9pt; font-weight: 600; color: #1a1a1a; margin-top: 1px; }
table { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
th { background: #f0f2f5; font-size: 7pt; font-weight: 700; text-transform: uppercase; color: #555; padding: 5px 6px; border-bottom: 1px solid #ddd; }
td { padding: 4px 6px; font-size: 8.5pt; border-bottom: 1px solid #eee; }
.text-right { text-align: right; } .text-center { text-align: center; }
.mono { font-family: 'Consolas', monospace; } .bold { font-weight: 700; }
.dept-header { background: #f8f9fa; font-weight: 700; font-size: 8pt; color: #0A2540; }
.dept-subtotal { background: #f0f2f5; font-weight: 600; }
.summary-table { width: 280px; margin-left: auto; }
.summary-table td { padding: 3px 6px; font-size: 9pt; }
.summary-total { border-top: 2px solid #0A2540; font-weight: 700; font-size: 11pt; color: #0A2540; }
.amount-words { font-size: 8pt; color: #555; font-style: italic; margin: 6px 0; padding: 4px 8px; background: #f8f9fa; border-left: 3px solid #0A2540; }
.insurance-banner { background: #e8f4fd; border: 1px solid #b8daff; border-radius: 4px; padding: 6px 10px; margin-bottom: 8px; font-size: 8pt; }
.footer { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 8px; display: flex; justify-content: space-between; font-size: 7pt; color: #888; }
.signature-box { text-align: center; width: 180px; }
.signature-line { border-top: 1px solid #999; margin-top: 30px; padding-top: 4px; font-size: 7pt; color: #666; }
</style></head><body>

<div class="header">
<div class="header-left">
${centreLogo ? `<img src="data:image/png;base64,${centreLogo}" class="header-logo" />` : ''}
<div><div class="hospital-name">${centreName}</div>
<div class="hospital-subtitle">Super Speciality Hospital</div>
<div style="font-size:7pt;color:#666;margin-top:2px;">${centreAddress}<br/>Phone: ${centrePhone}${centreGSTIN ? ` | GSTIN: ${centreGSTIN}` : ''}</div></div></div>
<div class="header-right">
<div class="invoice-title">${invoice.invoice_type === 'OPD' ? 'OPD Bill' : invoice.invoice_type === 'IPD_INTERIM' ? 'Interim Bill' : invoice.invoice_type === 'IPD_FINAL' ? 'Final Bill' : invoice.invoice_type === 'PHARMACY' ? 'Pharmacy Bill' : 'Tax Invoice'}</div>
<div class="invoice-number">${invoice.invoice_number}</div>
<div style="font-size:8pt;color:#666;margin-top:2px;">Date: ${formatDate(invoice.invoice_date)}</div></div></div>

<div class="info-grid">
<div class="info-box"><div class="info-label">Patient</div><div class="info-value">${encounter.patient_name || '—'}</div>
<div style="font-size:8pt;color:#555;margin-top:2px;">UHID: ${encounter.patient_uhid || '—'} | Phone: ${encounter.patient_phone || '—'}</div></div>
<div class="info-box"><div class="info-label">Encounter Details</div><div class="info-value">${encounter.encounter_number}</div>
<div style="font-size:8pt;color:#555;margin-top:2px;">Type: ${encounter.encounter_type}${isIPD && encounter.admission_date ? ` | Admitted: ${formatDate(encounter.admission_date)}` : ''}${encounter.actual_discharge_date ? ` | Discharged: ${formatDate(encounter.actual_discharge_date)}` : ''}</div></div></div>

${encounter.primary_payor_type !== 'SELF_PAY' ? `<div class="insurance-banner"><strong>Payor:</strong> ${PAYOR_TYPE_LABELS[encounter.primary_payor_type]}${encounter.insurance_company?.company_name ? ` — ${encounter.insurance_company.company_name}` : ''}${encounter.insurance_policy_number ? ` | Policy: ${encounter.insurance_policy_number}` : ''}${encounter.insurance_approved_amount > 0 ? ` | Approved: ${formatINR(encounter.insurance_approved_amount)}` : ''}</div>` : ''}

<table><thead><tr><th style="width:8%">#</th><th style="width:8%">Date</th><th style="width:34%">Service</th><th style="width:8%" class="text-center">Qty</th><th style="width:12%" class="text-right">Rate</th><th style="width:10%" class="text-right">Disc</th><th style="width:8%" class="text-right">Tax</th><th style="width:12%" class="text-right">Net</th></tr></thead><tbody>
${Object.entries(deptGroups).map(([dept, items]) => {
  const deptTotal = items.reduce((s, i) => s + i.net_amount, 0); let idx = 0;
  return `<tr class="dept-header"><td colspan="8" style="padding:4px 6px;">${dept}</td></tr>
${items.map(li => { idx++; return `<tr${li.covered_by_package ? ' style="color:#999;"' : ''}><td class="mono text-center">${idx}</td><td>${formatDate(li.service_date)}</td><td>${li.service_name}${li.covered_by_package ? '<span style="font-size:6pt;color:#0066cc;"> [PKG]</span>' : ''}${li.service_doctor_name ? `<br/><span style="font-size:7pt;color:#888;">Dr. ${li.service_doctor_name}</span>` : ''}</td><td class="text-center mono">${li.quantity}</td><td class="text-right mono">${formatINR(li.unit_rate)}</td><td class="text-right mono">${li.discount_amount > 0 ? formatINR(li.discount_amount) : '—'}</td><td class="text-right mono">${li.tax_amount > 0 ? formatINR(li.tax_amount) : '—'}</td><td class="text-right mono bold">${formatINR(li.net_amount)}</td></tr>`; }).join('')}
<tr class="dept-subtotal"><td colspan="7" class="text-right" style="font-size:8pt;">Subtotal — ${dept}</td><td class="text-right mono bold">${formatINR(deptTotal)}</td></tr>`;
}).join('')}</tbody></table>

<table class="summary-table">
<tr><td>Gross Charges</td><td class="text-right mono">${formatINR(invoice.subtotal)}</td></tr>
${invoice.total_discount > 0 ? `<tr><td>Less: Discount</td><td class="text-right mono" style="color:#c00;">-${formatINR(invoice.total_discount)}</td></tr>` : ''}
${invoice.total_tax > 0 ? `<tr><td>Add: GST</td><td class="text-right mono">${formatINR(invoice.total_tax)}</td></tr>` : ''}
<tr class="summary-total"><td style="padding-top:4px;">Net Amount Payable</td><td class="text-right mono" style="padding-top:4px;">${formatINR(invoice.grand_total)}</td></tr>
${totalPayments > 0 ? `<tr><td style="font-size:8pt;">Less: Amount Paid</td><td class="text-right mono" style="font-size:8pt;color:#060;">${formatINR(totalPayments)}</td></tr><tr style="border-top:1px solid #999;"><td class="bold">Balance Due</td><td class="text-right mono bold" style="color:${invoice.balance_due > 0 ? '#c00' : '#060'};">${formatINR(invoice.balance_due)}</td></tr>` : ''}
</table>

<div class="amount-words">Amount in words: <strong>${formatINRWords(invoice.grand_total)}</strong></div>

${payments.length > 0 ? `<div class="payments-section"><h4 style="font-size:8pt;color:#0A2540;margin-bottom:4px;">Payment Details</h4>
<table><thead><tr><th>Date</th><th>Receipt #</th><th>Mode</th><th>Reference</th><th class="text-right">Amount</th></tr></thead><tbody>
${payments.filter(p => p.status === 'COMPLETED').map(p => `<tr><td>${formatDateTime(p.payment_date)}</td><td class="mono">${p.receipt_number}</td><td>${PAYMENT_MODE_LABELS[p.payment_mode] || p.payment_mode}</td><td>${p.payment_reference || '—'}</td><td class="text-right mono bold">${formatINR(p.amount)}</td></tr>`).join('')}
</tbody></table></div>` : ''}

<div class="footer"><div><div style="font-size:8pt;color:#555;">Generated: ${formatDateTime(new Date().toISOString())} | ${invoice.invoice_number}</div><div style="margin-top:2px;">This is a computer-generated document.</div></div><div class="signature-box"><div class="signature-line">Authorised Signatory</div></div></div>
</body></html>`;
}

export function generateReceiptHTML(data: InvoicePDFData): string {
  const { invoice, encounter, payments } = data;
  const latestPayment = payments.filter(p => p.status === 'COMPLETED').sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime())[0];

  return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>@page { size: 80mm auto; margin: 3mm; } * { margin: 0; padding: 0; } body { font-family: monospace; font-size: 9pt; color: #000; } .center { text-align: center; } .bold { font-weight: bold; } .divider { border-top: 1px dashed #000; margin: 4px 0; } .row { display: flex; justify-content: space-between; }</style></head><body>
<div class="center bold" style="font-size:11pt;">${data.centreName}</div>
<div class="center" style="font-size:7pt;">${data.centreAddress}</div>
<div class="center" style="font-size:7pt;">Ph: ${data.centrePhone}</div>
<div class="divider"></div>
<div class="center bold" style="font-size:10pt;">PAYMENT RECEIPT</div>
<div class="center" style="font-size:8pt;">${latestPayment?.receipt_number || invoice.invoice_number}</div>
<div class="center" style="font-size:7pt;">${formatDateTime(new Date().toISOString())}</div>
<div class="divider"></div>
<div class="row"><span>Patient:</span><span class="bold">${encounter.patient_name}</span></div>
<div class="row"><span>UHID:</span><span>${encounter.patient_uhid}</span></div>
<div class="row"><span>Bill No:</span><span>${invoice.invoice_number}</span></div>
<div class="row"><span>Type:</span><span>${encounter.encounter_type}</span></div>
<div class="divider"></div>
<div class="row"><span>Bill Amount:</span><span>${formatINR(invoice.grand_total)}</span></div>
${latestPayment ? `<div class="row"><span>Paid Now:</span><span class="bold">${formatINR(latestPayment.amount)}</span></div>
<div class="row"><span>Mode:</span><span>${PAYMENT_MODE_LABELS[latestPayment.payment_mode]}</span></div>` : ''}
<div class="divider"></div>
<div class="row"><span>Total Paid:</span><span>${formatINR(invoice.amount_paid)}</span></div>
<div class="row bold"><span>Balance:</span><span>${formatINR(invoice.balance_due)}</span></div>
<div class="divider"></div>
<div class="center" style="font-size:7pt;margin-top:4px;">Thank you for choosing Health1<br/>Get well soon!</div>
</body></html>`;
}
