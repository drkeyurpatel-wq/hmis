// components/billing/bill-pdf.ts
// Print functions — opens new window with formatted HTML for printing

const fmt = (n: number) => Math.round(parseFloat(String(n)) || 0).toLocaleString('en-IN');

const STYLE = `<style>body{font-family:'Segoe UI',sans-serif;margin:25px;font-size:12px;color:#333}
table{width:100%;border-collapse:collapse;margin:12px 0}th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
th{background:#f5f5f5;font-size:11px}.r{text-align:right}.b{font-weight:bold}
.header{display:flex;justify-content:space-between;border-bottom:2px solid #0d9488;padding-bottom:10px;margin-bottom:15px}
.logo{font-size:18px;font-weight:bold;color:#0d9488}.sub{color:#666;font-size:10px}
.box{padding:10px;background:#f9fafb;border-radius:4px;margin-bottom:12px}
.total-row td{background:#f0fdf4;font-weight:bold;font-size:13px}
@media print{@page{margin:12mm}body{margin:0}}</style>`;

export function printBillInvoice(bill: any, items: any[], payments: any[], patient: any, hospital: any) {
  const w = window.open('', '_blank');
  if (!w) return;
  const net = parseFloat(bill.net_amount || 0);
  const paid = parseFloat(bill.paid_amount || 0);
  const bal = net - paid;

  w.document.write(`<html><head><title>Invoice ${bill.bill_number}</title>${STYLE}</head><body>
    <div class="header"><div><div class="logo">${hospital.name || 'Hospital'}</div>
    <div class="sub">${hospital.address || 'Shilaj, Ahmedabad'}</div>
    ${hospital.gstin ? `<div class="sub">GSTIN: ${hospital.gstin}</div>` : ''}</div>
    <div style="text-align:right"><div class="b" style="font-size:15px">${bill.bill_number}</div>
    <div>Date: ${bill.bill_date}</div><div>Type: ${(bill.bill_type || 'OPD').toUpperCase()}</div></div></div>

    <div class="box" style="display:flex;justify-content:space-between">
    <div><div class="b">Patient</div><div>${patient.first_name || ''} ${patient.last_name || ''}</div>
    <div>UHID: ${patient.uhid || '-'}</div><div>Phone: ${patient.phone_primary || '-'}</div></div>
    <div style="text-align:right"><div class="b">Payor</div><div>${(bill.payor_type || 'Self').replace('_',' ').toUpperCase()}</div></div></div>

    <table><thead><tr><th>#</th><th>Service</th><th class="r">Qty</th><th class="r">Rate</th>
    <th class="r">Amount</th><th class="r">Disc</th><th class="r b">Net</th></tr></thead><tbody>
    ${(items || []).map((it: any, i: number) => `<tr><td>${i+1}</td><td>${it.description}</td>
    <td class="r">${it.quantity || 1}</td><td class="r">₹${fmt(it.unit_rate)}</td>
    <td class="r">₹${fmt(it.amount || it.unit_rate * (it.quantity || 1))}</td>
    <td class="r">${parseFloat(it.discount || 0) > 0 ? `₹${fmt(it.discount)}` : '-'}</td>
    <td class="r b">₹${fmt(it.net_amount)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="6" class="r">Net Amount</td><td class="r">₹${fmt(net)}</td></tr>
    </tbody></table>

    ${payments && payments.length > 0 ? `<div class="b" style="margin-top:10px">Payments</div>
    <table><thead><tr><th>Date</th><th>Mode</th><th>Reference</th><th>Receipt</th><th class="r">Amount</th></tr></thead><tbody>
    ${payments.map((p: any) => `<tr><td>${p.payment_date || bill.bill_date}</td>
    <td>${(p.payment_mode || p.mode || 'cash').replace('_',' ')}</td>
    <td>${p.reference_number || '-'}</td><td>${p.receipt_number || '-'}</td>
    <td class="r b">₹${fmt(p.amount)}</td></tr>`).join('')}
    </tbody></table>` : ''}

    <div style="display:flex;justify-content:flex-end;margin-top:8px"><div style="width:220px">
    <div style="display:flex;justify-content:space-between;padding:3px 0"><span>Gross</span><span>₹${fmt(parseFloat(bill.gross_amount || net))}</span></div>
    ${parseFloat(bill.discount_amount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;color:red"><span>Discount</span><span>-₹${fmt(bill.discount_amount)}</span></div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:4px 0;border-top:2px solid #333;font-size:13px" class="b"><span>Net</span><span>₹${fmt(net)}</span></div>
    <div style="display:flex;justify-content:space-between;padding:3px 0;color:green"><span>Paid</span><span>₹${fmt(paid)}</span></div>
    ${bal > 0 ? `<div style="display:flex;justify-content:space-between;padding:3px 0;color:red" class="b"><span>Balance</span><span>₹${fmt(bal)}</span></div>` : ''}
    </div></div>

    <div style="margin-top:30px;font-size:9px;color:#999;display:flex;justify-content:space-between">
    <div>Printed: ${new Date().toLocaleString('en-IN')}</div><div>HMIS</div></div>
    </body></html>`);
  w.document.close();
  w.print();
}

export function printPaymentReceipt(payment: any, bill: any, patient: any, hospital: any) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(`<html><head><title>Receipt ${payment.receipt_number || ''}</title>${STYLE}</head><body>
    <div class="header"><div><div class="logo">${hospital.name || 'Hospital'}</div>
    <div class="sub">${hospital.address || 'Shilaj, Ahmedabad'}</div></div>
    <div style="text-align:right"><div class="b" style="font-size:15px">RECEIPT</div>
    <div>${payment.receipt_number || ''}</div></div></div>

    <div class="box">
    <div><b>Patient:</b> ${patient.first_name || ''} ${patient.last_name || ''} (${patient.uhid || '-'})</div>
    <div><b>Bill:</b> ${bill.bill_number || '-'} | <b>Date:</b> ${payment.payment_date || bill.bill_date || '-'}</div>
    </div>

    <table><tr><th>Mode</th><td>${(payment.payment_mode || payment.mode || 'cash').replace('_',' ').toUpperCase()}</td></tr>
    <tr><th>Amount</th><td class="b" style="font-size:16px;color:green">₹${fmt(payment.amount)}</td></tr>
    <tr><th>Reference</th><td>${payment.reference_number || '-'}</td></tr></table>

    <div style="margin-top:30px;font-size:9px;color:#999">Printed: ${new Date().toLocaleString('en-IN')} | HMIS</div>
    </body></html>`);
  w.document.close();
  w.print();
}

export function printEstimate(estimate: any, items: any[], patient: any, hospital: any) {
  const w = window.open('', '_blank');
  if (!w) return;
  const total = (items || []).reduce((s: number, i: any) => s + parseFloat(i.amount || i.net_amount || 0), 0);
  w.document.write(`<html><head><title>Estimate</title>${STYLE}</head><body>
    <div class="header"><div><div class="logo">${hospital?.name || 'Hospital'}</div>
    <div class="sub">${hospital?.address || 'Shilaj, Ahmedabad'}</div></div>
    <div style="text-align:right"><div class="b" style="font-size:15px">ESTIMATE</div>
    <div>${estimate?.estimate_number || ''}</div></div></div>

    <div class="box"><div><b>Patient:</b> ${patient?.first_name || ''} ${patient?.last_name || ''} (${patient?.uhid || '-'})</div></div>

    <table><thead><tr><th>#</th><th>Service</th><th class="r">Rate</th><th class="r">Qty</th><th class="r b">Amount</th></tr></thead><tbody>
    ${(items || []).map((it: any, i: number) => `<tr><td>${i+1}</td><td>${it.description || it.service_name || '-'}</td>
    <td class="r">₹${fmt(it.unit_rate || it.rate || 0)}</td><td class="r">${it.quantity || 1}</td>
    <td class="r b">₹${fmt(it.amount || it.net_amount || 0)}</td></tr>`).join('')}
    <tr class="total-row"><td colspan="4" class="r">Estimated Total</td><td class="r">₹${fmt(total)}</td></tr>
    </tbody></table>

    <div style="margin-top:8px;font-size:10px;color:#666">This is an estimate only. Actual charges may vary based on clinical requirements.</div>
    <div style="margin-top:20px;font-size:9px;color:#999">Printed: ${new Date().toLocaleString('en-IN')} | HMIS</div>
    </body></html>`);
  w.document.close();
  w.print();
}
