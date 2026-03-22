// app/api/cron/daily-report/route.ts
// Vercel Cron — runs daily at 8 AM IST (2:30 UTC)
// Queries yesterday's data per active centre and emails summary to subscribers

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || '';
if (!APP_URL && process.env.NODE_ENV === 'production') {
  console.warn('[CRON] NEXT_PUBLIC_APP_URL is not set. Email links will be broken. Set this env var to your deployment URL.');
}

function adminSb() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY);
}

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

// ============================================================
// YESTERDAY'S DATA QUERIES
// ============================================================
async function getDailySummary(sb: any, centreId: string, dateStr: string) {
  const [bills, admissions, discharges, labOrders, opdVisits, beds] = await Promise.all([
    sb.from('hmis_bills')
      .select('gross_amount, net_amount, paid_amount, balance_amount, bill_type, payor_type')
      .eq('centre_id', centreId).eq('bill_date', dateStr).neq('status', 'cancelled'),
    sb.from('hmis_admissions')
      .select('id')
      .eq('centre_id', centreId).gte('admission_date', dateStr + 'T00:00:00').lte('admission_date', dateStr + 'T23:59:59'),
    sb.from('hmis_admissions')
      .select('id')
      .eq('centre_id', centreId).gte('actual_discharge', dateStr + 'T00:00:00').lte('actual_discharge', dateStr + 'T23:59:59'),
    sb.from('hmis_lab_orders')
      .select('id')
      .eq('centre_id', centreId).gte('created_at', dateStr + 'T00:00:00').lte('created_at', dateStr + 'T23:59:59'),
    sb.from('hmis_opd_visits')
      .select('id')
      .eq('centre_id', centreId).gte('check_in_time', dateStr + 'T00:00:00').lte('check_in_time', dateStr + 'T23:59:59'),
    sb.from('hmis_beds')
      .select('id, status')
      .eq('centre_id', centreId),
  ]);

  const billRows = bills.data || [];
  const gross = billRows.reduce((s: number, b: any) => s + parseFloat(b.gross_amount || 0), 0);
  const net = billRows.reduce((s: number, b: any) => s + parseFloat(b.net_amount || 0), 0);
  const paid = billRows.reduce((s: number, b: any) => s + parseFloat(b.paid_amount || 0), 0);
  const outstanding = billRows.reduce((s: number, b: any) => s + parseFloat(b.balance_amount || 0), 0);
  const opdBills = billRows.filter((b: any) => b.bill_type === 'opd').length;
  const ipdBills = billRows.filter((b: any) => b.bill_type === 'ipd').length;

  const totalBeds = (beds.data || []).length;
  const occupiedBeds = (beds.data || []).filter((b: any) => b.status === 'occupied').length;
  const occupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  // Current IPD census (active admissions)
  const { count: ipdCensus } = await sb.from('hmis_admissions')
    .select('id', { count: 'exact', head: true })
    .eq('centre_id', centreId).eq('status', 'active');

  return {
    gross, net, paid, outstanding,
    billCount: billRows.length, opdBills, ipdBills,
    newAdmissions: (admissions.data || []).length,
    discharges: (discharges.data || []).length,
    labOrders: (labOrders.data || []).length,
    opdCount: (opdVisits.data || []).length,
    ipdCensus: ipdCensus || 0,
    occupiedBeds, totalBeds, occupancy,
  };
}

