// @ts-nocheck
// HEALTH1 HMIS — PAYER MASTER
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Building2, Search, Globe, CheckCircle2, XCircle,
  ExternalLink, Shield, RefreshCw, FileText,
} from 'lucide-react';

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  tpa: { label: 'TPA', color: 'text-blue-700', bg: 'bg-blue-50' },
  insurer: { label: 'Insurer', color: 'text-purple-700', bg: 'bg-purple-50' },
  government: { label: 'Government', color: 'text-green-700', bg: 'bg-green-50' },
  psu: { label: 'PSU', color: 'text-amber-700', bg: 'bg-amber-50' },
};

export default function PayerMasterPage() {
  const router = useRouter();
  const { activeCentreId } = useAuthStore();

  const [payers, setPayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const s = sb();
    const { data: p } = await s.from('clm_payers').select('*').order('type').order('name');
    setPayers(p || []);
    if (activeCentreId) {
      const { data: claims } = await s.from('clm_claims').select('payer_id').eq('centre_id', activeCentreId);
      const counts: Record<string, number> = {};
      (claims || []).forEach((c: any) => { counts[c.payer_id] = (counts[c.payer_id] || 0) + 1; });
      setClaimCounts(counts);
    }
    setLoading(false);
  }, [activeCentreId]);

  useEffect(() => { load(); }, [load]);

  const filtered = payers
    .filter(p => !typeFilter || p.type === typeFilter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase()));

  // Type counts
  const typeCounts = { tpa: 0, insurer: 0, government: 0, psu: 0 };
  payers.forEach(p => { if (typeCounts[p.type] !== undefined) typeCounts[p.type]++; });

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b px-6 py-4"><div className="h-6 w-48 bg-gray-200 rounded animate-pulse" /></div>
      <div className="px-6 pt-4"><div className="h-96 bg-gray-100 rounded-xl animate-pulse" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" /> Payer Master
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">{payers.length} payers — {typeCounts.tpa} TPAs, {typeCounts.insurer} insurers, {typeCounts.government} govt, {typeCounts.psu} PSUs</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => load()} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button onClick={() => router.push('/claims')} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Shield className="w-3.5 h-3.5" /> Claims
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Type pills */}
          <button onClick={() => setTypeFilter('')}
            className={`px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${!typeFilter ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'}`}>
            All ({payers.length})
          </button>
          {Object.entries(TYPE_CONFIG).map(([k, v]) => (
            <button key={k} onClick={() => setTypeFilter(typeFilter === k ? '' : k)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded-xl transition-all ${
                typeFilter === k ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
              }`}>
              {v.label} ({typeCounts[k] || 0})
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input type="text" placeholder="Search payer..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg w-48 focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="px-6 pb-6">
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Payer</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Code</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Claims</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Portal</th>
                <th className="text-center px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">NHCX</th>
                <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Avg Days</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const tc = TYPE_CONFIG[p.type] || TYPE_CONFIG.tpa;
                const count = claimCounts[p.id] || 0;
                return (
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <p className="text-sm font-medium text-gray-900">{p.name}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${tc.bg} ${tc.color}`}>{tc.label}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-gray-500">{p.code}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {count > 0 ? (
                        <span className="font-mono text-sm font-bold text-gray-900">{count}</span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.portal_url ? (
                        <a href={p.portal_url} target="_blank" rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit">
                          <ExternalLink className="w-3 h-3" />
                          {p.portal_type === 'api' ? 'API' : p.portal_type === 'web' ? 'Web' : 'Portal'}
                        </a>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {p.is_nhcx_live ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.avg_settlement_days ? (
                        <span className={`font-mono text-sm font-medium ${
                          p.avg_settlement_days > 60 ? 'text-red-600' :
                          p.avg_settlement_days > 30 ? 'text-orange-600' : 'text-gray-600'
                        }`}>{p.avg_settlement_days}d</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 text-xs text-gray-400 text-center">
          {filtered.length} payer{filtered.length !== 1 ? 's' : ''} shown
          {typeFilter && <button onClick={() => setTypeFilter('')} className="text-purple-600 ml-2 hover:underline">Show all</button>}
        </div>
      </div>
    </div>
  );
}
