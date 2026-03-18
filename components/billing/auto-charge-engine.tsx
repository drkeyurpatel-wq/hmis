// components/billing/auto-charge-engine.tsx
// Daily auto-charge runner + rules management
'use client';
import React, { useState } from 'react';
import { useAutoChargeRules } from '@/lib/billing/charge-capture-hooks';
import { useAuthStore } from '@/lib/store/auth';

const WARD_LABELS: Record<string, string> = {
  general: 'General', semi_private: 'Semi Pvt', private: 'Private', icu: 'ICU',
  transplant_icu: 'TICU', nicu: 'NICU', picu: 'PICU', isolation: 'Isolation',
};
const TRIGGER_LABELS: Record<string, string> = {
  daily: 'Daily', admission: 'On Admission', discharge: 'On Discharge',
  procedure: 'Per Procedure', investigation: 'Per Investigation', pharmacy: 'Per Dispense',
};

interface Props { centreId: string; onFlash: (msg: string) => void; }

export default function AutoChargeEngine({ centreId, onFlash }: Props) {
  const { staff } = useAuthStore();
  const staffId = staff?.id || '';
  const { rules, lastRun, runDailyCharges, toggleRule } = useAutoChargeRules(centreId);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ count?: number; total?: number } | null>(null);
  const [error, setError] = useState('');

  const today = new Date().toISOString().split('T')[0];
  const alreadyRun = lastRun?.run_date === today;

  const handleRun = async () => {
    setRunning(true); setError(''); setResult(null);
    const r = await runDailyCharges(staffId);
    setRunning(false);
    if (!r.success) { setError(r.error || 'Failed'); return; }
    setResult({ count: r.count, total: r.total });
    onFlash(`${r.count} charges posted: ₹${(r.total || 0).toLocaleString('en-IN')}`);
  };

  const dailyRules = rules.filter(r => r.triggerType === 'daily');
  const admRules = rules.filter(r => r.triggerType === 'admission');

  // Group daily rules by ward
  const byWard = new Map<string, typeof dailyRules>();
  dailyRules.forEach(r => {
    const w = r.wardType || 'all';
    if (!byWard.has(w)) byWard.set(w, []);
    byWard.get(w)!.push(r);
  });

  return (
    <div className="space-y-4">
      {/* Run button */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-bold text-sm">Daily Auto-Charge Engine</h2>
            <p className="text-xs text-gray-500">Posts bed rent, nursing, MO visit, diet, ICU monitoring for all active admissions</p>
          </div>
          <div className="text-right">
            {lastRun && <div className="text-[10px] text-gray-400">Last run: {lastRun.run_date} ({lastRun.charges_posted} charges, ₹{parseFloat(lastRun.total_amount).toLocaleString('en-IN')})</div>}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={handleRun} disabled={running || alreadyRun}
            className={`px-6 py-2.5 text-sm rounded-lg font-medium ${alreadyRun ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'} disabled:opacity-50`}>
            {running ? 'Running...' : alreadyRun ? `✓ Already run for ${today}` : `Run Daily Charges for ${today}`}
          </button>
          {result && <div className="text-sm text-green-700 font-medium">{result.count} charges posted — ₹{(result.total || 0).toLocaleString('en-IN')}</div>}
          {error && <div className="text-sm text-red-700">{error}</div>}
        </div>
      </div>

      {/* Rules by ward */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b"><h3 className="font-bold text-xs text-gray-700">Daily Charge Rules ({dailyRules.length})</h3></div>
        <table className="w-full text-xs">
          <thead><tr className="border-b text-gray-500"><th className="p-2 text-left">Rule</th><th className="p-2">Ward</th><th className="p-2 text-right">Amount</th><th className="p-2 text-center">Active</th></tr></thead>
          <tbody>{Array.from(byWard.entries()).flatMap(([ward, wRules]) =>
            wRules.map((r, i) => (
              <tr key={r.id} className={`border-b ${!r.isActive ? 'opacity-40' : ''}`}>
                <td className="p-2 font-medium">{r.chargeDescription}</td>
                <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${
                  ward === 'icu' ? 'bg-red-100 text-red-700' : ward === 'transplant_icu' ? 'bg-red-100 text-red-700' :
                  ward === 'private' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                }`}>{WARD_LABELS[ward] || ward}</span></td>
                <td className="p-2 text-right font-bold">₹{r.chargeAmount.toLocaleString('en-IN')}</td>
                <td className="p-2 text-center">
                  <button onClick={() => toggleRule(r.id, !r.isActive)} className={`w-8 h-4 rounded-full relative ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                    <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${r.isActive ? 'right-0.5' : 'left-0.5'}`} />
                  </button>
                </td>
              </tr>
            ))
          )}</tbody>
        </table>
      </div>

      {/* Admission charges */}
      {admRules.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b"><h3 className="font-bold text-xs text-gray-700">One-Time Admission Charges ({admRules.length})</h3></div>
        <table className="w-full text-xs"><tbody>{admRules.map(r => (
          <tr key={r.id} className="border-b">
            <td className="p-2 font-medium">{r.chargeDescription}</td>
            <td className="p-2 text-right font-bold">₹{r.chargeAmount.toLocaleString('en-IN')}</td>
            <td className="p-2 text-center w-16">
              <button onClick={() => toggleRule(r.id, !r.isActive)} className={`w-8 h-4 rounded-full relative ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`}>
                <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${r.isActive ? 'right-0.5' : 'left-0.5'}`} />
              </button>
            </td>
          </tr>
        ))}</tbody></table>
      </div>}

      {/* Per-ward daily total */}
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-xs font-bold text-gray-500 mb-2">Daily Charge per Patient (by ward type)</h3>
        <div className="grid grid-cols-4 gap-2">
          {Array.from(byWard.entries()).map(([ward, wRules]) => {
            const total = wRules.filter(r => r.isActive).reduce((s, r) => s + r.chargeAmount, 0);
            return (
              <div key={ward} className="text-center bg-gray-50 rounded-lg p-2">
                <div className="text-[10px] text-gray-500">{WARD_LABELS[ward] || ward}</div>
                <div className="text-lg font-bold">₹{total.toLocaleString('en-IN')}</div>
                <div className="text-[9px] text-gray-400">/day/patient</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
