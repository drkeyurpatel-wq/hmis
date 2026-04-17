'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import {
  Shield, FileText, AlertTriangle, IndianRupee, Clock,
  Search, Filter, Plus, ChevronDown, ExternalLink,
  CheckCircle, XCircle, Eye, TrendingUp, Building2,
  RefreshCw, ArrowUpRight,
} from 'lucide-react';
import { STATUS_CONFIG, CLAIM_TYPE_LABELS, type ClaimStatus, type ClaimType, type Payer, type Claim } from '@/lib/claims/types';
import { fetchClaimStats, fetchClaims, fetchPayers } from '@/lib/claims/api';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number | null | undefined) => {
  if (!n) return '₹0';
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
};

type Tab = 'all' | 'preauth' | 'active' | 'queries' | 'settlements' | 'closed';

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: 'all', label: 'All Claims', icon: Shield },
  { key: 'preauth', label: 'Pre-Auth', icon: FileText },
  { key: 'active', label: 'Active Claims', icon: Clock },
  { key: 'queries', label: 'Queries', icon: AlertTriangle },
  { key: 'settlements', label: 'Settlements', icon: IndianRupee },
  { key: 'closed', label: 'Closed', icon: CheckCircle },
];

const TAB_STATUS_MAP: Record<Tab, ClaimStatus[] | null> = {
  all: null,
  preauth: ['preauth_pending', 'preauth_approved', 'preauth_query', 'preauth_rejected', 'preauth_enhanced'],
  active: ['claim_submitted', 'claim_under_review', 'claim_query', 'claim_approved', 'claim_partial'],
  queries: ['preauth_query', 'claim_query'],
  settlements: ['settlement_pending', 'settled'],
  closed: ['closed', 'written_off', 'claim_rejected'],
};

export default function ClaimsPage() {
  const router = useRouter();
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [payerFilter, setPayerFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [claims, setClaims] = useState<any[]>([]);
  const [payers, setPayers] = useState<Payer[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    try {
      const [s, p] = await Promise.all([
        fetchClaimStats(centreId),
        fetchPayers(),
      ]);
      setStats(s);
      setPayers(p);
    } catch (e) {
      console.error('Failed to load claims data:', e);
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Load claims when tab/filters change
  useEffect(() => {
    if (!centreId) return;
    const loadClaims = async () => {
      try {
        const statuses = TAB_STATUS_MAP[tab] || undefined;
        const data = await fetchClaims(centreId, {
          statuses: statuses || undefined,
          payer_id: payerFilter || undefined,
          claim_type: (typeFilter || undefined) as ClaimType | undefined,
          search: search || undefined,
        });
        setClaims(data);
      } catch (e) {
        console.error('Failed to load claims:', e);
      }
    };
    loadClaims();
  }, [centreId, tab, payerFilter, typeFilter, search]);

  const statCards = [
    { label: 'Total Claims', value: stats?.total || 0, icon: Shield, color: 'text-gray-700', bg: 'bg-gray-50' },
    { label: 'Pre-Auth Pending', value: stats?.preauth_pending || 0, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50' },
    { label: 'Open Queries', value: stats?.open_queries || 0, icon: AlertTriangle, color: 'text-orange-700', bg: 'bg-orange-50' },
    { label: 'Under Review', value: stats?.under_review || 0, icon: Eye, color: 'text-blue-700', bg: 'bg-blue-50' },
    { label: 'Total Outstanding', value: INR(stats?.total_outstanding), icon: IndianRupee, color: 'text-purple-700', bg: 'bg-purple-50', isAmount: true },
    { label: 'Total Settled', value: INR(stats?.total_settled), icon: CheckCircle, color: 'text-emerald-700', bg: 'bg-emerald-50', isAmount: true },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Claims Management</h1>
            <p className="text-sm text-gray-500 mt-0.5">Insurance claims lifecycle — pre-auth to settlement</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load()}
              className="px-3 py-1.5 text-xs font-medium bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <button
              onClick={() => router.push('/claims/new')}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Claim
            </button>
          </div>
        </div>

        {/* Stat Cards */}
        {!loading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
            {statCards.map((card) => (
              <div key={card.label} className={`${card.bg} rounded-xl p-3 border border-transparent`}>
                <div className="flex items-center gap-2 mb-1">
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                  <span className="text-xs font-medium text-gray-500">{card.label}</span>
                </div>
                <p className={`text-lg font-bold ${card.color}`}>
                  {card.isAmount ? card.value : card.value}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mt-4 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors ${
                tab === t.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-gray-50 border-b flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by patient, claim #, TPA ref..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
          />
        </div>
        <select
          value={payerFilter}
          onChange={e => setPayerFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">All Payers</option>
          {payers.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white"
        >
          <option value="">All Types</option>
          {Object.entries(CLAIM_TYPE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">{claims.length} claims</span>
      </div>

      {/* Claims Table */}
      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading claims...</div>
        ) : claims.length === 0 ? (
          <div className="text-center py-20">
            <Shield className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No claims found</p>
            <p className="text-gray-400 text-sm mt-1">Create a new claim to get started</p>
            <button
              onClick={() => router.push('/claims/new')}
              className="mt-4 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Claim
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Claim #</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Patient</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Payer</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Type</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Status</th>
                  <th className="text-right py-2.5 px-3 font-medium text-gray-500">Amount</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Queries</th>
                  <th className="text-left py-2.5 px-3 font-medium text-gray-500">Date</th>
                  <th className="py-2.5 px-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {claims.map((claim: any) => {
                  const sc = STATUS_CONFIG[claim.status as ClaimStatus] || STATUS_CONFIG.draft;
                  const amount = claim.settled_amount || claim.approved_amount || claim.claimed_amount || claim.estimated_amount;
                  return (
                    <tr
                      key={claim.id}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                      onClick={() => router.push(`/claims/${claim.id}`)}
                    >
                      <td className="py-2.5 px-3">
                        <span className="font-mono text-xs font-medium text-blue-600">{claim.claim_number}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-gray-900">{claim.patient_name}</div>
                        {claim.patient_uhid && (
                          <span className="text-xs text-gray-400">{claim.patient_uhid}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-gray-700 text-xs">
                          {claim.clm_payers?.name || '—'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs text-gray-500">
                          {CLAIM_TYPE_LABELS[claim.claim_type as ClaimType] || claim.claim_type}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.color}`}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="font-medium text-gray-900">{INR(amount)}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        {claim.is_query_pending ? (
                          <span className="inline-flex items-center gap-1 text-xs text-orange-600 font-medium">
                            <AlertTriangle className="w-3 h-3" /> {claim.query_count}
                          </span>
                        ) : claim.query_count > 0 ? (
                          <span className="text-xs text-gray-400">{claim.query_count} resolved</span>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-xs text-gray-500">
                          {new Date(claim.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <ArrowUpRight className="w-4 h-4 text-gray-300" />
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
