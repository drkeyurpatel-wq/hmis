// lib/vpms/vpms-client.ts
// Cross-database client: HMIS → VPMS Supabase (dwukvdtacwvnudqjlwrb)
// Read-only access to vendor, PO, GRN, invoice, payment data
// Requires env vars: VPMS_SUPABASE_URL, VPMS_SUPABASE_ANON_KEY

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let _vpmsClient: any = null;

export function getVPMSClient() {
  if (_vpmsClient) return _vpmsClient;
  const url = process.env.NEXT_PUBLIC_VPMS_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_VPMS_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  _vpmsClient = createSupabaseClient(url, key);
  return _vpmsClient;
}

export function isVPMSConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_VPMS_SUPABASE_URL && process.env.NEXT_PUBLIC_VPMS_SUPABASE_ANON_KEY);
}

// ============================================================
// VPMS Dashboard Summary — fetched in parallel
// ============================================================
export interface VPMSSummary {
  // Vendors
  activeVendors: number;
  pendingVendors: number;
  blacklistedVendors: number;
  // Purchase Orders
  totalPOs: number;
  draftPOs: number;
  pendingApprovalPOs: number;
  approvedPOs: number;
  sentToVendorPOs: number;
  partiallyReceivedPOs: number;
  totalPOValue: number;
  // GRNs
  pendingGRNs: number;
  verifiedGRNs: number;
  discrepancyGRNs: number;
  // Invoices
  pendingInvoices: number;
  matchedInvoices: number;
  mismatchInvoices: number;
  totalInvoiceValue: number;
  // Payments
  unpaidAmount: number;
  overdueAmount: number;
  overdueCount: number;
  dueThisWeek: number;
  dueThisWeekAmount: number;
  // Inventory alerts
  outOfStockItems: number;
  reorderItems: number;
  expiringItems: number;
}

export async function fetchVPMSSummary(centreId?: string): Promise<VPMSSummary | null> {
  const vpms = getVPMSClient();
  if (!vpms) return null;

  const defaults: VPMSSummary = {
    activeVendors: 0, pendingVendors: 0, blacklistedVendors: 0,
    totalPOs: 0, draftPOs: 0, pendingApprovalPOs: 0, approvedPOs: 0, sentToVendorPOs: 0, partiallyReceivedPOs: 0, totalPOValue: 0,
    pendingGRNs: 0, verifiedGRNs: 0, discrepancyGRNs: 0,
    pendingInvoices: 0, matchedInvoices: 0, mismatchInvoices: 0, totalInvoiceValue: 0,
    unpaidAmount: 0, overdueAmount: 0, overdueCount: 0, dueThisWeek: 0, dueThisWeekAmount: 0,
    outOfStockItems: 0, reorderItems: 0, expiringItems: 0,
  };

  try {
    const today = new Date().toISOString().split('T')[0];
    const weekLater = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

    // Run all queries in parallel
    const [vendors, pos, grns, invoices, payments] = await Promise.allSettled([
      // Vendors
      vpms.from('vendors').select('id, status').not('deleted_at', 'is', null).is('deleted_at', null),

      // POs — active (not cancelled/closed)
      (() => {
        let q = vpms.from('purchase_orders').select('id, status, total_amount').is('deleted_at', null);
        if (centreId) q = q.eq('centre_id', centreId);
        return q;
      })(),

      // GRNs
      (() => {
        let q = vpms.from('grns').select('id, status');
        if (centreId) q = q.eq('centre_id', centreId);
        return q;
      })(),

      // Invoices
      (() => {
        let q = vpms.from('invoices').select('id, match_status, payment_status, total_amount, due_date').is('deleted_at', null);
        if (centreId) q = q.eq('centre_id', centreId);
        return q;
      })(),

      // Payment batches
      (() => {
        let q = vpms.from('payment_batches').select('id, status, total_amount, batch_date');
        if (centreId) q = q.eq('centre_id', centreId);
        return q;
      })(),
    ]);

    // Process vendors
    if (vendors.status === 'fulfilled' && vendors.value.data) {
      const v = vendors.value.data;
      defaults.activeVendors = v.filter((x: any) => x.status === 'active').length;
      defaults.pendingVendors = v.filter((x: any) => x.status === 'pending').length;
      defaults.blacklistedVendors = v.filter((x: any) => x.status === 'blacklisted').length;
    }

    // Process POs
    if (pos.status === 'fulfilled' && pos.value.data) {
      const p = pos.value.data;
      defaults.totalPOs = p.length;
      defaults.draftPOs = p.filter((x: any) => x.status === 'draft').length;
      defaults.pendingApprovalPOs = p.filter((x: any) => x.status === 'pending_approval').length;
      defaults.approvedPOs = p.filter((x: any) => x.status === 'approved').length;
      defaults.sentToVendorPOs = p.filter((x: any) => x.status === 'sent_to_vendor').length;
      defaults.partiallyReceivedPOs = p.filter((x: any) => x.status === 'partially_received').length;
      defaults.totalPOValue = p.reduce((s: number, x: any) => s + parseFloat(x.total_amount || 0), 0);
    }

    // Process GRNs
    if (grns.status === 'fulfilled' && grns.value.data) {
      const g = grns.value.data;
      defaults.pendingGRNs = g.filter((x: any) => x.status === 'draft' || x.status === 'submitted').length;
      defaults.verifiedGRNs = g.filter((x: any) => x.status === 'verified').length;
      defaults.discrepancyGRNs = g.filter((x: any) => x.status === 'discrepancy').length;
    }

    // Process Invoices
    if (invoices.status === 'fulfilled' && invoices.value.data) {
      const inv = invoices.value.data;
      defaults.pendingInvoices = inv.filter((x: any) => x.match_status === 'pending').length;
      defaults.matchedInvoices = inv.filter((x: any) => x.match_status === 'matched').length;
      defaults.mismatchInvoices = inv.filter((x: any) => x.match_status === 'mismatch' || x.match_status === 'partial_match').length;
      defaults.totalInvoiceValue = inv.reduce((s: number, x: any) => s + parseFloat(x.total_amount || 0), 0);
      // Unpaid
      const unpaid = inv.filter((x: any) => x.payment_status === 'unpaid' || x.payment_status === 'partial');
      defaults.unpaidAmount = unpaid.reduce((s: number, x: any) => s + parseFloat(x.total_amount || 0), 0);
      // Overdue
      const overdue = unpaid.filter((x: any) => x.due_date && x.due_date < today);
      defaults.overdueCount = overdue.length;
      defaults.overdueAmount = overdue.reduce((s: number, x: any) => s + parseFloat(x.total_amount || 0), 0);
      // Due this week
      const dueWeek = unpaid.filter((x: any) => x.due_date && x.due_date >= today && x.due_date <= weekLater);
      defaults.dueThisWeek = dueWeek.length;
      defaults.dueThisWeekAmount = dueWeek.reduce((s: number, x: any) => s + parseFloat(x.total_amount || 0), 0);
    }

    return defaults;
  } catch (err) {
    console.error('[VPMS Client] Error fetching summary:', err);
    return null;
  }
}

