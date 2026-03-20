// components/billing/bill-pdf.tsx
// Professional A4 bill PDF + payment receipt — print via window.open
'use client';
import React from 'react';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

function openPrint(html: string, title: string) {
  const w = window.open('', '_blank', 'width=800,height=900');
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>@media print{@page{size:A4;margin:12mm}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}} body{margin:0;font-family:'Segoe UI',Arial,sans-serif;color:#1a1a1a;font-size:10px} .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e3a5f;padding-bottom:10px;margin-bottom:12px} .logo{font-size:20px;font-weight:800;color:#1e3a5f} .subtitle{font-size:8px;color:#666} .title-badge{background:#1e3a5f;color:white;padding:6px 16px;font-size:14px;font-weight:700;border-radius:4px} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:9px;padding:8px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;margin-bottom:10px} .grid2 b{color:#334155} table{width:100%;border-collapse:collapse;font-size:9px;margin-bottom:10px} th{background:#f1f5f9;padding:5px 8px;border:1px solid #e2e8f0;text-align:left;font-weight:600} td{padding:4px 8px;border:1px solid #e2e8f0} .amt{text-align:right;font-weight:600} .total-row{background:#eff6ff;font-weight:700;font-size:11px} .section{font-size:11px;font-weight:700;color:#1e3a5f;border-bottom:1px solid #1e3a5f;padding-bottom:2px;margin:10px 0 6px} .footer{display:flex;justify-content:space-between;margin-top:30px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:8px;color:#666} .sig{width:150px;border-bottom:1px solid #333;margin-bottom:4px} .watermark{text-align:center;font-size:7px;color:#aaa;margin-top:15px}</style></head><body>${html}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 300);
}

