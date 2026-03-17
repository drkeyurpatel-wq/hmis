// components/billing/corporate-loyalty-integrations.tsx
'use client';
import React, { useState } from 'react';

interface CorporateProps { corporates: any[]; onFlash: (m: string) => void; }
interface LoyaltyProps { cards: any[]; onIssue: (patientId: string, cardType: string, rules: any) => Promise<void>; onFlash: (m: string) => void; }
interface IntegrationProps { pendingSync: any[]; onMarkSynced: (id: string) => Promise<void>; onFlash: (m: string) => void; }

const CARD_TYPES = [
  { type: 'silver', label: 'Silver', opd: 5, ipd: 3, pharmacy: 5, lab: 10, color: 'bg-gray-200 text-gray-700' },
  { type: 'gold', label: 'Gold', opd: 10, ipd: 5, pharmacy: 8, lab: 15, color: 'bg-yellow-200 text-yellow-800' },
  { type: 'platinum', label: 'Platinum', opd: 15, ipd: 10, pharmacy: 10, lab: 20, color: 'bg-purple-200 text-purple-800' },
  { type: 'staff', label: 'Staff', opd: 25, ipd: 20, pharmacy: 15, lab: 25, color: 'bg-blue-200 text-blue-800' },
  { type: 'senior_citizen', label: 'Senior Citizen (60+)', opd: 10, ipd: 5, pharmacy: 5, lab: 10, color: 'bg-green-200 text-green-800' },
  { type: 'freedom_fighter', label: 'Freedom Fighter', opd: 50, ipd: 30, pharmacy: 20, lab: 30, color: 'bg-orange-200 text-orange-800' },
  { type: 'bpl', label: 'BPL', opd: 30, ipd: 20, pharmacy: 15, lab: 25, color: 'bg-red-200 text-red-800' },
];

export function CorporatePanel({ corporates, onFlash }: CorporateProps) {
  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const totalCredit = corporates.reduce((s, c) => s + parseFloat(c.credit_limit || 0), 0);
  const totalOutstanding = corporates.reduce((s, c) => s + parseFloat(c.current_outstanding || 0), 0);
  const totalAvailable = totalCredit - totalOutstanding;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Active Corporates</div><div className="text-xl font-bold">{corporates.length}</div></div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 text-center"><div className="text-[10px] text-blue-600">Total Credit Limit</div><div className="text-xl font-bold text-blue-700">₹{fmt(totalCredit)}</div></div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><div className="text-[10px] text-red-600">Outstanding</div><div className="text-xl font-bold text-red-700">₹{fmt(totalOutstanding)}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><div className="text-[10px] text-green-600">Available Credit</div><div className="text-xl font-bold text-green-700">₹{fmt(totalAvailable)}</div></div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Company</th><th className="p-2">Code</th><th className="p-2">Discount %</th><th className="p-2">Credit Period</th><th className="p-2 text-right">Credit Limit</th><th className="p-2 text-right">Outstanding</th><th className="p-2 text-right">Available</th><th className="p-2">MOU Valid</th><th className="p-2">Status</th>
      </tr></thead><tbody>{corporates.map(c => {
        const avail = parseFloat(c.credit_limit || 0) - parseFloat(c.current_outstanding || 0);
        const utilPct = parseFloat(c.credit_limit) > 0 ? (parseFloat(c.current_outstanding) / parseFloat(c.credit_limit) * 100) : 0;
        return (
          <tr key={c.id} className="border-b hover:bg-gray-50">
            <td className="p-2 font-medium">{c.company_name}<div className="text-[10px] text-gray-400">{c.contact_person} | {c.contact_phone}</div></td>
            <td className="p-2 text-center font-mono text-[10px]">{c.company_code}</td>
            <td className="p-2 text-center"><span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{c.discount_percentage}%</span></td>
            <td className="p-2 text-center">{c.credit_period_days}d</td>
            <td className="p-2 text-right font-medium">₹{fmt(c.credit_limit)}</td>
            <td className="p-2 text-right"><span className={utilPct > 80 ? 'text-red-600 font-bold' : utilPct > 50 ? 'text-orange-600' : ''}>₹{fmt(c.current_outstanding)}</span><div className="w-full bg-gray-200 rounded-full h-1 mt-0.5"><div className={`h-full rounded-full ${utilPct > 80 ? 'bg-red-500' : utilPct > 50 ? 'bg-orange-400' : 'bg-green-500'}`} style={{width: `${Math.min(100, utilPct)}%`}} /></div></td>
            <td className="p-2 text-right text-green-600">₹{fmt(avail)}</td>
            <td className="p-2 text-center text-[10px] text-gray-500">{c.mou_valid_to || '—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${c.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.status}</span></td>
          </tr>
        );
      })}</tbody></table></div>
    </div>
  );
}