// ============================================================
// HTML EMAIL TEMPLATE
// ============================================================
function buildEmailHTML(centreName: string, dateStr: string, d: any) {
  const dateFormatted = new Date(dateStr).toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>
    body{font-family:'Segoe UI',Arial,sans-serif;margin:0;padding:0;background:#f5f5f5}
    .container{max-width:600px;margin:0 auto;background:#fff}
    .header{background:linear-gradient(135deg,#0d9488,#0f766e);padding:24px 30px;color:#fff}
    .header h1{margin:0;font-size:20px;font-weight:700}
    .header p{margin:4px 0 0;opacity:0.85;font-size:12px}
    .content{padding:24px 30px}
    .kpi-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:16px 0}
    .kpi{background:#f8fafc;border-radius:8px;padding:14px;text-align:center;border:1px solid #e2e8f0}
    .kpi .value{font-size:22px;font-weight:700;color:#0d9488}
    .kpi .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-top:2px}
    table{width:100%;border-collapse:collapse;font-size:13px;margin:12px 0}
    th{background:#f1f5f9;text-align:left;padding:8px 12px;font-size:11px;color:#475569;border-bottom:2px solid #e2e8f0}
    td{padding:8px 12px;border-bottom:1px solid #f1f5f9}
    .right{text-align:right}
    .footer{background:#f8fafc;padding:16px 30px;font-size:10px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0}
    .btn{display:inline-block;background:#0d9488;color:#fff;padding:10px 24px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;margin-top:12px}
    .emerald{color:#059669}
    .red{color:#dc2626}
  </style></head><body><div class="container">
    <div class="header">
      <h1>HMIS Daily Report</h1>
      <p>${centreName} — ${dateFormatted}</p>
    </div>
    <div class="content">
      <div class="kpi-grid">
        <div class="kpi"><div class="value emerald">${fmt(d.paid)}</div><div class="label">Collected (₹)</div></div>
        <div class="kpi"><div class="value">${fmt(d.net)}</div><div class="label">Net Revenue (₹)</div></div>
        <div class="kpi"><div class="value ${d.outstanding > 0 ? 'red' : ''}">${fmt(d.outstanding)}</div><div class="label">Outstanding (₹)</div></div>
      </div>

      <table>
        <thead><tr><th>Metric</th><th class="right">Value</th></tr></thead>
        <tbody>
          <tr><td>OPD Visits</td><td class="right"><b>${d.opdCount}</b></td></tr>
          <tr><td>New Admissions</td><td class="right"><b>${d.newAdmissions}</b></td></tr>
          <tr><td>Discharges</td><td class="right"><b>${d.discharges}</b></td></tr>
          <tr><td>IPD Census (current)</td><td class="right"><b>${d.ipdCensus}</b></td></tr>
          <tr><td>Bed Occupancy</td><td class="right"><b>${d.occupancy}%</b> (${d.occupiedBeds}/${d.totalBeds})</td></tr>
          <tr><td>Lab Orders</td><td class="right"><b>${d.labOrders}</b></td></tr>
          <tr><td>Total Bills</td><td class="right"><b>${d.billCount}</b> (OPD: ${d.opdBills}, IPD: ${d.ipdBills})</td></tr>
          <tr><td>Gross Revenue</td><td class="right">₹${fmt(d.gross)}</td></tr>
          <tr><td>Discount</td><td class="right">₹${fmt(d.gross - d.net)}</td></tr>
        </tbody>
      </table>

      ${APP_URL ? `<div style="text-align:center;margin-top:20px">
        <a href="${APP_URL}/reports" class="btn">View Full Reports →</a>` : `<div style="text-align:center;margin-top:20px;color:#94a3b8;font-size:11px">
        <span>Configure NEXT_PUBLIC_APP_URL to enable direct report links.</span>`}
      </div>
    </div>
    <div class="footer">
      This is an automated report from HMIS. Generated at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST.
      <br/>To unsubscribe, go to Settings → Report Subscriptions.
    </div>
  </div></body></html>`;
}

// ============================================================
// MAIN HANDLER
// ============================================================
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header)
  const authHeader = request.headers.get('authorization');
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    // Allow without secret in dev mode
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const sb = adminSb();
  if (!sb) return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });

  // Yesterday's date in IST
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istNow = new Date(now.getTime() + istOffset);
  const yesterday = new Date(istNow);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split('T')[0];

  try {
    // Get active daily subscriptions
    const { data: subs } = await sb
      .from('hmis_report_subscriptions')
      .select('*, centre:hmis_centres(id, name, code)')
      .eq('is_active', true)
      .eq('frequency', 'daily')
      .eq('report_type', 'daily_summary');

    if (!subs || subs.length === 0) {
      return NextResponse.json({ message: 'No active daily subscriptions', date: dateStr });
    }

    // Group by centre
    const byCentre = new Map<string, { centreName: string; centreId: string; emails: string[] }>();
    for (const s of subs) {
      const cid = s.centre?.id || s.centre_id;
      const cname = s.centre?.name || 'Hospital';
      if (!byCentre.has(cid)) byCentre.set(cid, { centreName: cname, centreId: cid, emails: [] });
      byCentre.get(cid)!.emails.push(s.email);
    }

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Init Resend
    const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

    for (const [centreId, info] of byCentre) {
      const summary = await getDailySummary(sb, centreId, dateStr);
      const html = buildEmailHTML(info.centreName, dateStr, summary);
      const subject = `Daily Report — ${info.centreName} — ${new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`;

      for (const email of info.emails) {
        if (!resend) {
          errors.push(`${email}: Resend not configured`);
          failed++;
          continue;
        }

        try {
          await resend.emails.send({
            from: 'HMIS <reports@hospital.com>',
            to: email,
            subject,
            html,
          });
          sent++;

          // Update last_sent_at
          await sb.from('hmis_report_subscriptions')
            .update({ last_sent_at: new Date().toISOString() })
            .eq('centre_id', centreId)
            .eq('email', email)
            .eq('report_type', 'daily_summary');
        } catch (err: any) {
          failed++;
          errors.push(`${email}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      date: dateStr,
      sent,
      failed,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    console.error('[CRON] Daily report error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
