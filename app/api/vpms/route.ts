// app/api/vpms/route.ts
// Server-side bridge: HMIS → VPMS Supabase
// Uses VPMS service role key for cross-project read access
// All queries are read-only

import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/api/auth-guard';

function getVPMSClient() {
  const url = process.env.VPMS_SUPABASE_URL;
  const key = process.env.VPMS_SUPABASE_SERVICE_KEY; // Service role for cross-project
  if (!url || !key) return null;
  const { createClient } = require('@supabase/supabase-js');
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  const { error: authError } = await requireAuthOrApiKey(req);
  if (authError) return authError;

  const vpms = getVPMSClient();
  if (!vpms) {
    return NextResponse.json({
      configured: false,
      error: 'VPMS not configured. Set VPMS_SUPABASE_URL and VPMS_SUPABASE_SERVICE_KEY in environment.',
    });
  }

  const action = req.nextUrl.searchParams.get('action') || 'summary';
  const centreCode = req.nextUrl.searchParams.get('centre'); // SHI, VAS, MOD, etc.

  try {
    // Resolve centre code to centre ID in VPMS
    let vpmscentreId: string | undefined;
    if (centreCode) {
      const { data: centre } = await vpms.from('centres').select('id').eq('code', centreCode).single();
      vpmscentreId = centre?.id;
    }

    if (action === 'summary') {
      return NextResponse.json(await getSummary(vpms, vpmscentreId));
    }
    if (action === 'recent_pos') {
      return NextResponse.json(await getRecentPOs(vpms, vpmscentreId));
    }
    if (action === 'pending_grns') {
      return NextResponse.json(await getPendingGRNs(vpms, vpmscentreId));
    }
    if (action === 'overdue_payments') {
      return NextResponse.json(await getOverduePayments(vpms, vpmscentreId));
    }
    if (action === 'vendor_payables') {
      return NextResponse.json(await getVendorPayables(vpms, vpmscentreId));
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('[VPMS API]', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ============================================================
// Summary — all KPIs in 5 parallel queries
// ============================================================
async function getSummary(vpms: any, centreId?: string) {
  const today = new Date().toISOString().split('T')[0];
  const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
  const month30 = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

  const [vendorRes, poRes, grnRes, invRes, recentPoRes] = await Promise.allSettled([
    vpms.from('vendors').select('id, status').is('deleted_at', null),
    (() => {
      let q = vpms.from('purchase_orders').select('id, status, total_amount, po_date').is('deleted_at', null).not('status', 'in', '(cancelled,closed)');
      if (centreId) q = q.eq('centre_id', centreId);
      return q;
    })(),
    (() => {
      let q = vpms.from('grns').select('id, status, grn_date');
      if (centreId) q = q.eq('centre_id', centreId);
      return q;
    })(),
    (() => {
      let q = vpms.from('invoices').select('id, match_status, payment_status, total_amount, due_date, vendor_invoice_date').is('deleted_at', null);
      if (centreId) q = q.eq('centre_id', centreId);
      return q;
    })(),
    (() => {
      let q = vpms.from('purchase_orders')
        .select('id, po_number, status, total_amount, po_date, vendor:vendors(legal_name)')
        .is('deleted_at', null).order('created_at', { ascending: false }).limit(5);
      if (centreId) q = q.eq('centre_id', centreId);
      return q;
    })(),
  ]);

  const vendors = vendorRes.status === 'fulfilled' ? vendorRes.value.data || [] : [];
  const pos = poRes.status === 'fulfilled' ? poRes.value.data || [] : [];
  const grns = grnRes.status === 'fulfilled' ? grnRes.value.data || [] : [];
  const invoices = invRes.status === 'fulfilled' ? invRes.value.data || [] : [];
  const recentPOs = recentPoRes.status === 'fulfilled' ? recentPoRes.value.data || [] : [];

  const unpaid = invoices.filter((i: any) => i.payment_status === 'unpaid' || i.payment_status === 'partial');
  const overdue = unpaid.filter((i: any) => i.due_date && i.due_date < today);
  const dueThisWeek = unpaid.filter((i: any) => i.due_date && i.due_date >= today && i.due_date <= weekLater);
  const poThisMonth = pos.filter((p: any) => p.po_date >= month30);

  return {
    configured: true,
    vendors: {
      active: vendors.filter((v: any) => v.status === 'active').length,
      pending: vendors.filter((v: any) => v.status === 'pending').length,
      total: vendors.length,
    },
    purchaseOrders: {
      total: pos.length,
      draft: pos.filter((p: any) => p.status === 'draft').length,
      pendingApproval: pos.filter((p: any) => p.status === 'pending_approval').length,
      approved: pos.filter((p: any) => p.status === 'approved').length,
      sentToVendor: pos.filter((p: any) => p.status === 'sent_to_vendor').length,
      partiallyReceived: pos.filter((p: any) => p.status === 'partially_received').length,
      totalValue: pos.reduce((s: number, p: any) => s + parseFloat(p.total_amount || 0), 0),
      thisMonth: poThisMonth.length,
      thisMonthValue: poThisMonth.reduce((s: number, p: any) => s + parseFloat(p.total_amount || 0), 0),
    },
    grns: {
      pending: grns.filter((g: any) => g.status === 'draft' || g.status === 'submitted').length,
      verified: grns.filter((g: any) => g.status === 'verified').length,
      discrepancy: grns.filter((g: any) => g.status === 'discrepancy').length,
    },
    invoices: {
      total: invoices.length,
      pending: invoices.filter((i: any) => i.match_status === 'pending').length,
      matched: invoices.filter((i: any) => i.match_status === 'matched').length,
      mismatch: invoices.filter((i: any) => i.match_status === 'mismatch' || i.match_status === 'partial_match').length,
      totalValue: invoices.reduce((s: number, i: any) => s + parseFloat(i.total_amount || 0), 0),
    },
    payables: {
      unpaidTotal: unpaid.reduce((s: number, i: any) => s + parseFloat(i.total_amount || 0), 0),
      unpaidCount: unpaid.length,
      overdueTotal: overdue.reduce((s: number, i: any) => s + parseFloat(i.total_amount || 0), 0),
      overdueCount: overdue.length,
      dueThisWeekTotal: dueThisWeek.reduce((s: number, i: any) => s + parseFloat(i.total_amount || 0), 0),
      dueThisWeekCount: dueThisWeek.length,
    },
    recentPOs,
  };
}

// ============================================================
// Recent Purchase Orders
// ============================================================
async function getRecentPOs(vpms: any, centreId?: string) {
  let q = vpms.from('purchase_orders')
    .select('id, po_number, status, total_amount, po_date, expected_delivery_date, notes, vendor:vendors(legal_name, trade_name)')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(20);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;
  return { pos: data || [] };
}

// ============================================================
// Pending GRNs
// ============================================================
async function getPendingGRNs(vpms: any, centreId?: string) {
  let q = vpms.from('grns')
    .select('id, grn_number, status, grn_date, vendor_invoice_no, vendor_invoice_amount, vendor:vendors(legal_name), po:purchase_orders(po_number)')
    .in('status', ['draft', 'submitted', 'discrepancy']).order('grn_date', { ascending: false }).limit(20);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;
  return { grns: data || [] };
}

// ============================================================
// Overdue Payments
// ============================================================
async function getOverduePayments(vpms: any, centreId?: string) {
  const today = new Date().toISOString().split('T')[0];
  let q = vpms.from('invoices')
    .select('id, invoice_ref, vendor_invoice_no, total_amount, due_date, payment_status, credit_period_days, vendor:vendors(legal_name)')
    .in('payment_status', ['unpaid', 'partial']).lt('due_date', today).is('deleted_at', null)
    .order('due_date', { ascending: true }).limit(30);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;
  return {
    overdue: (data || []).map((inv: any) => ({
      ...inv,
      daysOverdue: Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000),
    })),
  };
}

// ============================================================
// Vendor-wise Payables Aging
// ============================================================
async function getVendorPayables(vpms: any, centreId?: string) {
  const today = new Date().toISOString().split('T')[0];
  let q = vpms.from('invoices')
    .select('id, total_amount, due_date, payment_status, vendor_id, vendor:vendors(legal_name)')
    .in('payment_status', ['unpaid', 'partial']).is('deleted_at', null);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;

  // Group by vendor with aging
  const vendorMap = new Map<string, { name: string; current: number; d30: number; d60: number; d90: number; over90: number; total: number; count: number }>();
  (data || []).forEach((inv: any) => {
    const vId = inv.vendor_id;
    const vName = inv.vendor?.legal_name || 'Unknown';
    if (!vendorMap.has(vId)) vendorMap.set(vId, { name: vName, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0, count: 0 });
    const v = vendorMap.get(vId)!;
    const amt = parseFloat(inv.total_amount || 0);
    const daysOld = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date).getTime()) / 86400000) : 0;
    v.total += amt;
    v.count++;
    if (daysOld <= 0) v.current += amt;
    else if (daysOld <= 30) v.d30 += amt;
    else if (daysOld <= 60) v.d60 += amt;
    else if (daysOld <= 90) v.d90 += amt;
    else v.over90 += amt;
  });

  return {
    vendors: Array.from(vendorMap.values()).sort((a, b) => b.total - a.total),
    totalPayable: Array.from(vendorMap.values()).reduce((s, v) => s + v.total, 0),
  };
}
