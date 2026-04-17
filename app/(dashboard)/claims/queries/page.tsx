'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  AlertTriangle, Clock, MessageSquare, XCircle, Send,
  Search, ChevronDown, ArrowUpRight, CheckCircle, Loader2,
  User, Stethoscope, IndianRupee, FileText, Filter,
} from 'lucide-react';
import { PRIORITY_CONFIG, type QueryPriority, type QueryCategory } from '@/lib/claims/types';
import { fetchOpenQueries, fetchRejections } from '@/lib/claims/api';

export default function QueriesPage() {
  const router = useRouter();
  const { activeCentreId, staff } = useAuthStore();
  const [queries, setQueries] = useState<any[]>([]);
  const [rejections, setRejections] = useState<any[]>([]);
  const [tab, setTab] = useState<'queries' | 'rejections'>('queries');
  const [loading, setLoading] = useState(true);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCentreId) return;
    const load = async () => {
      setLoading(true);
      const [q, r] = await Promise.all([
        fetchOpenQueries(activeCentreId),
        fetchRejections(activeCentreId),
      ]);
      setQueries(q);
      setRejections(r);
      setLoading(false);
    };
    load();
  }, [activeCentreId]);

  const submitResponse = async (queryId: string) => {
    if (!responseText.trim()) return;
    setSaving(true);
    try {
      await sb().from('clm_queries').update({
        response_text: responseText,
        responded_by: staff?.id,
        responded_at: new Date().toISOString(),
        status: 'responded',
      }).eq('id', queryId);
      setRespondingTo(null);
      setResponseText('');
      // Reload using API
      const q = await fetchOpenQueries(activeCentreId || '');
      setQueries(q);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const hoursOpen = (date: string) => Math.round((Date.now() - new Date(date).getTime()) / 3600000);

  return (
    <div className="min-h-screen">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Queries & Rejections</h1>
        <p className="text-sm text-gray-500">Respond to TPA queries, manage rejections and appeals</p>

        <div className="flex gap-2 mt-4">
          <button onClick={() => setTab('queries')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 ${
              tab === 'queries' ? 'bg-orange-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <AlertTriangle className="w-3.5 h-3.5" /> Open Queries ({queries.length})
          </button>
          <button onClick={() => setTab('rejections')}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg flex items-center gap-1.5 ${
              tab === 'rejections' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            <XCircle className="w-3.5 h-3.5" /> Rejections ({rejections.length})
          </button>
        </div>
      </div>

      <div className="px-6 py-4">
        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading...</div>
        ) : tab === 'queries' ? (
          queries.length === 0 ? (
            <div className="text-center py-20">
              <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No open queries</p>
              <p className="text-sm text-gray-400">All TPA queries have been responded to</p>
            </div>
          ) : (
            <div className="space-y-3">
              {queries.map(q => {
                const hrs = hoursOpen(q.raised_at);
                const isBreached = q.is_sla_breached;
                const pc = PRIORITY_CONFIG[q.priority as QueryPriority] || PRIORITY_CONFIG.medium;
                return (
                  <div key={q.id} className={`bg-white rounded-lg border p-4 ${isBreached ? 'border-red-300 bg-red-50/30' : 'border-gray-200'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-medium text-blue-600 cursor-pointer hover:underline"
                            onClick={() => router.push(`/claims/${q.claim_id}`)}>
                            {q.claim_number}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${pc.bg} ${pc.color}`}>{pc.label}</span>
                          <span className="text-xs text-gray-400">Q{q.query_number}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600">{q.query_category}</span>
                          {isBreached && <span className="text-xs font-medium text-red-600 flex items-center gap-1">⚠️ SLA Breached</span>}
                          {q.escalation_level > 0 && (
                            <span className="text-xs font-medium text-red-500">Escalation L{q.escalation_level}</span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-gray-900 mt-1">{q.patient_name}</p>
                        <p className="text-xs text-gray-500">{q.payer_name}</p>
                        <div className="mt-2 p-3 bg-orange-50 rounded-lg border border-orange-100">
                          <p className="text-sm text-gray-800">{q.query_text}</p>
                        </div>
                        {q.routed_to_role && (
                          <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                            <User className="w-3 h-3" /> Routed to: <span className="font-medium">{q.routed_to_role}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4 shrink-0">
                        <div className={`text-sm font-bold ${hrs > 48 ? 'text-red-600' : hrs > 24 ? 'text-orange-600' : 'text-gray-600'}`}>
                          {hrs}h
                        </div>
                        <p className="text-xs text-gray-400">open</p>
                      </div>
                    </div>

                    {/* Response area */}
                    {respondingTo === q.id ? (
                      <div className="mt-3 border-t pt-3">
                        <textarea value={responseText} onChange={e => setResponseText(e.target.value)}
                          placeholder="Type response to TPA query..." rows={3}
                          className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500" autoFocus />
                        <div className="flex gap-2 mt-2">
                          <button onClick={() => { setRespondingTo(null); setResponseText(''); }}
                            className="px-3 py-1.5 text-xs border rounded-lg hover:bg-gray-50">Cancel</button>
                          <button onClick={() => submitResponse(q.id)} disabled={saving || !responseText.trim()}
                            className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1">
                            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Submit Response
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <button onClick={() => setRespondingTo(q.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" /> Respond
                        </button>
                        <button onClick={() => router.push(`/claims/${q.claim_id}`)}
                          className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:bg-gray-50 flex items-center gap-1">
                          <ArrowUpRight className="w-3 h-3" /> View Claim
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Rejections Tab */
          rejections.length === 0 ? (
            <div className="text-center py-20 text-gray-400">No rejections found</div>
          ) : (
            <div className="space-y-2">
              {rejections.map(rej => (
                <div key={rej.id}
                  onClick={() => router.push(`/claims/${rej.claim_id}`)}
                  className="bg-white rounded-lg border p-4 hover:border-red-300 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-blue-600">{rej.claim_number}</span>
                        <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">{rej.rejection_stage}</span>
                        {rej.is_appealed && <span className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700">Appealed</span>}
                      </div>
                      <p className="text-sm font-medium text-gray-900 mt-1">{rej.patient_name}</p>
                      <p className="text-sm text-red-700 mt-1">{rej.rejection_reason}</p>
                      {rej.rejection_details && <p className="text-xs text-gray-500 mt-1">{rej.rejection_details}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">{new Date(rej.rejected_at).toLocaleDateString('en-IN')}</p>
                      {rej.claimed_amount && (
                        <p className="text-sm font-medium text-gray-700 mt-1">
                          ₹{Math.round(rej.claimed_amount).toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