export function LoyaltyPanel({ cards, onIssue, onFlash }: LoyaltyProps) {
  const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const cardColor = (t: string) => CARD_TYPES.find(c => c.type === t)?.color || 'bg-gray-100';

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">
        {CARD_TYPES.slice(0, 4).map(ct => {
          const count = cards.filter(c => c.card_type === ct.type).length;
          return <div key={ct.type} className={`rounded-xl border p-3 text-center ${ct.color}`}><div className="text-[10px]">{ct.label}</div><div className="text-xl font-bold">{count}</div><div className="text-[9px]">OPD {ct.opd}% | IPD {ct.ipd}% | Lab {ct.lab}%</div></div>;
        })}
      </div>
      <div className="mb-4"><h3 className="text-xs font-medium text-gray-500 mb-2">Discount Structure</h3>
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Card Type</th><th className="p-2">OPD</th><th className="p-2">IPD</th><th className="p-2">Pharmacy</th><th className="p-2">Lab/Radiology</th>
        </tr></thead><tbody>{CARD_TYPES.map(ct => (
          <tr key={ct.type} className="border-b"><td className="p-2"><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${ct.color}`}>{ct.label}</span></td>
            <td className="p-2 text-center font-bold">{ct.opd}%</td><td className="p-2 text-center font-bold">{ct.ipd}%</td>
            <td className="p-2 text-center font-bold">{ct.pharmacy}%</td><td className="p-2 text-center font-bold">{ct.lab}%</td></tr>
        ))}</tbody></table></div>
      </div>
      {cards.length > 0 && <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
        <th className="p-2 text-left">Card #</th><th className="p-2 text-left">Patient</th><th className="p-2">Type</th><th className="p-2">Points</th><th className="p-2">Valid Until</th>
      </tr></thead><tbody>{cards.map(c => (
        <tr key={c.id} className="border-b"><td className="p-2 font-mono">{c.card_number}</td><td className="p-2">{c.patient?.first_name} {c.patient?.last_name} <span className="text-gray-400">{c.patient?.uhid}</span></td>
          <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${cardColor(c.card_type)}`}>{c.card_type}</span></td>
          <td className="p-2 text-center font-bold">{c.points_balance}</td><td className="p-2 text-center text-gray-500">{c.valid_until || '—'}</td></tr>
      ))}</tbody></table></div>}
    </div>
  );
}

export function IntegrationPanel({ pendingSync, onMarkSynced, onFlash }: IntegrationProps) {
  const systems = [
    { id: 'cashflow', name: 'H1 CashFlow', url: 'h1cashflow.drkeyurpatel.workers.dev', desc: 'Multi-centre financial tracking', color: 'bg-green-100 text-green-700', icon: '💰' },
    { id: 'medpay', name: 'H1 MedPay', url: 'medpay.drkeyurpatel.workers.dev', desc: 'Doctor payout reconciliation', color: 'bg-blue-100 text-blue-700', icon: '👨‍⚕️' },
    { id: 'vpms', name: 'H1 VPMS', url: 'vendor.vercel.app', desc: 'Vendor payment management', color: 'bg-purple-100 text-purple-700', icon: '🏭' },
    { id: 'tally', name: 'Tally ERP', url: '', desc: 'Accounting integration', color: 'bg-orange-100 text-orange-700', icon: '📊' },
  ];

  const syncColor = (s: string) => s === 'synced' ? 'bg-green-100 text-green-700' : s === 'failed' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700';
  const pendingBySys = (sys: string) => pendingSync.filter(p => p.target_system === sys).length;

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-4">{systems.map(s => (
        <div key={s.id} className={`rounded-xl border p-4 ${s.color}`}>
          <div className="flex items-center gap-2 mb-1"><span className="text-xl">{s.icon}</span><div><div className="font-semibold text-sm">{s.name}</div><div className="text-[10px] opacity-70">{s.desc}</div></div></div>
          <div className="flex justify-between items-center mt-2">
            <span className="text-[10px]">{pendingBySys(s.id)} pending</span>
            {s.url && <a href={`https://${s.url}`} target="_blank" className="text-[10px] underline opacity-70">Open →</a>}
          </div>
        </div>
      ))}</div>

      <h3 className="text-sm font-semibold mb-2">Integration Workflow</h3>
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div><h4 className="font-medium text-green-700 mb-1">Billing → CashFlow</h4>
            <div className="text-gray-500 space-y-0.5"><div>• Bill payment → Daily income entry</div><div>• Insurance settlement → Receivable clearing</div><div>• Advance deposit → Liability entry</div><div>• Refund → Expense entry</div></div></div>
          <div><h4 className="font-medium text-blue-700 mb-1">Billing → MedPay</h4>
            <div className="text-gray-500 space-y-0.5"><div>• Professional fee items → Doctor earning log</div><div>• Surgeon/Anaesthetist/Assistant fees tracked</div><div>• Monthly payout reconciliation auto-generated</div><div>• TDS calculation per doctor</div></div></div>
          <div><h4 className="font-medium text-purple-700 mb-1">Billing → VPMS</h4>
            <div className="text-gray-500 space-y-0.5"><div>• Consumable usage → Vendor stock deduction</div><div>• Implant/stent billing → Vendor PO linkage</div><div>• Pharmacy dispensing → Inventory adjustment</div><div>• Purchase indents from high-usage items</div></div></div>
        </div>
      </div>

      {/* Pending sync items */}
      {pendingSync.length > 0 && <div>
        <h3 className="text-xs text-gray-500 font-medium mb-2">Pending Sync ({pendingSync.length})</h3>
        <div className="space-y-1">{pendingSync.map(p => (
          <div key={p.id} className="bg-white rounded-lg border px-3 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-1.5 py-0.5 rounded text-[10px] ${syncColor(p.sync_status)}`}>{p.sync_status}</span>
              <span className="font-medium">{p.source_system} → {p.target_system}</span>
              <span className="text-gray-400">{p.entity_type}</span>
            </div>
            <button onClick={async () => { await onMarkSynced(p.id); onFlash('Marked as synced'); }} className="px-2 py-1 bg-green-50 text-green-700 rounded text-[10px]">Mark Synced</button>
          </div>
        ))}</div>
      </div>}
    </div>
  );
}
