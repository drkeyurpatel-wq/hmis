'use client';
import React, { useState } from 'react';
import { useVPMS, useVPMSOverdue, useVPMSVendorPayables } from '@/lib/vpms/vpms-hooks';

const VPMS_URL = 'https://vendor-liart-eta.vercel.app';

function rupees(n: number): string {
  if (n === 0) return '\u20B90';
  if (Math.abs(n) >= 10000000) return '\u20B9' + (n / 10000000).toFixed(2) + ' Cr';
  if (Math.abs(n) >= 100000) return '\u20B9' + (n / 100000).toFixed(2) + ' L';
  if (Math.abs(n) >= 1000) return '\u20B9' + (n / 1000).toFixed(1) + 'K';
  return '\u20B9' + n.toLocaleString('en-IN');
}

function ExtLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return <a href={VPMS_URL + href} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>;
}

// ============================================================
// Compact Card (for Command Centre)
// ============================================================
export function VPMSCompactCard({ centreCode }: { centreCode?: string }) {
  const { data, loading, error } = useVPMS(centreCode);

  if (loading) return <div className="bg-white rounded-xl border p-4 animate-pulse"><div className="h-4 bg-gray-200 rounded w-32 mb-3" /><div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-gray-100 rounded" />)}</div></div>;
  if (error || !data?.configured) return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="text-xs font-bold text-gray-700 mb-2">Vendor &amp; Procurement</h3>
      <div className="text-center py-3 text-xs text-gray-400">{error || 'VPMS not connected. Set env vars.'}</div>
    </div>
  );

  const po = data.purchaseOrders;
  const pay = data.payables;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-gray-700">Vendor &amp; Procurement</h3>
        <ExtLink href="/" className="text-[10px] text-blue-600 hover:underline">Open VPMS</ExtLink>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="text-center"><div className="text-lg font-bold text-blue-700">{po.total}</div><div className="text-[9px] text-gray-500">Active POs</div></div>
        <div className="text-center"><div className="text-lg font-bold text-green-700">{rupees(po.totalValue)}</div><div className="text-[9px] text-gray-500">PO Value</div></div>
        <div className="text-center"><div className={'text-lg font-bold ' + (pay.overdueCount > 0 ? 'text-red-700' : 'text-gray-700')}>{pay.overdueCount}</div><div className="text-[9px] text-gray-500">Overdue</div></div>
        <div className="text-center"><div className="text-lg font-bold text-red-700">{rupees(pay.unpaidTotal)}</div><div className="text-[9px] text-gray-500">Payable</div></div>
      </div>
      <div className="space-y-1 text-xs">
        {po.pendingApproval > 0 && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-gray-600 flex-1">Pending Approval</span><span className="font-semibold">{po.pendingApproval}</span></div>}
        {po.sentToVendor > 0 && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-400" /><span className="text-gray-600 flex-1">Sent to Vendor</span><span className="font-semibold">{po.sentToVendor}</span></div>}
        {po.partiallyReceived > 0 && <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-purple-400" /><span className="text-gray-600 flex-1">Partially Received</span><span className="font-semibold">{po.partiallyReceived}</span></div>}
      </div>
      {pay.overdueCount > 0 && <div className="mt-2 bg-red-50 rounded-lg px-2 py-1.5 text-[10px] text-red-700"><span className="font-semibold">{pay.overdueCount}</span> overdue: {rupees(pay.overdueTotal)}</div>}
      {pay.dueThisWeekCount > 0 && <div className="mt-1 bg-amber-50 rounded-lg px-2 py-1.5 text-[10px] text-amber-700"><span className="font-semibold">{pay.dueThisWeekCount}</span> due this week: {rupees(pay.dueThisWeekTotal)}</div>}
    </div>
  );
}

// ============================================================
// Full Dashboard (for /vpms page)
// ============================================================
export default function VPMSDashboard({ centreCode }: { centreCode?: string }) {
  const { data, loading, error, refresh } = useVPMS(centreCode);
  const overdueHook = useVPMSOverdue(centreCode);
  const payablesHook = useVPMSVendorPayables(centreCode);

  if (loading) return <div className="space-y-4 animate-pulse"><div className="h-8 bg-gray-200 rounded w-48" /><div className="grid grid-cols-6 gap-3">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded-xl" />)}</div></div>;

  if (error || !data?.configured) return (
    <div className="bg-white rounded-xl border p-8 text-center">
      <div className="text-lg font-semibold text-gray-700 mb-2">VPMS Not Connected</div>
      <div className="text-sm text-gray-500 mb-4">{error || 'Set environment variables to connect.'}</div>
      <div className="bg-gray-50 rounded-lg p-4 text-left text-xs font-mono space-y-1 max-w-md mx-auto">
        <div>VPMS_SUPABASE_URL=your-vpms-supabase-url</div>
        <div>VPMS_SUPABASE_SERVICE_KEY=your-service-role-key</div>
      </div>
      <a href={VPMS_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm text-blue-600 hover:underline">Open VPMS directly</a>
    </div>
  );

  const po = data.purchaseOrders;
  const inv = data.invoices;
  const pay = data.payables;
  const grn = data.grns;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold text-gray-900">Vendor &amp; Purchase Management</h1><p className="text-xs text-gray-500">Live from VPMS | {data.vendors.active} active vendors</p></div>
        <div className="flex items-center gap-2">
          <button onClick={refresh} className="px-3 py-1.5 bg-gray-100 text-xs rounded-lg">Refresh</button>
          <ExtLink href="/" className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">Open VPMS</ExtLink>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-8 gap-2">
        {[
          ['Vendors', data.vendors.active, data.vendors.pending + ' pending', 'text-blue-700', 'bg-blue-50'],
          ['Active POs', po.total, po.pendingApproval + ' need approval', 'text-blue-700', 'bg-blue-50'],
          ['PO Value', rupees(po.totalValue), po.thisMonth + ' this month', 'text-green-700', 'bg-green-50'],
          ['GRN Pending', grn.pending, grn.discrepancy + ' discrepancy', grn.discrepancy > 0 ? 'text-red-700' : 'text-amber-700', grn.discrepancy > 0 ? 'bg-red-50' : 'bg-amber-50'],
          ['Invoices', inv.total, inv.mismatch + ' mismatch', inv.mismatch > 0 ? 'text-red-700' : 'text-blue-700', 'bg-white'],
          ['Unpaid', rupees(pay.unpaidTotal), pay.unpaidCount + ' invoices', 'text-red-700', 'bg-red-50'],
          ['Overdue', rupees(pay.overdueTotal), pay.overdueCount + ' invoices', pay.overdueCount > 0 ? 'text-red-700' : 'text-green-700', pay.overdueCount > 0 ? 'bg-red-50' : 'bg-green-50'],
          ['Due This Wk', rupees(pay.dueThisWeekTotal), pay.dueThisWeekCount + ' invoices', 'text-amber-700', 'bg-amber-50'],
        ].map(([l, v, s, tc, bg], i) => (
          <div key={i} className={'rounded-xl border p-2.5 text-center ' + bg}><div className="text-[9px] text-gray-500 uppercase">{l as string}</div><div className={'text-lg font-bold ' + tc}>{v}</div><div className="text-[10px] text-gray-400">{s as string}</div></div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* PO Pipeline */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-gray-700">PO Pipeline</h3><ExtLink href="/purchase-orders" className="text-[10px] text-blue-600 hover:underline">View all</ExtLink></div>
          <div className="space-y-2">
            {[['Draft', po.draft, 'bg-gray-400'], ['Pending Approval', po.pendingApproval, 'bg-amber-500'], ['Approved', po.approved, 'bg-green-500'], ['Sent to Vendor', po.sentToVendor, 'bg-blue-500'], ['Partially Received', po.partiallyReceived, 'bg-purple-500']].map(([label, count, color], i) => (
              <div key={i} className="flex items-center gap-3"><div className={'w-3 h-3 rounded-full ' + color} /><span className="text-sm text-gray-700 flex-1">{label as string}</span><span className="text-sm font-bold">{count as number}</span>
                <div className="w-24"><div className="bg-gray-100 rounded-full h-2"><div className={'h-full rounded-full ' + color} style={{ width: (po.total > 0 ? Math.max(3, ((count as number) / po.total) * 100) : 0) + '%' }} /></div></div>
              </div>
            ))}
          </div>
          {data.recentPOs?.length > 0 && <div className="mt-4 border-t pt-3"><h4 className="text-xs font-medium text-gray-500 mb-2">Recent POs</h4>
            <div className="space-y-1">{data.recentPOs.slice(0, 5).map((p: any) => (
              <ExtLink key={p.id} href={'/purchase-orders/' + p.id} className="flex items-center justify-between text-xs hover:bg-gray-50 rounded px-2 py-1.5 -mx-2">
                <div><span className="font-mono text-blue-600">{p.po_number}</span><span className="text-gray-400 ml-2">{p.vendor?.legal_name}</span></div>
                <span className="font-semibold">{rupees(parseFloat(p.total_amount || 0))}</span>
              </ExtLink>
            ))}</div>
          </div>}
        </div>

        {/* Vendor Payables Aging */}
        <div className="bg-white rounded-xl border p-4">
          <div className="flex justify-between items-center mb-3"><h3 className="text-sm font-bold text-gray-700">Vendor Payables Aging</h3><span className="text-sm font-bold text-red-700">{rupees(payablesHook.totalPayable)}</span></div>
          {payablesHook.loading ? <div className="py-4 text-center text-gray-400 text-xs">Loading...</div> :
          payablesHook.vendors.length === 0 ? <div className="py-4 text-center text-green-600 text-sm">No outstanding payables</div> :
          <table className="w-full text-xs"><thead><tr className="text-gray-500 border-b"><th className="pb-2 text-left font-medium">Vendor</th><th className="pb-2 text-right font-medium">Current</th><th className="pb-2 text-right font-medium">30d</th><th className="pb-2 text-right font-medium">60d</th><th className="pb-2 text-right font-medium">90+</th><th className="pb-2 text-right font-medium">Total</th></tr></thead>
            <tbody>{payablesHook.vendors.slice(0, 10).map((v: any, i: number) => (
              <tr key={i} className="border-b border-gray-50"><td className="py-1.5 font-medium truncate max-w-[140px]">{v.name}</td><td className="py-1.5 text-right text-green-700">{v.current > 0 ? rupees(v.current) : '\u2014'}</td><td className="py-1.5 text-right text-amber-600">{v.d30 > 0 ? rupees(v.d30) : '\u2014'}</td><td className="py-1.5 text-right text-orange-600">{v.d60 > 0 ? rupees(v.d60) : '\u2014'}</td><td className="py-1.5 text-right text-red-700 font-semibold">{v.over90 > 0 ? rupees(v.over90) : '\u2014'}</td><td className="py-1.5 text-right font-bold">{rupees(v.total)}</td></tr>
            ))}</tbody></table>}
        </div>
      </div>

      {/* Overdue */}
      {overdueHook.overdue.length > 0 && <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-bold text-red-700 mb-3">Overdue Invoices ({overdueHook.overdue.length})</h3>
        <table className="w-full text-xs"><thead><tr className="text-gray-500 border-b"><th className="pb-2 text-left font-medium">Invoice</th><th className="pb-2 text-left font-medium">Vendor</th><th className="pb-2 text-right font-medium">Amount</th><th className="pb-2 text-center font-medium">Due</th><th className="pb-2 text-center font-medium">Overdue</th></tr></thead>
          <tbody>{overdueHook.overdue.slice(0, 15).map((inv: any) => (
            <tr key={inv.id} className="border-b border-gray-50 hover:bg-red-50">
              <td className="py-1.5"><ExtLink href={'/finance/invoices/' + inv.id} className="font-mono text-blue-600 hover:underline text-[10px]">{inv.invoice_ref || inv.vendor_invoice_no}</ExtLink></td>
              <td className="py-1.5 truncate max-w-[200px]">{inv.vendor?.legal_name}</td>
              <td className="py-1.5 text-right font-semibold">{rupees(parseFloat(inv.total_amount))}</td>
              <td className="py-1.5 text-center text-gray-500">{inv.due_date}</td>
              <td className={'py-1.5 text-center font-bold ' + (inv.daysOverdue > 60 ? 'text-red-700' : inv.daysOverdue > 30 ? 'text-orange-700' : 'text-amber-700')}>{inv.daysOverdue}d</td>
            </tr>
          ))}</tbody></table>
      </div>}
    </div>
  );
}
