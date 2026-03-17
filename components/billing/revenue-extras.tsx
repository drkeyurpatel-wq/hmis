'use client';
import React, { useState } from 'react';

const fmt = (n: number | string) => parseFloat(String(n) || '0').toLocaleString('en-IN', { maximumFractionDigits: 0 });

// ============================================================
// CORPORATE BILLING
// ============================================================
interface CorpProps {
  corporates: any[]; employees: any[];
  onAdd: (d: any) => Promise<void>;
  onLoadEmployees: (id: string) => Promise<void>;
  onCreditBills: (id: string) => Promise<any[]>;
  onFlash: (m: string) => void;
}

export function CorporateBilling({ corporates, employees, onAdd, onLoadEmployees, onCreditBills, onFlash }: CorpProps) {
  const [selectedCorp, setSelectedCorp] = useState<any>(null);
  const [corpBills, setCorpBills] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    company_name: '', contact_person: '', contact_email: '', contact_phone: '',
    billing_address: '', gst_number: '', pan_number: '',
    credit_limit: 500000, credit_period_days: 30, discount_percentage: 0,
  });

  const selectCorp = async (corp: any) => {
    setSelectedCorp(corp);
    await onLoadEmployees(corp.id);
    const bills = await onCreditBills(corp.id);
    setCorpBills(bills);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold text-sm">Corporate Billing &amp; Credit</h2>
        <button onClick={() => setShowNew(!showNew)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showNew ? 'Cancel' : '+ Add Corporate'}</button>
      </div>

      {showNew && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Company name *</label>
            <input type="text" value={form.company_name} onChange={e => setForm(f => ({...f, company_name: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Contact person</label>
            <input type="text" value={form.contact_person} onChange={e => setForm(f => ({...f, contact_person: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Phone</label>
            <input type="text" value={form.contact_phone} onChange={e => setForm(f => ({...f, contact_phone: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">GSTIN</label>
            <input type="text" value={form.gst_number} onChange={e => setForm(f => ({...f, gst_number: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">PAN</label>
            <input type="text" value={form.pan_number} onChange={e => setForm(f => ({...f, pan_number: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Credit limit</label>
            <input type="number" value={form.credit_limit} onChange={e => setForm(f => ({...f, credit_limit: parseInt(e.target.value)}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Discount %</label>
            <input type="number" value={form.discount_percentage} onChange={e => setForm(f => ({...f, discount_percentage: parseFloat(e.target.value)}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <button onClick={async () => { if (!form.company_name) return; await onAdd(form); setShowNew(false); onFlash('Corporate added'); }}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Save Corporate</button>
      </div>}

      {selectedCorp && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="flex justify-between">
          <div>
            <div className="font-semibold text-lg">{selectedCorp.company_name}</div>
            <div className="text-xs text-gray-500">{selectedCorp.company_code} | {selectedCorp.contact_person} | {selectedCorp.contact_phone}</div>
          </div>
          <button onClick={() => setSelectedCorp(null)} className="text-xs text-gray-500">Close</button>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-blue-50 rounded-lg p-2 text-center"><div className="text-[10px] text-blue-600">Credit Limit</div><div className="font-bold text-blue-700">{'₹'}{fmt(selectedCorp.credit_limit)}</div></div>
          <div className="bg-red-50 rounded-lg p-2 text-center"><div className="text-[10px] text-red-600">Outstanding</div><div className="font-bold text-red-700">{'₹'}{fmt(selectedCorp.current_outstanding)}</div></div>
          <div className="bg-green-50 rounded-lg p-2 text-center"><div className="text-[10px] text-green-600">Available</div><div className="font-bold text-green-700">{'₹'}{fmt(parseFloat(selectedCorp.credit_limit) - parseFloat(selectedCorp.current_outstanding || 0))}</div></div>
          <div className="bg-gray-50 rounded-lg p-2 text-center"><div className="text-[10px] text-gray-600">Credit Period</div><div className="font-bold">{selectedCorp.credit_period_days} days</div></div>
        </div>
        {employees.length > 0 && <div>
          <h4 className="text-xs font-medium mb-1">Registered Employees ({employees.length})</h4>
          <div className="space-y-1">{employees.map((e: any) => (
            <div key={e.id} className="text-xs bg-gray-50 rounded px-2 py-1 flex justify-between">
              <span>{e.patient?.first_name} {e.patient?.last_name} ({e.patient?.uhid}) — {e.relationship}</span>
              <span className={`px-1 py-0.5 rounded text-[9px] ${e.coverage_type === 'full' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{e.coverage_type}</span>
            </div>
          ))}</div>
        </div>}
        {corpBills.length > 0 && <div>
          <h4 className="text-xs font-medium mb-1">Credit Bills ({corpBills.length})</h4>
          <div className="bg-gray-50 rounded-lg overflow-hidden">
            <table className="w-full text-xs"><tbody>{corpBills.slice(0, 10).map((b: any) => (
              <tr key={b.id} className="border-b">
                <td className="p-1.5 font-mono text-[10px]">{b.bill_number}</td>
                <td className="p-1.5">{b.patient?.first_name} {b.patient?.last_name}</td>
                <td className="p-1.5 text-right font-medium">{'₹'}{fmt(b.net_amount)}</td>
                <td className="p-1.5 text-right text-red-600">{'₹'}{fmt(b.balance_amount)}</td>
              </tr>
            ))}</tbody></table>
          </div>
        </div>}
      </div>}

      {!selectedCorp && <div className="grid grid-cols-2 gap-3">
        {corporates.map(c => {
          const utilPct = parseFloat(c.credit_limit) > 0 ? (parseFloat(c.current_outstanding || 0) / parseFloat(c.credit_limit)) * 100 : 0;
          return (
            <div key={c.id} onClick={() => selectCorp(c)} className="bg-white rounded-xl border p-4 cursor-pointer hover:border-blue-300">
              <div className="flex justify-between">
                <div><div className="font-semibold">{c.company_name}</div><div className="text-[10px] text-gray-400">{c.company_code} | {c.contact_person}</div></div>
                <div className="text-right">
                  <div className={`text-sm font-bold ${parseFloat(c.current_outstanding) > 0 ? 'text-red-700' : 'text-green-700'}`}>{'₹'}{fmt(c.current_outstanding || 0)}</div>
                  <div className="text-[10px] text-gray-400">/ {'₹'}{fmt(c.credit_limit)}</div>
                </div>
              </div>
              <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5">
                <div className={`h-full rounded-full ${utilPct > 80 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(100, utilPct)}%` }} />
              </div>
            </div>
          );
        })}
        {corporates.length === 0 && <div className="col-span-2 text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No corporates registered</div>}
      </div>}
    </div>
  );
}

// ============================================================
// SETTLEMENT RECONCILIATION
// ============================================================
interface SettleProps {
  settlements: any[]; stats: { total: number; totalSettled: number; totalTDS: number; totalDisallowance: number; unreconciled: number };
  onRecord: (d: any) => Promise<void>; onReconcile: (id: string, staffId: string) => Promise<void>;
  staffId: string; onFlash: (m: string) => void;
}

export function SettlementReconciliation({ settlements, stats, onRecord, onReconcile, staffId, onFlash }: SettleProps) {
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    settlement_type: 'insurance', settlement_number: '', utr_number: '',
    settlement_date: new Date().toISOString().split('T')[0],
    total_claims: 0, claimed_amount: 0, approved_amount: 0, settled_amount: 0,
    tds_amount: 0, disallowance_amount: 0, net_received: 0,
    bank_account: '', payment_mode: 'neft', remarks: '',
  });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border p-3 text-center"><div className="text-[10px] text-gray-500">Settlements</div><div className="text-xl font-bold">{stats.total}</div></div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center"><div className="text-[10px] text-green-600">Total Settled</div><div className="text-xl font-bold text-green-700">{'₹'}{fmt(stats.totalSettled)}</div></div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-3 text-center"><div className="text-[10px] text-orange-600">TDS Deducted</div><div className="text-xl font-bold text-orange-700">{'₹'}{fmt(stats.totalTDS)}</div></div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center"><div className="text-[10px] text-red-600">Disallowance</div><div className="text-xl font-bold text-red-700">{'₹'}{fmt(stats.totalDisallowance)}</div></div>
        <div className="bg-yellow-50 rounded-xl border border-yellow-200 p-3 text-center"><div className="text-[10px] text-yellow-600">Unreconciled</div><div className="text-xl font-bold text-yellow-700">{stats.unreconciled}</div></div>
      </div>

      <div className="flex justify-between">
        <h2 className="font-semibold text-sm">Settlements</h2>
        <button onClick={() => setShowNew(!showNew)} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{showNew ? 'Cancel' : '+ Record Settlement'}</button>
      </div>

      {showNew && <div className="bg-white rounded-xl border p-5 space-y-3">
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500">Type</label>
            <div className="flex gap-1 mt-1">{['insurance','tpa','pmjay','cghs','echs','corporate'].map(t => (
              <button key={t} onClick={() => setForm(f => ({...f, settlement_type: t}))}
                className={`flex-1 py-1.5 rounded text-[10px] border ${form.settlement_type === t ? 'bg-blue-600 text-white' : 'bg-white'}`}>{t.toUpperCase()}</button>
            ))}</div></div>
          <div><label className="text-xs text-gray-500">Settlement #</label>
            <input type="text" value={form.settlement_number} onChange={e => setForm(f => ({...f, settlement_number: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">UTR #</label>
            <input type="text" value={form.utr_number} onChange={e => setForm(f => ({...f, utr_number: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Date</label>
            <input type="date" value={form.settlement_date} onChange={e => setForm(f => ({...f, settlement_date: e.target.value}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
        </div>
        <div className="grid grid-cols-5 gap-3">
          {[['Claimed','claimed_amount'],['Approved','approved_amount'],['Settled','settled_amount'],['TDS','tds_amount'],['Net Received','net_received']].map(([l, k]) => (
            <div key={k}><label className="text-xs text-gray-500">{l}</label>
              <input type="number" value={(form as any)[k]} onChange={e => setForm(f => ({...f, [k]: parseFloat(e.target.value) || 0}))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          ))}
        </div>
        <button onClick={async () => { await onRecord(form); setShowNew(false); onFlash('Settlement recorded'); }}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-lg">Record Settlement</button>
      </div>}

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Date</th><th className="p-2">Type</th><th className="p-2">Settlement #</th><th className="p-2">UTR</th>
          <th className="p-2 text-right">Claimed</th><th className="p-2 text-right">Settled</th><th className="p-2 text-right">TDS</th><th className="p-2 text-right">Net</th><th className="p-2">Recon</th>
        </tr></thead><tbody>{settlements.map(s => (
          <tr key={s.id} className="border-b hover:bg-gray-50">
            <td className="p-2">{s.settlement_date}</td>
            <td className="p-2 text-center"><span className="bg-gray-100 px-1 py-0.5 rounded text-[9px]">{s.settlement_type}</span></td>
            <td className="p-2 font-mono text-[10px]">{s.settlement_number || '—'}</td>
            <td className="p-2 font-mono text-[10px]">{s.utr_number || '—'}</td>
            <td className="p-2 text-right">{'₹'}{fmt(s.claimed_amount)}</td>
            <td className="p-2 text-right font-bold text-green-700">{'₹'}{fmt(s.settled_amount)}</td>
            <td className="p-2 text-right text-orange-600">{parseFloat(s.tds_amount) > 0 ? '₹' + fmt(s.tds_amount) : '—'}</td>
            <td className="p-2 text-right font-bold">{'₹'}{fmt(s.net_received)}</td>
            <td className="p-2 text-center">{s.reconciled
              ? <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded text-[9px]">Done</span>
              : <button onClick={() => { onReconcile(s.id, staffId); onFlash('Reconciled'); }} className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-[10px]">Reconcile</button>
            }</td>
          </tr>
        ))}</tbody></table>
      </div>
    </div>
  );
}

// ============================================================
// LOYALTY PROGRAM
// ============================================================
interface LoyaltyProps {
  cards: any[];
  onIssue: (d: any) => Promise<void>;
  onFlash: (m: string) => void;
}

const CARD_TYPES: { type: string; label: string; opd: number; ipd: number; pharma: number; lab: number }[] = [
  { type: 'silver', label: 'Silver', opd: 5, ipd: 5, pharma: 3, lab: 5 },
  { type: 'gold', label: 'Gold', opd: 10, ipd: 8, pharma: 5, lab: 10 },
  { type: 'platinum', label: 'Platinum', opd: 15, ipd: 12, pharma: 8, lab: 15 },
  { type: 'staff', label: 'Staff', opd: 20, ipd: 15, pharma: 10, lab: 20 },
  { type: 'senior_citizen', label: 'Senior Citizen', opd: 10, ipd: 10, pharma: 5, lab: 10 },
  { type: 'freedom_fighter', label: 'Freedom Fighter', opd: 25, ipd: 20, pharma: 10, lab: 25 },
  { type: 'bpl', label: 'BPL', opd: 50, ipd: 40, pharma: 20, lab: 50 },
];

export function LoyaltyProgram({ cards, onIssue, onFlash }: LoyaltyProps) {
  const typeColor = (t: string) => t === 'platinum' ? 'bg-purple-100 text-purple-700' : t === 'gold' ? 'bg-yellow-100 text-yellow-700' : t === 'staff' ? 'bg-blue-100 text-blue-700' : t === 'bpl' ? 'bg-green-100 text-green-700' : t === 'freedom_fighter' ? 'bg-orange-100 text-orange-700' : t === 'senior_citizen' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100 text-gray-700';

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm">Loyalty &amp; Concession Program</h2>
      <div className="grid grid-cols-7 gap-2">
        {CARD_TYPES.map(ct => (
          <div key={ct.type} className={`rounded-xl border p-2.5 text-center ${typeColor(ct.type)}`}>
            <div className="font-semibold text-sm">{ct.label}</div>
            <div className="text-[10px] mt-1 space-y-0.5">
              <div>OPD: {ct.opd}%</div>
              <div>IPD: {ct.ipd}%</div>
              <div>Pharmacy: {ct.pharma}%</div>
              <div>Lab: {ct.lab}%</div>
            </div>
            <div className="mt-1 text-[10px] font-bold">{cards.filter(c => c.card_type === ct.type).length} issued</div>
          </div>
        ))}
      </div>

      {cards.length === 0
        ? <div className="text-center py-6 bg-white rounded-xl border text-gray-400 text-sm">No loyalty cards issued</div>
        : <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Card #</th><th className="p-2 text-left">Patient</th><th className="p-2">Type</th>
              <th className="p-2">OPD %</th><th className="p-2">IPD %</th><th className="p-2">Points</th><th className="p-2">Valid</th>
            </tr></thead><tbody>{cards.map(c => (
              <tr key={c.id} className="border-b">
                <td className="p-2 font-mono">{c.card_number}</td>
                <td className="p-2 font-medium">{c.patient?.first_name} {c.patient?.last_name}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[10px] ${typeColor(c.card_type)}`}>{c.card_type}</span></td>
                <td className="p-2 text-center">{c.discount_opd}%</td>
                <td className="p-2 text-center">{c.discount_ipd}%</td>
                <td className="p-2 text-center font-bold">{c.points_balance}</td>
                <td className="p-2 text-center text-[10px] text-gray-400">{c.valid_until || 'Lifetime'}</td>
              </tr>
            ))}</tbody></table>
          </div>
      }
    </div>
  );
}

// ============================================================
// GOVT SCHEMES
// ============================================================
interface GovtProps {
  schemes: any[];
  onFlash: (m: string) => void;
}

export function GovtSchemes({ schemes, onFlash }: GovtProps) {
  const schemeColor = (s: string) => {
    if (s === 'pmjay') return 'bg-orange-50 border-orange-200';
    if (s === 'cghs') return 'bg-green-50 border-green-200';
    if (s === 'echs') return 'bg-blue-50 border-blue-200';
    if (s === 'esi') return 'bg-purple-50 border-purple-200';
    return 'bg-gray-50 border-gray-200';
  };

  return (
    <div className="space-y-4">
      <h2 className="font-semibold text-sm">Government Scheme Configuration</h2>
      {schemes.length === 0
        ? <div className="text-center py-8 bg-white rounded-xl border text-gray-400 text-sm">No government schemes configured. Set up PMJAY, CGHS, ECHS, ESI empanelment in Settings.</div>
        : <div className="grid grid-cols-2 gap-3">
            {schemes.map(s => (
              <div key={s.id} className={`rounded-xl border p-4 ${schemeColor(s.scheme_code)}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-lg">{s.scheme_code?.toUpperCase()}</div>
                    <div className="text-sm">{s.scheme_name}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${s.is_active ? 'bg-green-600 text-white' : 'bg-red-100 text-red-700'}`}>{s.is_active ? 'Active' : 'Inactive'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
                  <div><span className="text-gray-600">Empanelment:</span> {s.empanelment_number || '—'}</div>
                  <div><span className="text-gray-600">Valid:</span> {s.empanelment_valid_from || '—'} to {s.empanelment_valid_to || '—'}</div>
                  <div><span className="text-gray-600">Nodal officer:</span> {s.nodal_officer || '—'}</div>
                  <div><span className="text-gray-600">Portal:</span> {s.submission_portal || '—'}</div>
                  <div><span className="text-gray-600">Max claim days:</span> {s.max_claim_days || 15}</div>
                  <div><span className="text-gray-600">Auto-claim:</span> {s.auto_claim ? 'Yes' : 'No'}</div>
                </div>
              </div>
            ))}
          </div>
      }
    </div>
  );
}