// ============================================================
// Recent POs
// ============================================================
export async function fetchRecentPOs(centreId?: string, limit: number = 10): Promise<any[]> {
  const vpms = getVPMSClient();
  if (!vpms) return [];
  let q = vpms.from('purchase_orders')
    .select('id, po_number, status, total_amount, po_date, expected_delivery_date, vendor:vendors(legal_name, trade_name)')
    .is('deleted_at', null).order('created_at', { ascending: false }).limit(limit);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;
  return data || [];
}

// ============================================================
// Pending GRNs
// ============================================================
export async function fetchPendingGRNs(centreId?: string): Promise<any[]> {
  const vpms = getVPMSClient();
  if (!vpms) return [];
  let q = vpms.from('grns')
    .select('id, grn_number, status, grn_date, vendor_invoice_no, vendor_invoice_amount, po:purchase_orders(po_number), vendor:vendors(legal_name)')
    .in('status', ['draft', 'submitted', 'discrepancy']).order('created_at', { ascending: false }).limit(20);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;
  return data || [];
}

// ============================================================
// Overdue Payments
// ============================================================
export async function fetchOverduePayments(centreId?: string): Promise<any[]> {
  const vpms = getVPMSClient();
  if (!vpms) return [];
  const today = new Date().toISOString().split('T')[0];
  let q = vpms.from('invoices')
    .select('id, invoice_ref, vendor_invoice_no, total_amount, due_date, payment_status, vendor:vendors(legal_name)')
    .in('payment_status', ['unpaid', 'partial']).lt('due_date', today).is('deleted_at', null)
    .order('due_date', { ascending: true }).limit(20);
  if (centreId) q = q.eq('centre_id', centreId);
  const { data } = await q;
  return data || [];
}

// ============================================================
// Vendor List (for HMIS dropdowns)
// ============================================================
export async function fetchVendorList(): Promise<any[]> {
  const vpms = getVPMSClient();
  if (!vpms) return [];
  const { data } = await vpms.from('vendors')
    .select('id, vendor_code, legal_name, trade_name, gstin, category:vendor_categories(name)')
    .eq('status', 'active').is('deleted_at', null).order('legal_name').limit(200);
  return data || [];
}
