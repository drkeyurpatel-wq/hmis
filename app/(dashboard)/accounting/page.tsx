'use client';
import React, { useState, useEffect } from 'react';
import { useAccounting } from '@/lib/revenue/phase2-hooks';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';

function AccountingPageInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const { accounts, journals, loading, loadJournals, createJournal, getTrialBalance } = useAccounting(centreId);
  const [tab, setTab] = useState<'journals'|'coa'|'trial'>('journals');
  const [trialBalance, setTrialBalance] = useState<any[]>([]);
  const [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { loadJournals(dateFrom, dateTo); }, [dateFrom, dateTo, loadJournals]);

  const loadTrial = async () => { const tb = await getTrialBalance(); setTrialBalance(tb); setTab('trial'); };

  const totalDebit = journals.reduce((s: number, j: any) => s + (j.lines || []).reduce((ls: number, l: any) => ls + (l.debit || 0), 0), 0);
  const totalCredit = journals.reduce((s: number, j: any) => s + (j.lines || []).reduce((ls: number, l: any) => ls + (l.credit || 0), 0), 0);
  const tbDebit = trialBalance.reduce((s, t) => s + t.debit, 0);
  const tbCredit = trialBalance.reduce((s, t) => s + t.credit, 0);

  const typeColor = (t: string) => t === 'asset' ? 'text-blue-700' : t === 'liability' ? 'text-red-700' : t === 'equity' ? 'text-purple-700' : t === 'revenue' ? 'text-green-700' : 'text-orange-700';

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold text-gray-900">Accounting</h1><p className="text-sm text-gray-500">General Ledger, Chart of Accounts, Trial Balance</p></div>
        <div className="flex gap-2 items-center"><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" />
          <span className="text-gray-400">to</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm border rounded-lg px-2 py-1.5" /></div>
      </div>

      <div className="flex gap-2 mb-6">{[['journals','Journal Entries'],['coa','Chart of Accounts'],['trial','Trial Balance']].map(([k,l]) =>
        <button key={k} onClick={() => { if(k==='trial')loadTrial(); else setTab(k as any); }} className={`px-4 py-2 text-sm rounded-lg border ${tab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
      )}</div>

      {tab === 'journals' && <>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-xl p-4"><div className="text-xs text-gray-500">Journal entries</div><div className="text-2xl font-bold">{journals.length}</div></div>
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total debit</div><div className="text-2xl font-bold text-blue-700">Rs.{Math.round(totalDebit).toLocaleString('en-IN')}</div></div>
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total credit</div><div className="text-2xl font-bold text-green-700">Rs.{Math.round(totalCredit).toLocaleString('en-IN')}</div></div>
        </div>
        {loading ? <div className="text-center py-8 text-gray-400">Loading...</div> :
        journals.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No journal entries for this period</div> :
        <div className="space-y-3">{journals.map((j: any) => (
          <div key={j.id} className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-2"><span className="font-mono text-xs text-blue-600">{j.entry_number}</span>
              <div className="flex items-center gap-2"><span className={`px-2 py-0.5 rounded-full text-xs ${j.status === 'posted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>{j.status}</span>
                <span className="text-xs text-gray-400">{j.entry_date}</span>{j.is_auto && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Auto</span>}</div></div>
            <div className="text-sm mb-2">{j.description}</div>
            <table className="w-full text-xs"><thead><tr className="border-b"><th className="text-left p-1.5 text-gray-500">Account</th><th className="text-right p-1.5 text-gray-500">Debit</th><th className="text-right p-1.5 text-gray-500">Credit</th></tr></thead>
            <tbody>{(j.lines || []).map((l: any, i: number) => (
              <tr key={i} className="border-b last:border-0"><td className="p-1.5">{l.account?.account_code} — {l.account?.account_name}</td>
                <td className="p-1.5 text-right">{l.debit > 0 ? 'Rs.' + l.debit.toLocaleString('en-IN') : ''}</td>
                <td className="p-1.5 text-right">{l.credit > 0 ? 'Rs.' + l.credit.toLocaleString('en-IN') : ''}</td></tr>
            ))}</tbody></table>
          </div>
        ))}</div>}
      </>}

      {tab === 'coa' && <>
        {accounts.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No accounts. Seed chart of accounts in Supabase.</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
          <th className="text-left p-3 font-medium text-gray-500">Code</th><th className="text-left p-3 font-medium text-gray-500">Name</th>
          <th className="text-left p-3 font-medium text-gray-500">Type</th><th className="text-left p-3 font-medium text-gray-500">Status</th>
        </tr></thead><tbody>{accounts.map((a: any) => (
          <tr key={a.id} className="border-b hover:bg-gray-50">
            <td className="p-3 font-mono text-xs">{a.account_code}</td><td className="p-3">{a.account_name}</td>
            <td className="p-3"><span className={`text-xs font-medium ${typeColor(a.account_type)}`}>{a.account_type}</span></td>
            <td className="p-3">{a.is_active ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>}</td>
          </tr>
        ))}</tbody></table></div>}
      </>}

      {tab === 'trial' && <>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total debit</div><div className="text-2xl font-bold text-blue-700">Rs.{Math.round(tbDebit).toLocaleString('en-IN')}</div></div>
          <div className="bg-green-50 rounded-xl p-4"><div className="text-xs text-gray-500">Total credit</div><div className="text-2xl font-bold text-green-700">Rs.{Math.round(tbCredit).toLocaleString('en-IN')}</div></div>
          <div className={`rounded-xl p-4 ${Math.abs(tbDebit - tbCredit) < 1 ? 'bg-green-50' : 'bg-red-50'}`}><div className="text-xs text-gray-500">Difference</div><div className={`text-2xl font-bold ${Math.abs(tbDebit - tbCredit) < 1 ? 'text-green-700' : 'text-red-700'}`}>Rs.{Math.abs(Math.round(tbDebit - tbCredit)).toLocaleString('en-IN')}</div></div>
        </div>
        {trialBalance.length === 0 ? <div className="text-center py-12 bg-white rounded-xl border text-gray-400 text-sm">No transactions to show</div> :
        <div className="bg-white rounded-xl border overflow-hidden"><table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
          <th className="text-left p-3 font-medium text-gray-500">Code</th><th className="text-left p-3 font-medium text-gray-500">Account</th>
          <th className="text-left p-3 font-medium text-gray-500">Type</th><th className="text-right p-3 font-medium text-gray-500">Debit</th>
          <th className="text-right p-3 font-medium text-gray-500">Credit</th><th className="text-right p-3 font-medium text-gray-500">Balance</th>
        </tr></thead><tbody>{trialBalance.map((t: any) => (
          <tr key={t.code} className="border-b hover:bg-gray-50">
            <td className="p-3 font-mono text-xs">{t.code}</td><td className="p-3">{t.name}</td>
            <td className="p-3"><span className={`text-xs ${typeColor(t.type)}`}>{t.type}</span></td>
            <td className="p-3 text-right">{t.debit > 0 ? 'Rs.' + Math.round(t.debit).toLocaleString('en-IN') : ''}</td>
            <td className="p-3 text-right">{t.credit > 0 ? 'Rs.' + Math.round(t.credit).toLocaleString('en-IN') : ''}</td>
            <td className="p-3 text-right font-medium">{t.debit - t.credit !== 0 ? 'Rs.' + Math.round(Math.abs(t.debit - t.credit)).toLocaleString('en-IN') + (t.debit > t.credit ? ' Dr' : ' Cr') : '-'}</td>
          </tr>
        ))}</tbody></table></div>}
      </>}
    </div>
  );
}

export default function AccountingPage() { return <RoleGuard module="accounting"><AccountingPageInner /></RoleGuard>; }
