'use client';

import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Building2, Search, Globe, Bot, CheckCircle, XCircle,
  ExternalLink, Shield, IndianRupee, Clock, Settings,
} from 'lucide-react';

const TYPE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  tpa: { label: 'TPA', color: 'text-blue-700', bg: 'bg-blue-50' },
  insurer: { label: 'Insurer', color: 'text-purple-700', bg: 'bg-purple-50' },
  government: { label: 'Government', color: 'text-green-700', bg: 'bg-green-50' },
  psu: { label: 'PSU', color: 'text-amber-700', bg: 'bg-amber-50' },
  corporate: { label: 'Corporate', color: 'text-gray-700', bg: 'bg-gray-50' },
};

export default function PayerMasterPage() {
  const { activeCentreId } = useAuthStore();
  const [payers, setPayers] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [claimCounts, setClaimCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const s = sb();
      const { data: p } = await s.from('clm_payers').select('*').order('type').order('name');
      setPayers(p || []);

      // Get claim counts per payer
      if (activeCentreId) {
        const { data: claims } = await s.from('clm_claims').select('payer_id').eq('centre_id', activeCentreId);
        const counts: Record<string, number> = {};
        (claims || []).forEach((c: any) => { counts[c.payer_id] = (counts[c.payer_id] || 0) + 1; });
        setClaimCounts(counts);
      }

      setLoading(false);
    };
    load();
  }, [activeCentreId]);

  const filtered = payers.filter(p => {
    if (typeFilter && p.type !== typeFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.code.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const typeCounts = {
    tpa: payers.filter(p => p.type === 'tpa').length,
    insurer: payers.filter(p => p.type === 'insurer').length,
    government: payers.filter(p => p.type === 'government').length,
    psu: payers.filter(p => p.type === 'psu').length,
  };

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Payer Master</h1>
        <p className="text-sm text-gray-500">All TPAs, insurers, and government schemes — {payers.length} total</p>

        <div className="grid grid-cols-4 gap-3 mt-4">
          {Object.entries(typeCounts).map(([type, count]) => {
            const tc = TYPE_LABELS[type] || TYPE_LABELS.corporate;
            return (
              <button key={type} onClick={() => setTypeFilter(typeFilter === type ? '' : type)}
                className={`${tc.bg} rounded-xl p-3 text-left ${typeFilter === type ? 'ring-2 ring-blue-500' : ''}`}>
                <p className="text-xs text-gray-500">{tc.label}s</p>
                <p className={`text-lg font-bold ${tc.color}`}>{count}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search payers..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading payers...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Code</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Name</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Portal</th>
                  <th className="text-center py-2.5 px-3 font-medium text-gray-500">NHCX</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500">Claims</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(p => {
                  const tc = TYPE_LABELS[p.type] || TYPE_LABELS.corporate;
                  const count = claimCounts[p.id] || 0;
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-medium text-gray-600">{p.code}</span>
                      </td>
                      <td className="py-2.5 px-3 font-medium text-gray-900">{p.name}</td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${tc.bg} ${tc.color}`}>{tc.label}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {p.portal_url ? (
                          <a href={p.portal_url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                            <Globe className="w-3 h-3" /> {p.portal_type || 'web'}
                          </a>
                        ) : (
                          <span className="text-xs text-gray-300">No portal</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {p.is_nhcx_live ? (
                          <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-300 mx-auto" />
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        {count > 0 ? <span className="font-medium text-blue-700">{count}</span> : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`text-xs font-medium ${p.is_active ? 'text-green-600' : 'text-red-500'}`}>
                          {p.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