// ============================================================
// FULL TAX INVOICE
// ============================================================
export function printBillInvoice(bill: any, items: any[], payments: any[], patient: any, centre: any) {
  const gross = parseFloat(bill.gross_amount || 0);
  const disc = parseFloat(bill.discount_amount || 0);
  const tax = parseFloat(bill.tax_amount || 0);
  const net = parseFloat(bill.net_amount || 0);
  const paid = parseFloat(bill.paid_amount || 0);
  const bal = parseFloat(bill.balance_amount || 0);

  // Group items by category
  const byCategory = items.reduce((acc: Record<string, any[]>, item: any) => {
    const cat = item.category || item.description?.split(' ')[0] || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {});

  const itemRows = items.map((item: any, i: number) => `<tr>
    <td>${i + 1}</td><td>${item.description}</td><td style="text-align:center">${item.service_date || bill.bill_date}</td>
    <td style="text-align:center">${item.quantity || 1}</td><td class="amt">₹${fmt(parseFloat(item.unit_rate || 0))}</td>
    <td class="amt">${parseFloat(item.discount || 0) > 0 ? '₹' + fmt(parseFloat(item.discount)) : '—'}</td>
    <td class="amt">₹${fmt(parseFloat(item.net_amount || item.amount || 0))}</td>
  </tr>`).join('');

  const paymentRows = payments.map((p: any, i: number) => `<tr>
    <td>${new Date(p.created_at).toLocaleDateString('en-IN')}</td>
    <td>${p.payment_mode?.replace('_', ' ').toUpperCase()}</td>
    <td>${p.reference_number || '—'}</td>
    <td class="amt">₹${fmt(parseFloat(p.amount))}</td>
  </tr>`).join('');

  // Category subtotals
  const catSummary = Object.entries(byCategory).map(([cat, catItems]: [string, any[]]) => {
    const catTotal = catItems.reduce((s: number, i: any) => s + parseFloat(i.net_amount || i.amount || 0), 0);
    return `<tr><td colspan="6" style="padding-left:20px">${cat.replace('_', ' ')}</td><td class="amt">₹${fmt(catTotal)}</td></tr>`;
  }).join('');

  const html = `<div style="max-width:700px;margin:0 auto">
    <div class="header">
      <div><div class="logo">${centre?.name || 'Health1 Super Speciality Hospital'}</div>
        <div class="subtitle">${centre?.address || 'Shilaj, Ahmedabad'} | GSTIN: ${centre?.gstin || '24AABCH1234A1Z5'} | CIN: ${centre?.cin || ''}</div>
        <div class="subtitle">Ph: ${centre?.phone || ''} | Email: ${centre?.email || ''}</div></div>
      <div style="text-align:right"><div class="title-badge">TAX INVOICE</div>
        <div style="margin-top:4px;font-size:9px"><b>Bill #:</b> ${bill.bill_number}</div>
        <div style="font-size:9px"><b>Date:</b> ${bill.bill_date}</div>
        <div style="font-size:9px"><b>Type:</b> ${bill.bill_type?.toUpperCase()}</div></div>
    </div>
    <div class="grid2">
      <div><b>Patient:</b> ${patient?.first_name} ${patient?.last_name}</div><div><b>UHID:</b> ${patient?.uhid}</div>
      <div><b>Age/Sex:</b> ${patient?.age_years || '—'}yr / ${patient?.gender || '—'}</div><div><b>Phone:</b> ${patient?.phone_primary || '—'}</div>
      <div><b>Payor:</b> ${bill.payor_type?.replace('_', ' ').toUpperCase()}</div><div><b>IPD #:</b> ${bill.encounter_id ? 'IPD' : 'OPD'}</div>
    </div>
    <div class="section">BILL DETAILS</div>
    <table><thead><tr><th>#</th><th>Service</th><th>Date</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot>
        <tr class="total-row"><td colspan="6" style="text-align:right">Gross Total</td><td class="amt">₹${fmt(gross)}</td></tr>
        ${disc > 0 ? `<tr><td colspan="6" style="text-align:right;color:#ea580c">Discount</td><td class="amt" style="color:#ea580c">- ₹${fmt(disc)}</td></tr>` : ''}
        ${tax > 0 ? `<tr><td colspan="6" style="text-align:right">Tax</td><td class="amt">+ ₹${fmt(tax)}</td></tr>` : ''}
        <tr class="total-row" style="font-size:13px"><td colspan="6" style="text-align:right">NET PAYABLE</td><td class="amt">₹${fmt(net)}</td></tr>
      </tfoot>
    </table>
    ${payments.length > 0 ? `<div class="section">PAYMENTS RECEIVED</div>
    <table><thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>Amount</th></tr></thead>
      <tbody>${paymentRows}</tbody>
      <tfoot><tr class="total-row"><td colspan="3" style="text-align:right">Total Paid</td><td class="amt">₹${fmt(paid)}</td></tr>
        <tr style="font-size:12px;font-weight:700;${bal > 0 ? 'color:#dc2626' : 'color:#16a34a'}"><td colspan="3" style="text-align:right">${bal > 0 ? 'BALANCE DUE' : 'FULLY PAID'}</td><td class="amt">${bal > 0 ? '₹' + fmt(bal) : '₹0'}</td></tr>
      </tfoot>
    </table>` : `<div style="text-align:right;font-size:12px;font-weight:700;color:#dc2626;margin:10px 0">BALANCE DUE: ₹${fmt(bal)}</div>`}
    ${catSummary ? `<div class="section">CATEGORY SUMMARY</div><table><tbody>${catSummary}</tbody></table>` : ''}
    <div style="font-size:8px;color:#666;margin-top:10px;padding:8px;background:#f8fafc;border-radius:4px">
      <b>Amount in words:</b> ${numberToWords(Math.round(net))} Rupees Only<br/>
      <b>Terms:</b> All disputes subject to Ahmedabad jurisdiction. Payment due within 15 days of discharge. Interest @2% per month on overdue amounts.
    </div>
    <div class="footer">
      <div style="text-align:center"><div class="sig"></div>Billing Staff</div>
      <div style="text-align:center"><div class="sig"></div>Patient / Authorized Signatory</div>
      <div style="text-align:center"><div class="sig"></div>Authorized Signatory<br/>${centre?.name || 'Health1 Hospital'}</div>
    </div>
    <div class="watermark">Computer-generated Tax Invoice — ${centre?.name || 'Health1 Super Speciality Hospital'}</div>
  </div>`;

  openPrint(html, `Invoice ${bill.bill_number}`);
}

// ============================================================
// PAYMENT RECEIPT
// ============================================================
export function printPaymentReceipt(payment: any, bill: any, patient: any, centre: any) {
  const html = `<div style="max-width:500px;margin:0 auto">
    <div class="header">
      <div><div class="logo">${centre?.name || 'Health1 Super Speciality Hospital'}</div>
        <div class="subtitle">${centre?.address || 'Shilaj, Ahmedabad'}</div></div>
      <div style="text-align:right"><div class="title-badge" style="font-size:12px">PAYMENT RECEIPT</div></div>
    </div>
    <div class="grid2">
      <div><b>Receipt #:</b> ${payment.receipt_number || 'RCP-' + payment.id?.substring(0, 8)}</div>
      <div><b>Date:</b> ${new Date(payment.created_at).toLocaleDateString('en-IN')}</div>
      <div><b>Patient:</b> ${patient?.first_name} ${patient?.last_name}</div><div><b>UHID:</b> ${patient?.uhid}</div>
      <div><b>Bill #:</b> ${bill?.bill_number}</div><div><b>Mode:</b> ${payment.payment_mode?.replace('_', ' ').toUpperCase()}</div>
    </div>
    <div style="text-align:center;padding:20px;margin:15px 0;background:#eff6ff;border-radius:8px;border:2px solid #1e3a5f">
      <div style="font-size:10px;color:#666">Amount Received</div>
      <div style="font-size:28px;font-weight:800;color:#1e3a5f">₹${fmt(parseFloat(payment.amount))}</div>
      <div style="font-size:9px;color:#666;margin-top:4px">${numberToWords(Math.round(parseFloat(payment.amount)))} Rupees Only</div>
    </div>
    ${payment.reference_number ? `<div style="text-align:center;font-size:9px;color:#666">Ref / UTR: ${payment.reference_number}</div>` : ''}
    <div class="footer" style="margin-top:20px">
      <div style="text-align:center"><div class="sig"></div>Cashier</div>
      <div style="text-align:center"><div class="sig"></div>Patient / Authorized</div>
    </div>
    <div class="watermark">Computer-generated Receipt — ${centre?.name || 'Health1 Hospital'}</div>
  </div>`;

  openPrint(html, `Receipt ${payment.receipt_number || payment.id?.substring(0, 8)}`);
}

// ============================================================
// ESTIMATE / PROFORMA
// ============================================================
export function printEstimate(estimate: any, patient: any, centre: any) {
  const items = estimate.items || [];
  const total = parseFloat(estimate.total_estimated || 0);
  const itemRows = items.map((item: any, i: number) => `<tr>
    <td>${i + 1}</td><td>${item.description || item.name}</td><td class="amt">₹${fmt(parseFloat(item.amount || item.rate || 0))}</td>
  </tr>`).join('');

  const html = `<div style="max-width:600px;margin:0 auto">
    <div class="header">
      <div><div class="logo">${centre?.name || 'Health1 Super Speciality Hospital'}</div><div class="subtitle">${centre?.address || 'Shilaj, Ahmedabad'}</div></div>
      <div style="text-align:right"><div class="title-badge" style="background:#ea580c">COST ESTIMATE</div>
        <div style="font-size:9px;margin-top:4px">${estimate.estimate_number || ''}</div></div>
    </div>
    <div class="grid2">
      <div><b>Patient:</b> ${patient?.first_name} ${patient?.last_name}</div><div><b>UHID:</b> ${patient?.uhid}</div>
      <div><b>Procedure:</b> ${estimate.procedure_name || '—'}</div><div><b>Room:</b> ${estimate.room_category || '—'}</div>
      <div><b>Expected LOS:</b> ${estimate.expected_los_days || '—'} days</div><div><b>Valid until:</b> ${estimate.valid_until || '15 days'}</div>
    </div>
    <table><thead><tr><th>#</th><th>Item</th><th>Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr class="total-row"><td colspan="2" style="text-align:right">ESTIMATED TOTAL</td><td class="amt">₹${fmt(total)}</td></tr></tfoot>
    </table>
    <div style="padding:10px;background:#fef3c7;border:1px solid #fbbf24;border-radius:6px;font-size:9px;color:#92400e;margin-top:10px">
      <b>Important:</b> This is an estimate only. Actual charges may vary based on clinical condition, complications, ICU stay, consumables used, and duration of hospitalization. A minimum advance deposit of <b>₹${fmt(total * 0.5)}</b> (50%) is recommended at admission.
    </div>
    <div class="footer"><div style="text-align:center"><div class="sig"></div>Billing Department</div></div>
    <div class="watermark">Computer-generated Estimate — ${centre?.name || 'Health1 Hospital'}</div>
  </div>`;

  openPrint(html, `Estimate ${estimate.estimate_number || ''}`);
}

// Number to words (Indian system)
function numberToWords(n: number): string {
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + numberToWords(n % 100) : '');
  if (n < 100000) return numberToWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + numberToWords(n % 1000) : '');
  if (n < 10000000) return numberToWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + numberToWords(n % 100000) : '');
  return numberToWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + numberToWords(n % 10000000) : '');
}
