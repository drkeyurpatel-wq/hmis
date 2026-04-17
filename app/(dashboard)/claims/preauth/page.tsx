'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  FileText, Clock, CheckCircle, XCircle, AlertTriangle,
  Search, Plus, ArrowUpRight, RefreshCw, MessageSquare,
} from 'lucide-react';
import { STATUS_CONFIG, type ClaimStatus } from '@/lib/claims/types';

const INR = (n: number | null) => !n ? '—' : n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${Math.round(n).toLocaleString('en-IN')}`;

const PREAUTH_STATUSES: ClaimStatus[] = ['preauth_pending', 'preauth_approved', 'preauth_query', 'preauth_rejected', 'preauth_enhanced'];

export default function PreauthPage() {
  const router = useRouter();
  const { activeCentreId } = useAuthStore();
  const [claims, setClaims] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCentreId) return;
    const load = async () => {
      setLoading(true);
      let q = sb().from('clm_claims')
        .select('*, clm_payers!clm_claims_payer_id_fkey(name, type)')
        .eq('centre_id', activeCentreId)
        .in('status', PREAUTH_STATUSES)
        .order('created_at', { ascending: false });
      if (filter !== 'all') q = q.eq('status', filter);
      if (search) q = q.or(`patient_name.ilike.%${search}%,claim_number.ilike.%${search}%`);
      const { data } = await q;
      setClaims(data || []);
      setLoading(false);
    };
    load();
  }, [activeCentreId, filter, search]);

  const counts = {
    all: claims.length,
    pending: claims.filter(c => c.status === 'preauth_pending').length,
    approved: claims.filter(c => c.status === 'preauth_approved').length,
    query: claims.filter(c => c.status === 'preauth_query').length,
    rejected: claims.filter(c => c.status === 'preauth_rejected').length,
  };

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Pre-Authorization</h1>
            <p className="text-sm text-gray-500">Track and manage pre-auth requests across all payers</p>
          </div>
          <button onClick={() => router.push('/claims/new')}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> New Pre-Auth
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { key: 'all', label: 'Total', count: counts.all, icon: FileText, color: 'text-gray-700', bg: 'bg-gray-50' },
            { key: 'preauth_pending', label: 'Pending', count: counts.pending, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
            { key: 'preauth_approved', label: 'Approved', count: counts.approved, icon: CheckCircle, color: 'text-green-700', bg: 'bg-green-50' },
            { key: 'preauth_query', label: 'Query', count: counts.query, icon: AlertTriangle, color: 'text-orange-700', bg: 'bg-orange-50' },
            { key: 'preauth_rejected', label: 'Rejected', count: counts.rejected, icon: XCircle, color: 'text-red-700', bg: 'bg-red-50' },
          ].map(c => (
            <button key={c.key} onClick={() => setFilter(c.key === 'all' ? 'all' : c.key)}
              className={`${c.bg} rounded-xl p-3 border text-left transition-all ${filter === c.key || (filter === 'all' && c.key === 'all') ? 'ring-2 ring-blue-500' : 'border-transparent'}`}>
              <div className="flex items-center gap-2 mb-1">
                <c.icon className={`w-4 h-4 ${c.color}`} />
                <span className="text-xs font-medium text-gray-500">{c.label}</span>
              </div>
              <p className={`text-lg font-bold ${c.color}`}>{c.count}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-b">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search patient or claim #..." value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white" />
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading pre-auth requests...</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20 text-gray-400">No pre-auth requests found</div>
        ) : (
          <div className="space-y-2">
            {claims.map(claim => {
              const sc = STATUS_CONFIG[claim.status as ClaimStatus];
              const hours = claim.created_at ? Math.round((Date.now() - new Date(claim.created_at).getTime()) / 3600000) : 0;
              return (
                <div key={claim.id}
                  onClick={() => router.push(`/claims/${claim.id}`)}
                  className="bg-white rounded-lg border p-4 hover:border-blue-300 cursor-pointer flex items-center justify-between transition-colors">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-blue-600">{claim.claim_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>{sc.label}</span>
                        {claim.status === 'preauth_query' && (
                          <span className="flex items-center gap-1 text-xs text-orange-600"><MessageSquare className="w-3 h-3" /> Query pending</span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1">{claim.patient_name}</p>
                      <p className="text-xs text-gray-500">
                        {claim.clm_payers?.name} • {claim.primary_diagnosis || 'No diagnosis'} • Est. {INR(claim.estimated_amount)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">{hours}h ago</p>
                    {claim.approved_amount && (
                      <p className="text-sm font-semibold text-green-700 mt-1">Approved: {INR(claim.approved_amount)}</p>
                    )}
                    <ArrowUpRight className="w-4 h-4 text-gray-300 ml-auto mt-1" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
