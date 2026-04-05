'use client';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  Phone, PhoneOutgoing, MessageCircle, Mail, Calendar, Plus, Search, Filter,
  TrendingUp, Users, Target, Clock, ChevronRight, Star, X, ExternalLink,
} from 'lucide-react';
import { useLeads, useActivities, useClickToCall, useFollowUps, useCampaigns, PIPELINE_STAGES, LEAD_SOURCES } from '@/lib/crm/crm-hooks';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const INR = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${fmt(n)}`;
const timeAgo = (d: string) => { const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000); return m < 60 ? `${m}m` : m < 1440 ? `${Math.floor(m / 60)}h` : `${Math.floor(m / 1440)}d`; };
const C = { teal: '#0d9488', blue: '#2563eb', green: '#16a34a', amber: '#d97706', purple: '#7c3aed', red: '#dc2626', slate: '#475569' };

type Tab = 'pipeline' | 'leads' | 'followups' | 'campaigns' | 'analytics';

function CRMInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const staffId = staff?.id || '';
  const [tab, setTab] = useState<Tab>('pipeline');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const leads = useLeads(centreId);
  const followUps = useFollowUps(centreId, staffId);
  const campaigns = useCampaigns(centreId);
  const { call } = useClickToCall(centreId);

  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showNewLead, setShowNewLead] = useState(false);
  const [leadFilter, setLeadFilter] = useState({ status: 'all', source: 'all', search: '', priority: 'all' });
  const [newLead, setNewLead] = useState({ first_name: '', last_name: '', phone: '', email: '', source: 'phone', interested_department: '', interested_procedure: '', chief_complaint: '', priority: 'medium', notes: '' });

  // Doctors list
  const [doctors, setDoctors] = useState<any[]>([]);
  useEffect(() => {
    if (!centreId) return;
    sb().from('hmis_staff').select('id, full_name, specialisation').eq('staff_type', 'doctor').eq('is_active', true)
      .then(({ data }: any) => setDoctors(data || []));
  }, [centreId]);

  const handleCreateLead = async () => {
    if (!newLead.first_name || !newLead.phone) return;
    const res = await leads.create(newLead, staffId);
    if (res.success) { flash('Lead created'); setShowNewLead(false); setNewLead({ first_name: '', last_name: '', phone: '', email: '', source: 'phone', interested_department: '', interested_procedure: '', chief_complaint: '', priority: 'medium', notes: '' }); }
    else flash(res.error || 'Failed');
  };

  const handleCall = async (phone: string, leadId?: string) => {
    const res = await call(phone, leadId);
    if (res.success) flash(`Calling ${phone}...`);
    else flash(res.error || 'Call failed');
  };

  const TABS: { key: Tab; label: string; icon: any; badge?: number }[] = [
    { key: 'pipeline', label: 'Pipeline', icon: Target },
    { key: 'leads', label: 'All Leads', icon: Users, badge: leads.stats.total },
    { key: 'followups', label: 'Follow-ups', icon: Clock, badge: followUps.stats.total },
    { key: 'campaigns', label: 'Campaigns', icon: TrendingUp },
    { key: 'analytics', label: 'Analytics', icon: TrendingUp },
  ];

  // Pipeline data
  const pipeline = useMemo(() => {
    return PIPELINE_STAGES.filter(s => s.key !== 'lost').map(stage => ({
      ...stage,
      leads: leads.leads.filter(l => l.status === stage.key),
      value: leads.leads.filter(l => l.status === stage.key).reduce((s: number, l: any) => s + parseFloat(l.estimated_value || 0), 0),
    }));
  }, [leads.leads]);

  // Source chart data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sourceData = useMemo(() => Object.entries(leads.stats.bySource).sort((a: any, b: any) => b[1] - a[1]).slice(0, 8).map(([k, v]) => ({ name: k.replace('_', ' '), value: v as number })), [leads.stats]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const deptData = useMemo(() => Object.entries(leads.stats.byDept).sort((a: any, b: any) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ name: k, value: v as number })), [leads.stats]);

  const priorityBadge = (p: string) => p === 'hot' ? 'bg-red-100 text-red-700' : p === 'warm' ? 'bg-amber-100 text-amber-700' : p === 'cold' ? 'bg-blue-100 text-teal-700' : 'bg-gray-100 text-gray-600';

  return (
    <div className="max-w-[1400px] mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-teal-600 text-white px-5 py-2.5 rounded-xl shadow-lg text-sm font-medium">{toast}</div>}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">CRM & Lead Management</h1>
          <p className="text-xs text-gray-400 mt-0.5">LeadSquared + DialShree integrated</p>
        </div>
        <div className="flex items-center gap-2">
          {followUps.stats.overdue > 0 && (
            <button onClick={() => setTab('followups')} className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-semibold animate-pulse cursor-pointer">
              <Clock size={13} /> {followUps.stats.overdue} overdue
            </button>
          )}
          <button onClick={() => setShowNewLead(true)} className="flex items-center gap-1.5 px-4 py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 transition-colors cursor-pointer">
            <Plus size={15} /> New Lead
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-7 gap-2">
        {[
          { label: 'Total Leads', value: leads.stats.total, color: 'text-gray-800' },
          { label: 'New', value: leads.stats.new, color: 'text-teal-700' },
          { label: 'Hot', value: leads.stats.hot, color: 'text-red-600' },
          { label: 'Appt Booked', value: leads.stats.booked, color: 'text-amber-700' },
          { label: 'Converted', value: leads.stats.converted, color: 'text-emerald-700' },
          { label: 'Conv. Rate', value: leads.stats.conversionRate + '%', color: 'text-teal-700' },
          { label: 'Pipeline Value', value: INR(leads.stats.totalValue), color: 'text-purple-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 px-3 py-3 text-center">
            <div className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</div>
            <div className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-xl whitespace-nowrap transition-all ${
              tab === t.key ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
            } cursor-pointer`}>
            <t.icon size={13} /> {t.label}
            {t.badge !== undefined && t.badge > 0 && <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${tab === t.key ? 'bg-white/20' : 'bg-gray-100'}`}>{t.badge}</span>}
          </button>
        ))}
      </div>

      {/* ═══ PIPELINE KANBAN ═══ */}
      {tab === 'pipeline' && (
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
          {pipeline.map(stage => (
            <div key={stage.key} className="flex-shrink-0 w-[230px]">
              <div className="flex items-center gap-2 mb-2 px-1">
                <span className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                <span className="text-xs font-bold text-gray-700">{stage.label}</span>
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-medium">{stage.leads.length}</span>
                {stage.value > 0 && <span className="text-[9px] text-gray-400 ml-auto">{INR(stage.value)}</span>}
              </div>
              <div className="space-y-2 min-h-[200px]">
                {stage.leads.slice(0, 10).map(lead => (
                  <div key={lead.id} onClick={() => setSelectedLead(lead)}
                    className="bg-white rounded-xl border border-gray-100 p-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-800 truncate">{lead.first_name} {lead.last_name || ''}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityBadge(lead.priority)} text-[8px]`}>{lead.priority}</span>
                    </div>
                    <div className="text-[10px] text-gray-400">{lead.phone}</div>
                    {lead.interested_department && <div className="text-[10px] text-teal-600 font-medium mt-0.5">{lead.interested_department}</div>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-gray-300">{timeAgo(lead.created_at)} ago</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={e => { e.stopPropagation(); handleCall(lead.phone, lead.id); }} className="p-1 bg-green-50 rounded text-green-600 hover:bg-green-100 cursor-pointer"><Phone size={10} /></button>
                        <button onClick={e => { e.stopPropagation(); window.open(`https://wa.me/91${lead.phone.replace(/[^0-9]/g, '').slice(-10)}`, '_blank'); }} className="p-1 bg-emerald-50 rounded text-emerald-600 hover:bg-emerald-100 cursor-pointer"><MessageCircle size={10} /></button>
                      </div>
                    </div>
                  </div>
                ))}
                {stage.leads.length === 0 && <div className="text-center py-8 text-gray-300 text-[10px]">No leads</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ═══ ALL LEADS ═══ */}
      {tab === 'leads' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-50 flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={leadFilter.search} onChange={e => { setLeadFilter(f => ({ ...f, search: e.target.value })); leads.load({ ...leadFilter, search: e.target.value }); }}
                className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500/20" placeholder="Search name, phone..." />
            </div>
            {['all', 'new', 'contacted', 'qualified', 'appointment_booked', 'converted', 'lost'].map(s => (
              <button key={s} onClick={() => { setLeadFilter(f => ({ ...f, status: s })); leads.load({ ...leadFilter, status: s }); }}
                className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg ${leadFilter.status === s ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'} cursor-pointer`}>
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
          <table className="w-full text-xs">
            <thead><tr><th>Lead</th><th>Phone</th><th>Source</th><th>Interest</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Age</th><th>Actions</th></tr></thead>
            <tbody>
              {leads.leads.map(l => (
                <tr key={l.id} className="cursor-pointer" onClick={() => setSelectedLead(l)}>
                  <td>
                    <div className="font-semibold text-gray-800">{l.first_name} {l.last_name || ''}</div>
                    {l.email && <div className="text-[10px] text-gray-400">{l.email}</div>}
                  </td>
                  <td className="font-mono text-[11px]">{l.phone}</td>
                  <td><span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600">{l.source?.replace('_', ' ')}</span></td>
                  <td className="text-teal-700 font-medium text-[11px]">{l.interested_department || '—'}</td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityBadge(l.priority)}`}>{l.priority}</span></td>
                  <td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PIPELINE_STAGES.find(s => s.key === l.status)?.color || 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'}`}>{l.status?.replace('_', ' ')}</span></td>
                  <td className="text-[11px] text-gray-500">{l.assigned?.full_name?.split(' ').pop() || '—'}</td>
                  <td className="text-[10px] text-gray-400">{timeAgo(l.created_at)}</td>
                  <td>
                    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleCall(l.phone, l.id)} className="p-1.5 bg-green-50 rounded-lg text-green-600 hover:bg-green-100 cursor-pointer" title="Call"><Phone size={12} /></button>
                      <button onClick={() => window.open(`https://wa.me/91${l.phone.replace(/[^0-9]/g, '').slice(-10)}`, '_blank')} className="p-1.5 bg-emerald-50 rounded-lg text-emerald-600 hover:bg-emerald-100 cursor-pointer" title="WhatsApp"><MessageCircle size={12} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.leads.length === 0 && <tr><td colSpan={9} className="text-center py-12 text-gray-400">No leads found</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ FOLLOW-UPS ═══ */}
      {tab === 'followups' && (
        <div className="space-y-3">
          {followUps.followUps.length === 0 ? <div className="text-center py-12 bg-white rounded-2xl border text-gray-400">No pending follow-ups</div> :
          followUps.followUps.map(f => {
            const isOverdue = new Date(f.follow_up_date) < new Date();
            return (
              <div key={f.id} className={`bg-white rounded-xl border p-4 flex items-center gap-4 ${isOverdue ? 'border-red-200 bg-red-50/30' : 'border-gray-100'}`}>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isOverdue ? 'bg-red-100' : 'bg-teal-100'}`}>
                  {f.follow_up_type === 'call' ? <Phone size={16} className={isOverdue ? 'text-red-600' : 'text-teal-600'} /> : <MessageCircle size={16} className={isOverdue ? 'text-red-600' : 'text-teal-600'} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-800">{f.lead?.first_name} {f.lead?.last_name || ''}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityBadge(f.lead?.priority)}`}>{f.lead?.priority}</span>
                    {isOverdue && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700">OVERDUE</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{f.lead?.phone} · {f.lead?.interested_department || 'General'} · {f.subject || f.description?.slice(0, 60) || 'Follow-up'}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">Due: {new Date(f.follow_up_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button onClick={() => handleCall(f.lead?.phone, f.lead_id)} className="px-3 py-2 bg-emerald-600 text-white text-xs rounded-xl font-medium hover:bg-emerald-700 cursor-pointer"><Phone size={12} className="inline mr-1" />Call</button>
                  <button onClick={() => followUps.markDone(f.id)} className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-xl font-medium hover:bg-gray-200 cursor-pointer">Done</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ CAMPAIGNS ═══ */}
      {tab === 'campaigns' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {campaigns.campaigns.length === 0 ? <div className="col-span-3 text-center py-12 bg-white rounded-2xl border text-gray-400">No campaigns yet</div> :
            campaigns.campaigns.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${c.status === 'active' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700' : c.status === 'completed' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'}`}>{c.status}</span>
                  <span className="text-[10px] text-gray-400">{c.type?.replace('_', ' ')}</span>
                </div>
                <h3 className="font-bold text-sm text-gray-800">{c.name}</h3>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div><div className="text-[9px] text-gray-400">Leads</div><div className="font-bold text-teal-700">{c.leads_generated}</div></div>
                  <div><div className="text-[9px] text-gray-400">Appts</div><div className="font-bold text-amber-700">{c.appointments_booked}</div></div>
                  <div><div className="text-[9px] text-gray-400">Revenue</div><div className="font-bold text-emerald-700">{INR(c.revenue_generated || 0)}</div></div>
                </div>
                {c.budget > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1"><span>Budget</span><span>{INR(c.spent || 0)} / {INR(c.budget)}</span></div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden"><div className="h-full bg-teal-500 rounded-full" style={{ width: `${c.budget > 0 ? Math.min(100, (c.spent || 0) / c.budget * 100) : 0}%` }} /></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ ANALYTICS ═══ */}
      {tab === 'analytics' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Leads by Source</h3>
            {sourceData.length === 0 ? <div className="text-center py-8 text-gray-300 text-xs">No data</div> :
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sourceData} layout="vertical" margin={{ left: 0, right: 5 }}>
                <XAxis type="number" tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fill: '#64748b' }} width={80} axisLine={false} tickLine={false} />
                <Bar dataKey="value" fill={C.teal} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>}
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">Leads by Department</h3>
            {deptData.length === 0 ? <div className="text-center py-8 text-gray-300 text-xs">No data</div> :
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart><Pie data={deptData} dataKey="value" cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={3} strokeWidth={0}>
                  {deptData.map((_: any, i: number) => <Cell key={i} fill={[C.teal, C.blue, C.green, C.amber, C.purple, C.red][i % 6]} />)}
                </Pie></PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">{deptData.map((d: any, i: number) => (
                <div key={d.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: [C.teal, C.blue, C.green, C.amber, C.purple, C.red][i % 6] }} /><span className="text-xs text-gray-600">{d.name}</span></div>
                  <span className="text-xs font-bold">{d.value}</span>
                </div>
              ))}</div>
            </div>}
          </div>
          {/* Conversion funnel */}
          <div className="col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="text-sm font-bold text-gray-800 mb-4">Conversion Funnel</h3>
            <div className="flex items-center gap-2">
              {PIPELINE_STAGES.map((stage, i) => {
                const count = leads.leads.filter(l => l.status === stage.key).length;
                const maxCount = leads.stats.total || 1;
                const pctW = Math.max(8, (count / maxCount) * 100);
                return (
                  <React.Fragment key={stage.key}>
                    <div className="flex-1 text-center">
                      <div className={`${stage.color} rounded-xl py-3 transition-all`} style={{ opacity: 0.7 + (count / maxCount) * 0.3 }}>
                        <div className="text-lg font-bold">{count}</div>
                        <div className="text-[9px] font-medium mt-0.5">{stage.label}</div>
                      </div>
                    </div>
                    {i < PIPELINE_STAGES.length - 1 && <ChevronRight size={14} className="text-gray-300 shrink-0" />}
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══ NEW LEAD MODAL ═══ */}
      {showNewLead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowNewLead(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-bold">New Lead</h2><button onClick={() => setShowNewLead(false)}><X size={18} className="text-gray-400" /></button></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">First Name *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" value={newLead.first_name} onChange={e => setNewLead(f => ({ ...f, first_name: e.target.value }))} /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Last Name</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20" value={newLead.last_name} onChange={e => setNewLead(f => ({ ...f, last_name: e.target.value }))} /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Phone *</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20" value={newLead.phone} onChange={e => setNewLead(f => ({ ...f, phone: e.target.value }))} placeholder="+91..." /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Email</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm focus:ring-2 focus:ring-teal-500/20" value={newLead.email} onChange={e => setNewLead(f => ({ ...f, email: e.target.value }))} /></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Source</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={newLead.source} onChange={e => setNewLead(f => ({ ...f, source: e.target.value }))}>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Department</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={newLead.interested_department} onChange={e => setNewLead(f => ({ ...f, interested_department: e.target.value }))}>
                  <option value="">Select</option>
                  {['Cardiology', 'Orthopaedics', 'Neurology', 'Neurosurgery', 'Gastroenterology', 'Urology', 'Nephrology', 'Oncology', 'General Surgery', 'CTVS', 'Gynaecology', 'Paediatrics', 'ENT', 'Ophthalmology', 'Dermatology', 'General Medicine'].map(d => <option key={d} value={d}>{d}</option>)}
                </select></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Priority</label>
                <div className="flex gap-1 mt-1">{['hot', 'warm', 'medium', 'cold'].map(p => (
                  <button key={p} onClick={() => setNewLead(f => ({ ...f, priority: p }))}
                    className={`flex-1 py-2 rounded-lg text-[10px] font-semibold capitalize ${newLead.priority === p ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-500'} cursor-pointer`}>{p}</button>
                ))}</div></div>
              <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Procedure</label><input className="w-full mt-1 px-3 py-2 border rounded-xl text-sm" value={newLead.interested_procedure} onChange={e => setNewLead(f => ({ ...f, interested_procedure: e.target.value }))} placeholder="e.g. TKR, PTCA" /></div>
            </div>
            <div><label className="text-[10px] font-semibold text-gray-500 uppercase">Notes</label><textarea className="w-full mt-1 px-3 py-2 border rounded-xl text-sm h-16 resize-none" value={newLead.notes} onChange={e => setNewLead(f => ({ ...f, notes: e.target.value }))} /></div>
            <button onClick={handleCreateLead} disabled={!newLead.first_name || !newLead.phone}
              className="w-full py-2.5 bg-teal-600 text-white text-sm rounded-xl font-semibold disabled:opacity-40 hover:bg-teal-700 transition-colors cursor-pointer">Create Lead</button>
          </div>
        </div>
      )}

      {/* ═══ LEAD DETAIL DRAWER ═══ */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={() => setSelectedLead(null)}>
          <div className="w-[480px] bg-white h-full overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <LeadDetail lead={selectedLead} centreId={centreId} staffId={staffId} doctors={doctors}
              onCall={handleCall} onUpdate={leads.update} onConvert={leads.convert}
              onClose={() => setSelectedLead(null)} onFlash={flash} />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// LEAD DETAIL PANEL
// ============================================================
function LeadDetail({ lead, centreId, staffId, doctors, onCall, onUpdate, onConvert, onClose, onFlash }: any) {
  const activities = useActivities(lead.id);
  const [noteText, setNoteText] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpType, setFollowUpType] = useState('call');

  const addNote = async () => {
    if (!noteText) return;
    await activities.add({ centre_id: centreId, activity_type: 'note', description: noteText, follow_up_date: followUpDate || null, follow_up_type: followUpDate ? followUpType : null }, staffId);
    onFlash('Note added');
    setNoteText(''); setFollowUpDate('');
  };

  const logCall = async (disposition: string) => {
    await activities.add({ centre_id: centreId, activity_type: 'call', direction: 'outbound', call_disposition: disposition, description: `Outbound call — ${disposition}` }, staffId);
    if (lead.status === 'new') await onUpdate(lead.id, { status: 'contacted' });
    onFlash(`Call logged: ${disposition}`);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-5 border-b border-gray-100 shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xs cursor-pointer">← Back</button>
          {lead.leadsquared_id && <a href={`https://app.leadsquared.com/Leads/${lead.leadsquared_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px] text-teal-600"><ExternalLink size={10} />LeadSquared</a>}
        </div>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-teal-700">{lead.first_name?.[0]}{lead.last_name?.[0] || ''}</span>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{lead.first_name} {lead.last_name || ''}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PIPELINE_STAGES.find((s: any) => s.key === lead.status)?.color || ''}`}>{lead.status?.replace('_', ' ')}</span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${lead.priority === 'hot' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700' : lead.priority === 'warm' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600'}`}>{lead.priority}</span>
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <div className="flex gap-2 mt-3">
          <button onClick={() => onCall(lead.phone, lead.id)} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white text-xs rounded-xl font-semibold hover:bg-emerald-700 cursor-pointer"><Phone size={13} /> Call</button>
          <button onClick={() => window.open(`https://wa.me/91${lead.phone.replace(/[^0-9]/g, '').slice(-10)}`, '_blank')} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white text-xs rounded-xl font-semibold hover:bg-emerald-700 cursor-pointer"><MessageCircle size={13} /> WhatsApp</button>
          <button onClick={() => window.open(`mailto:${lead.email}`, '_blank')} disabled={!lead.email} className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-teal-600 text-white text-xs rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-40 cursor-pointer"><Mail size={13} /> Email</button>
        </div>
      </div>

      {/* Details */}
      <div className="p-5 border-b border-gray-100 shrink-0 grid grid-cols-2 gap-3 text-xs">
        <div><span className="text-gray-400">Phone</span><div className="font-mono font-medium">{lead.phone}</div></div>
        <div><span className="text-gray-400">Source</span><div className="capitalize">{lead.source?.replace('_', ' ')}</div></div>
        <div><span className="text-gray-400">Department</span><div className="text-teal-700 font-medium">{lead.interested_department || '—'}</div></div>
        <div><span className="text-gray-400">Procedure</span><div>{lead.interested_procedure || '—'}</div></div>
        <div><span className="text-gray-400">Est. Value</span><div className="font-bold">{lead.estimated_value > 0 ? `₹${fmt(lead.estimated_value)}` : '—'}</div></div>
        <div><span className="text-gray-400">Created</span><div>{new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div></div>
      </div>

      {/* Status change */}
      <div className="px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Move to</div>
        <div className="flex gap-1 flex-wrap">
          {PIPELINE_STAGES.map(s => (
            <button key={s.key} onClick={() => { onUpdate(lead.id, { status: s.key }); onFlash(`Moved to ${s.label}`); }}
              disabled={lead.status === s.key}
              className={`px-2.5 py-1.5 text-[10px] font-medium rounded-lg transition-colors ${lead.status === s.key ? 'bg-teal-600 text-white' : `${s.color} hover:ring-1 hover:ring-gray-200`}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Call disposition quick log */}
      <div className="px-5 py-3 border-b border-gray-100 shrink-0">
        <div className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Log Call Result</div>
        <div className="flex gap-1">
          {['answered', 'no_answer', 'busy', 'voicemail', 'wrong_number'].map(d => (
            <button key={d} onClick={() => logCall(d)} className="px-2.5 py-1.5 text-[10px] font-medium rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100 capitalize cursor-pointer">{d.replace('_', ' ')}</button>
          ))}
        </div>
      </div>

      {/* Add note + follow-up */}
      <div className="px-5 py-3 border-b border-gray-100 shrink-0 space-y-2">
        <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
          className="w-full px-3 py-2 border rounded-xl text-xs h-16 resize-none focus:ring-2 focus:ring-teal-500/20" placeholder="Add note..." />
        <div className="flex gap-2 items-center">
          <input type="datetime-local" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)}
            className="flex-1 px-2 py-1.5 border rounded-lg text-[10px]" />
          <select value={followUpType} onChange={e => setFollowUpType(e.target.value)} className="px-2 py-1.5 border rounded-lg text-[10px]">
            <option value="call">Call</option><option value="whatsapp">WhatsApp</option><option value="visit">Visit</option>
          </select>
          <button onClick={addNote} disabled={!noteText} className="px-3 py-1.5 bg-teal-600 text-white text-[10px] rounded-lg font-semibold disabled:opacity-40 cursor-pointer">Add</button>
        </div>
      </div>

      {/* Activity timeline */}
      <div className="flex-1 overflow-y-auto px-5 py-3 scrollbar-thin">
        <div className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Activity ({activities.activities.length})</div>
        <div className="space-y-3">
          {activities.activities.map((a: any) => (
            <div key={a.id} className="flex gap-3">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${a.activity_type === 'call' ? 'bg-green-100' : a.activity_type === 'whatsapp' ? 'bg-emerald-100' : a.activity_type === 'email' ? 'bg-blue-100' : 'bg-gray-100'}`}>
                {a.activity_type === 'call' ? <Phone size={11} className="text-green-600" /> : a.activity_type === 'whatsapp' ? <MessageCircle size={11} className="text-emerald-600" /> : <Star size={11} className="text-gray-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-gray-800 capitalize">{a.activity_type.replace('_', ' ')}</span>
                  {a.call_disposition && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-600 text-[8px]">{a.call_disposition.replace('_', ' ')}</span>}
                  <span className="text-[9px] text-gray-400 ml-auto">{timeAgo(a.performed_at)}</span>
                </div>
                {a.description && <div className="text-[11px] text-gray-600 mt-0.5">{a.description}</div>}
                {a.performer?.full_name && <div className="text-[9px] text-gray-400 mt-0.5">by {a.performer.full_name}</div>}
              </div>
            </div>
          ))}
          {activities.activities.length === 0 && <div className="text-center py-6 text-gray-300 text-xs">No activity yet</div>}
        </div>
      </div>
    </div>
  );
}

export default function CRMPage() { return <RoleGuard module="billing"><CRMInner /></RoleGuard>; }
