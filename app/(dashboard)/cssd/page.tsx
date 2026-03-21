'use client';
import React, { useState } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useCssd } from '@/lib/modules/module-hooks';
import { Plus, X, CheckCircle2, AlertTriangle, Clock } from 'lucide-react';

const STATUS_BADGE: Record<string, string> = { available: 'h1-badge-green', in_use: 'h1-badge-amber', sterilizing: 'h1-badge-blue', maintenance: 'h1-badge-red' };

function CssdInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const cssd = useCssd(centreId);
  const [tab, setTab] = useState<'sets' | 'cycles'>('sets');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold tracking-tight">CSSD</h1><p className="text-xs text-gray-400">Central Sterile Supply Department</p></div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {[
          { label: 'Total Sets', value: cssd.stats.totalSets, color: 'text-gray-800' },
          { label: 'Available', value: cssd.stats.available, color: 'text-emerald-700' },
          { label: 'In Use', value: cssd.stats.inUse, color: 'text-amber-700' },
          { label: 'Sterilizing', value: cssd.stats.sterilizing, color: 'text-blue-700' },
          { label: 'Cycles Today', value: cssd.stats.cyclesToday, color: 'text-teal-700' },
          { label: 'Failed', value: cssd.stats.failedCycles, color: cssd.stats.failedCycles > 0 ? 'text-red-600' : 'text-gray-400' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border px-3 py-3 text-center">
            <div className="text-[9px] text-gray-400 uppercase font-semibold">{s.label}</div><div className={`text-2xl font-black ${s.color}`}>{s.value}</div></div>
        ))}
      </div>

      <div className="flex gap-1">
        {[{ key: 'sets', label: 'Instrument Sets' }, { key: 'cycles', label: 'Sterilization Cycles' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-3.5 py-2 text-xs font-medium rounded-xl ${tab === t.key ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 border'}`}>{t.label}</button>
        ))}
      </div>

      {tab === 'sets' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="h1-table">
            <thead><tr><th>Set Code</th><th>Name</th><th>Department</th><th>Instruments</th><th>Status</th><th>Last Sterilized</th><th>Cycles</th></tr></thead>
            <tbody>
              {cssd.sets.map(s => (
                <tr key={s.id}>
                  <td className="font-mono text-[10px]">{s.set_code || '—'}</td>
                  <td className="font-semibold">{s.set_name}</td>
                  <td className="text-gray-500">{s.department || '—'}</td>
                  <td>{s.total_instruments}</td>
                  <td><span className={`h1-badge ${STATUS_BADGE[s.status] || 'h1-badge-gray'} capitalize`}>{s.status?.replace('_', ' ')}</span></td>
                  <td className="text-[11px] text-gray-500">{s.last_sterilized_at ? new Date(s.last_sterilized_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'}</td>
                  <td><span className={s.sterilization_count > s.max_cycles * 0.9 ? 'text-red-600 font-bold' : ''}>{s.sterilization_count}/{s.max_cycles}</span></td>
                </tr>
              ))}
              {cssd.sets.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-gray-400">No instrument sets configured</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'cycles' && (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="h1-table">
            <thead><tr><th>Cycle #</th><th>Autoclave</th><th>Type</th><th>Items</th><th>Temp/Pressure</th><th>Duration</th><th>BI Test</th><th>Operator</th><th>Status</th></tr></thead>
            <tbody>
              {cssd.cycles.map(c => (
                <tr key={c.id}>
                  <td className="font-mono text-[10px]">{c.cycle_number}</td>
                  <td>{c.autoclave_number || '—'}</td>
                  <td><span className="h1-badge h1-badge-gray capitalize">{c.cycle_type}</span></td>
                  <td>{(c.load_items || []).length} sets</td>
                  <td className="text-[11px]">{c.temperature}°C / {c.pressure} bar</td>
                  <td>{c.duration_minutes}min</td>
                  <td><span className={`h1-badge ${c.bi_test_result === 'pass' ? 'h1-badge-green' : c.bi_test_result === 'fail' ? 'h1-badge-red' : 'h1-badge-amber'}`}>{c.bi_test_result || 'pending'}</span></td>
                  <td className="text-[11px]">{c.operator?.full_name?.split(' ').pop() || '—'}</td>
                  <td><span className={`h1-badge ${c.status === 'completed' ? 'h1-badge-green' : c.status === 'failed' ? 'h1-badge-red' : 'h1-badge-blue'}`}>{c.status}</span></td>
                </tr>
              ))}
              {cssd.cycles.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No cycles recorded</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
export default function CssdPage() { return <RoleGuard module="ot"><CssdInner /></RoleGuard>; }
