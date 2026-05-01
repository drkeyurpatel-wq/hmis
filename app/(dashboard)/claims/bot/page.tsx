// HEALTH1 HMIS — BOT MONITORING (TPA Portal Automation)
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Bot, CheckCircle2, XCircle, Clock, AlertTriangle,
  RefreshCw, Shield, Play, Image, Timer, Zap,
  Activity, Building2, Eye,
} from 'lucide-react';

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  queued: { bg: 'bg-gray-100', color: 'text-gray-600', label: 'Queued' },
  running: { bg: 'bg-blue-100', color: 'text-blue-700', label: 'Running' },
  success: { bg: 'bg-emerald-100', color: 'text-emerald-700', label: 'Success' },
  partial: { bg: 'bg-amber-100', color: 'text-amber-700', label: 'Partial' },
  failed: { bg: 'bg-red-100', color: 'text-red-700', label: 'Failed' },
  timeout: { bg: 'bg-orange-100', color: 'text-orange-700', label: 'Timeout' },
  captcha_blocked: { bg: 'bg-purple-100', color: 'text-purple-700', label: 'Captcha' },
};

function StatCard({ label, value, sub, icon: Icon, color }: any) {
  return (
    <div className="flex items-start gap-3 rounded-xl border p-4 bg-white border-gray-200">
      <div className={`rounded-lg p-2.5 ${color}`}><Icon className="h-5 w-5 text-white" /></div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="mt-0.5 text-xl font-bold text-gray-900 font-mono tabular-nums">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
      </div>
    </div>
  );
}

export default function BotMonitoringPage() {
  const router = useRouter();
  const { activeCentreId } = useAuthStore();

  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await sb().from('clm_bot_runs')
        .select('*, clm_payers!clm_bot_runs_payer_id_fkey(name, code, type)')
        .order('started_at', { ascending: false })
        .limit(100);
      setRuns(data || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stats
  const total = runs.length;
  const success = runs.filter(r => r.status === 'success').length;
  const failed = runs.filter(r => ['failed', 'timeout', 'captcha_blocked'].includes(r.status)).length;
  const running = runs.filter(r => r.status === 'running').length;
  const totalClaims = runs.reduce((s, r) => s + (r.claims_processed || 0), 0);
  const totalUpdated = runs.reduce((s, r) => s + (r.claims_updated || 0), 0);

  // TPA health: last run per payer
  const tpaHealth: Record<string, any> = {};
  runs.forEach(r => {
    const code = r.clm_payers?.code;
    if (code && !tpaHealth[code]) tpaHealth[code] = r;
  });

  if (loading) return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="bg-white border-b px-6 py-4"><div className="h-6 w-48 bg-gray-200 rounded animate-pulse" /></div>
      <div className="px-6 pt-4 grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
      <div className="px-6 pt-4"><div className="h-96 bg-gray-100 rounded-xl animate-pulse" /></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50/50">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" /> Bot Monitoring
              </h1>
              <p className="text-xs text-gray-500 mt-0.5">TPA portal automation — run history, health status, error tracking</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { load(); flash('Refreshed'); }}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
              <button onClick={() => router.push('/claims')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Shield className="w-3.5 h-3.5" /> Claims
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="px-6 pt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total Runs" value={total} sub={`${running} running`} icon={Activity} color="bg-blue-500" />
          <StatCard label="Success Rate" value={total > 0 ? `${Math.round(100 * success / total)}%` : '—'} sub={`${success} / ${total}`} icon={CheckCircle2} color="bg-emerald-500" />
          <StatCard label="Failed" value={failed} sub={failed > 0 ? 'Needs attention' : 'All clear'} icon={XCircle} color={failed > 0 ? 'bg-red-500' : 'bg-gray-400'} />
          <StatCard label="Claims Updated" value={totalUpdated} sub={`${totalClaims} processed`} icon={Zap} color="bg-purple-500" />
        </div>
      </div>

      {/* TPA Health Cards */}
      {Object.keys(tpaHealth).length > 0 && (
        <div className="px-6 pt-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">TPA Health (Last Run)</h3>
          <div className="grid grid-cols-3 gap-3">
            {Object.entries(tpaHealth).map(([code, run]: [string, any]) => {
              const sc = STATUS_COLORS[run.status] || STATUS_COLORS.failed;
              const ago = Math.round((Date.now() - new Date(run.started_at).getTime()) / 3600000);
              return (
                <div key={code} className={`bg-white rounded-xl border p-4 ${run.status === 'failed' ? 'border-red-200' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm text-gray-900">{run.clm_payers?.name || code}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{run.action} · {ago}h ago</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                  </div>
                  {run.status === 'failed' && run.error_message && (
                    <p className="text-xs text-red-600 mt-2 truncate">{run.error_message}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-500">
                    <span>{run.claims_processed || 0} processed</span>
                    <span>{run.claims_updated || 0} updated</span>
                    {run.duration_ms && <span>{Math.round(run.duration_ms / 1000)}s</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Run History Table */}
      <div className="px-6 pt-4 pb-6">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Run History</h3>
        {runs.length === 0 ? (
          <div className="bg-white rounded-2xl border p-12 text-center">
            <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No bot runs yet</p>
            <p className="text-xs text-gray-400 mt-1">The bot will start running once deployed on the EliteDesk</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Time</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">TPA</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Action</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Processed</th>
                  <th className="text-right px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Error</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => {
                  const sc = STATUS_COLORS[r.status] || STATUS_COLORS.failed;
                  return (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-blue-50/50">
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-gray-600">
                          {new Date(r.started_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-medium text-gray-900">{r.clm_payers?.name || '—'}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-gray-600 font-mono">{r.action}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${sc.bg} ${sc.color}`}>{sc.label}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="text-xs font-mono text-gray-600">
                          {r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-gray-700">{r.claims_processed || 0}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-xs text-emerald-700">{r.claims_updated || 0}</td>
                      <td className="px-4 py-2.5">
                        {r.error_message ? (
                          <span className="text-xs text-red-600 truncate max-w-[200px] inline-block">{r.error_message}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {r.screenshot_url && (
                          <a href={r.screenshot_url} target="_blank" rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-[10px] flex items-center gap-0.5">
                            <Image className="w-3 h-3" /> View
                          </a>
                        )}
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
