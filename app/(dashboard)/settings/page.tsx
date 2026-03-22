'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { sb } from '@/lib/supabase/browser';
import HospitalSetup from '@/components/settings/hospital-setup';
import IntegrationsConfig from '@/components/settings/integrations-config';
import NotificationsConfig from '@/components/settings/notifications-config';
import BillingConfig from '@/components/settings/billing-config';
import DepartmentsConfig from '@/components/settings/departments-config';
import CostCentresConfig from '@/components/settings/cost-centres-config';

type Tab = 'hospital' | 'integrations' | 'notifications' | 'billing' | 'departments' | 'cost_centres' | 'staff' | 'wards' | 'tariffs' | 'auto_charges' | 'reports' | 'roles' | 'system';

const EVENT_LABELS: Record<string, string> = {
  appointment_reminder: 'Appointment Reminder', lab_ready: 'Lab Results Ready',
  pharmacy_ready: 'Pharmacy Ready', discharge_summary: 'Discharge Summary',
  opd_token: 'OPD Token', payment_receipt: 'Payment Receipt', follow_up_reminder: 'Follow-up Reminder',
};

function SettingsInner() {
  const { staff: currentStaff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [tab, setTab] = useState<Tab>('hospital');
  const [toast, setToast] = useState('');
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // Data for existing tabs
  const [staffList, setStaffList] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [autoRules, setAutoRules] = useState<any[]>([]);
  const [reportSubs, setReportSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubType, setNewSubType] = useState('daily_summary');
  const [newSubFreq, setNewSubFreq] = useState('daily');

  const loadLegacy = useCallback(async () => {
    if (!sb()) return;
    setLoading(true);
    const needsLegacy = ['staff', 'wards', 'tariffs', 'auto_charges', 'reports'].includes(tab);
    if (!needsLegacy) { setLoading(false); return; }
    const [s, w, t, ar, rs] = await Promise.all([
      tab === 'staff' ? sb().from('hmis_staff').select('id, full_name, staff_type, designation, specialisation, phone, email, is_active, department:hmis_departments(name)').order('full_name') : { data: [] },
      tab === 'wards' ? sb().from('hmis_wards').select('*, centre:hmis_centres(name)').order('name') : { data: [] },
      tab === 'tariffs' && centreId ? sb().from('hmis_tariff_master').select('*').eq('centre_id', centreId).eq('is_active', true).order('category, service_name') : { data: [] },
      tab === 'auto_charges' && centreId ? sb().from('hmis_billing_auto_rules').select('*').eq('centre_id', centreId).order('trigger_type, ward_type') : { data: [] },
      tab === 'reports' && centreId ? sb().from('hmis_report_subscriptions').select('*').eq('centre_id', centreId).order('created_at', { ascending: false }) : { data: [] },
    ]);
    setStaffList(s.data || []); setWards(w.data || []); setTariffs(t.data || []);
    setAutoRules(ar.data || []); setReportSubs(rs.data || []);
    setLoading(false);
  }, [tab, centreId]);

  useEffect(() => { loadLegacy(); }, [loadLegacy]);

  const toggleStaffActive = async (id: string, isActive: boolean) => {
    await sb().from('hmis_staff').update({ is_active: isActive }).eq('id', id);
    flash(`Staff ${isActive ? 'activated' : 'deactivated'}`); loadLegacy();
  };

  const updateTariffRate = async (id: string, field: string, value: number) => {
    await sb().from('hmis_tariff_master').update({ [field]: value }).eq('id', id);
    flash('Rate updated');
  };

  const toggleAutoRule = async (id: string, isActive: boolean) => {
    await sb().from('hmis_billing_auto_rules').update({ is_active: isActive }).eq('id', id);
    flash(`Rule ${isActive ? 'enabled' : 'disabled'}`); loadLegacy();
  };

  const updateAutoRuleAmount = async (id: string, amount: number) => {
    await sb().from('hmis_billing_auto_rules').update({ charge_amount: amount }).eq('id', id);
    flash('Amount updated');
  };

  const addReportSub = async () => {
    if (!newSubEmail || !newSubEmail.includes('@')) { flash('Enter a valid email'); return; }
    if (!centreId) return;
    await sb().from('hmis_report_subscriptions').insert({
      centre_id: centreId, email: newSubEmail, report_type: newSubType,
      frequency: newSubFreq, is_active: true,
    });
    setNewSubEmail('');
    flash('Subscription added'); loadLegacy();
  };

  const toggleReportSub = async (id: string, isActive: boolean) => {
    await sb().from('hmis_report_subscriptions').update({ is_active: isActive }).eq('id', id);
    setReportSubs(prev => prev.map(s => s.id === id ? { ...s, is_active: isActive } : s));
    flash(`Subscription ${isActive ? 'activated' : 'paused'}`);
  };

  const deleteReportSub = async (id: string) => {
    await sb().from('hmis_report_subscriptions').delete().eq('id', id);
    setReportSubs(prev => prev.filter(s => s.id !== id));
    flash('Subscription removed');
  };

  const filtered = (list: any[]) =>
    search ? list.filter(i => JSON.stringify(i).toLowerCase().includes(search.toLowerCase())) : list;

  const tabs: [Tab, string][] = [
    ['hospital', 'Hospital Setup'], ['integrations', 'Integrations'], ['notifications', 'Notifications'],
    ['billing', 'Billing Config'], ['departments', 'Departments'], ['cost_centres', 'Cost Centres'],
    ['staff', 'Staff'], ['wards', 'Wards & Rooms'], ['tariffs', 'Tariff Master'],
    ['auto_charges', 'Auto-Charge'], ['reports', 'Report Emails'], ['roles', 'Roles'], ['system', 'System'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Settings & Configuration</h1><p className="text-xs text-gray-500">System-wide configuration</p></div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs w-56" placeholder="Search..." />
      </div>

      <div className="flex gap-1 border-b overflow-x-auto">{tabs.map(([k, l]) =>
        <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px whitespace-nowrap ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{l}</button>
      )}</div>

      {/* NEW TAB 1 — HOSPITAL SETUP */}
      {tab === 'hospital' && <HospitalSetup centreId={centreId} flash={flash} />}

      {/* NEW TAB 2 — INTEGRATIONS */}
      {tab === 'integrations' && <IntegrationsConfig centreId={centreId} flash={flash} />}

      {/* NEW TAB 3 — NOTIFICATIONS */}
      {tab === 'notifications' && <NotificationsConfig centreId={centreId} flash={flash} />}

      {/* NEW TAB 4 — BILLING CONFIG */}
      {tab === 'billing' && <BillingConfig centreId={centreId} flash={flash} />}

      {/* NEW TAB 5 — DEPARTMENTS */}
      {tab === 'departments' && <DepartmentsConfig centreId={centreId} flash={flash} />}

      {/* COST CENTRES */}
      {tab === 'cost_centres' && <CostCentresConfig centreId={centreId} flash={flash} />}

      {/* STAFF */}
      {tab === 'staff' && <div className="space-y-2">
        {loading ? <div className="text-xs text-gray-400 p-4">Loading...</div> : <>
        <div className="text-xs text-gray-500">{staffList.length} staff members ({staffList.filter(s => s.is_active).length} active)</div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Name</th><th className="p-2">Type</th><th className="p-2">Designation</th><th className="p-2">Department</th><th className="p-2">Phone</th><th className="p-2">Active</th>
          </tr></thead><tbody>{filtered(staffList).slice(0, 100).map(s => (
            <tr key={s.id} className={`border-b ${!s.is_active ? 'opacity-40' : ''}`}>
              <td className="p-2 font-medium">{s.full_name}{s.specialisation ? <div className="text-[10px] text-gray-400">{s.specialisation}</div> : null}</td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${s.staff_type === 'doctor' ? 'bg-blue-100 text-blue-700' : s.staff_type === 'nurse' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100'}`}>{s.staff_type}</span></td>
              <td className="p-2 text-center text-gray-500">{s.designation || '—'}</td>
              <td className="p-2 text-center text-gray-500">{s.department?.name || '—'}</td>
              <td className="p-2 text-center text-gray-400">{s.phone || '—'}</td>
              <td className="p-2 text-center"><button onClick={() => toggleStaffActive(s.id, !s.is_active)} className={`w-8 h-4 rounded-full relative ${s.is_active ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${s.is_active ? 'right-0.5' : 'left-0.5'}`} /></button></td>
            </tr>
          ))}</tbody></table>
        </div>
        </>}
      </div>}

      {/* WARDS */}
      {tab === 'wards' && <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? <div className="text-xs text-gray-400 p-4">Loading...</div> :
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Ward</th><th className="p-2">Type</th><th className="p-2">Floor</th><th className="p-2">Centre</th><th className="p-2">Active</th>
        </tr></thead><tbody>{filtered(wards).map(w => (
          <tr key={w.id} className="border-b"><td className="p-2 font-medium">{w.name}</td>
            <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${w.type === 'icu' ? 'bg-red-100 text-red-700' : w.type === 'private' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}>{w.type?.replace('_', ' ')}</span></td>
            <td className="p-2 text-center">{w.floor || '—'}</td>
            <td className="p-2 text-center text-gray-400">{w.centre?.name || '—'}</td>
            <td className="p-2 text-center"><span className={`text-[9px] ${w.is_active ? 'text-green-600' : 'text-red-500'}`}>{w.is_active ? '✓' : '✗'}</span></td></tr>
        ))}</tbody></table>}
      </div>}

      {/* TARIFFS */}
      {tab === 'tariffs' && <div className="space-y-2">
        {loading ? <div className="text-xs text-gray-400 p-4">Loading...</div> : <>
        <div className="text-xs text-gray-500">{tariffs.length} tariffs</div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Code</th><th className="p-2 text-left">Service</th><th className="p-2">Category</th>
            <th className="p-2 text-right">Cost</th><th className="p-2 text-right">Self</th><th className="p-2 text-right">Insurance</th><th className="p-2 text-right">PMJAY</th><th className="p-2 text-right">CGHS</th>
          </tr></thead><tbody>{filtered(tariffs).slice(0, 100).map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-mono text-[10px]">{t.service_code}</td>
              <td className="p-2 font-medium">{t.service_name}</td>
              <td className="p-2 text-center text-gray-500">{t.category?.replace('_', ' ')}</td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.cost_price || 0} onBlur={e => updateTariffRate(t.id, 'cost_price', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px] bg-orange-50" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_self} onBlur={e => updateTariffRate(t.id, 'rate_self', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_insurance} onBlur={e => updateTariffRate(t.id, 'rate_insurance', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_pmjay} onBlur={e => updateTariffRate(t.id, 'rate_pmjay', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_cghs} onBlur={e => updateTariffRate(t.id, 'rate_cghs', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
            </tr>
          ))}</tbody></table>
        </div>
        </>}
      </div>}

      {/* AUTO-CHARGE RULES */}
      {tab === 'auto_charges' && <div className="space-y-2">
        {loading ? <div className="text-xs text-gray-400 p-4">Loading...</div> : <>
        <div className="text-xs text-gray-500">{autoRules.length} rules — edit amounts and toggle active/inactive</div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Rule</th><th className="p-2">Trigger</th><th className="p-2">Ward</th><th className="p-2 text-right">Amount</th><th className="p-2 text-center">Active</th>
          </tr></thead><tbody>{autoRules.map(r => (
            <tr key={r.id} className={`border-b ${!r.is_active ? 'opacity-40' : ''}`}>
              <td className="p-2 font-medium">{r.charge_description}</td>
              <td className="p-2 text-center">{r.trigger_type}</td>
              <td className="p-2 text-center">{r.ward_type?.replace('_', ' ') || 'All'}</td>
              <td className="p-2 text-right"><input type="number" defaultValue={r.charge_amount} onBlur={e => updateAutoRuleAmount(r.id, parseFloat(e.target.value))} className="w-24 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-center"><button onClick={() => toggleAutoRule(r.id, !r.is_active)} className={`w-8 h-4 rounded-full relative ${r.is_active ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${r.is_active ? 'right-0.5' : 'left-0.5'}`} /></button></td>
            </tr>
          ))}</tbody></table>
        </div>
        </>}
      </div>}

      {/* REPORT SUBSCRIPTIONS */}
      {tab === 'reports' && <div className="space-y-4">
        {!centreId ? <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre to manage report subscriptions.</div> : loading ? <div className="text-xs text-gray-400 p-4">Loading...</div> : <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-bold text-sm">Automated Report Email Subscriptions</h3>
              <p className="text-[10px] text-gray-500">Daily summary emails sent at 8:00 AM IST via Vercel Cron + Resend</p>
            </div>
            <div className="px-4 py-3 border-b bg-gray-50/50 flex items-end gap-2">
              <div className="flex-1"><label className="text-[10px] text-gray-500">Email</label>
                <input type="email" value={newSubEmail} onChange={e => setNewSubEmail(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs" placeholder="admin@hospital.com" /></div>
              <div><label className="text-[10px] text-gray-500">Report</label>
                <select value={newSubType} onChange={e => setNewSubType(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs">
                  <option value="daily_summary">Daily Summary</option><option value="revenue">Revenue</option><option value="occupancy">Occupancy</option><option value="lab_tat">Lab TAT</option><option value="pharmacy">Pharmacy</option>
                </select></div>
              <div><label className="text-[10px] text-gray-500">Frequency</label>
                <select value={newSubFreq} onChange={e => setNewSubFreq(e.target.value)} className="w-full px-2 py-1.5 border rounded text-xs">
                  <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option>
                </select></div>
              <button onClick={addReportSub} className="px-3 py-1.5 bg-teal-600 text-white text-xs rounded font-medium whitespace-nowrap">+ Add</button>
            </div>
            <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
              <th className="p-2 text-left">Email</th><th className="p-2">Report</th><th className="p-2">Frequency</th><th className="p-2">Last Sent</th><th className="p-2 text-center">Active</th><th className="p-2"></th>
            </tr></thead><tbody>{reportSubs.map(s => (
              <tr key={s.id} className={`border-b ${!s.is_active ? 'opacity-40' : ''}`}>
                <td className="p-2 font-medium">{s.email}</td>
                <td className="p-2 text-center"><span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-700 text-[9px]">{s.report_type?.replace(/_/g, ' ')}</span></td>
                <td className="p-2 text-center">{s.frequency}</td>
                <td className="p-2 text-center text-gray-400">{s.last_sent_at ? new Date(s.last_sent_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : 'Never'}</td>
                <td className="p-2 text-center"><button onClick={() => toggleReportSub(s.id, !s.is_active)} className={`w-8 h-4 rounded-full relative ${s.is_active ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${s.is_active ? 'right-0.5' : 'left-0.5'}`} /></button></td>
                <td className="p-2"><button onClick={() => deleteReportSub(s.id)} className="text-red-500 text-[10px] hover:text-red-700">Remove</button></td>
              </tr>
            ))}</tbody></table>
            {reportSubs.length === 0 && <div className="p-6 text-center text-xs text-gray-400">No report subscriptions. Add one above.</div>}
          </div>
        </>}
      </div>}

      {/* ROLES */}
      {tab === 'roles' && <div className="bg-white rounded-xl border p-6 text-center">
        <h3 className="font-bold text-sm mb-2">Staff & Access Management</h3>
        <p className="text-xs text-gray-500 mb-4">Create users, assign roles, edit permissions with the checkbox matrix editor.</p>
        <a href="/staff" className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg inline-block">Open Staff & Access</a>
      </div>}

      {/* SYSTEM */}
      {tab === 'system' && <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-sm mb-2">System Information</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2"><b>Version:</b> HMIS v2.0</div>
            <div className="bg-gray-50 rounded p-2"><b>Stack:</b> Next.js 14 + Supabase + Vercel</div>
            <div className="bg-gray-50 rounded p-2"><b>Database:</b> PostgreSQL 17 (Supabase)</div>
            <div className="bg-gray-50 rounded p-2"><b>HFR ID:</b> Configure in Hospital Setup</div>
            <div className="bg-gray-50 rounded p-2"><b>PACS:</b> Configure in Integrations</div>
            <div className="bg-gray-50 rounded p-2"><b>Lab Instruments:</b> Configure in Integrations</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-sm mb-2">Integrations Overview</h3>
          <p className="text-xs text-gray-500 mb-3">For detailed config, use the Integrations tab above.</p>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { name: 'NHCX Insurance', status: 'Configurable', color: 'text-blue-600' },
              { name: 'PACS / RIS', status: 'Webhook ready', color: 'text-blue-600' },
              { name: 'Lab Instruments', status: 'HL7/TCP bridge ready', color: 'text-blue-600' },
              { name: 'Purchase (VPMS)', status: 'Cross-DB bridge ready', color: 'text-blue-600' },
              { name: 'WhatsApp / SMS', status: 'Template ready', color: 'text-blue-600' },
              { name: 'Tally (Accounting)', status: 'Routes built', color: 'text-blue-600' },
            ].map(i => (
              <div key={i.name} className="flex justify-between border rounded-lg px-3 py-2">
                <span>{i.name}</span><span className={`font-medium ${i.color}`}>{i.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>}
    </div>
  );
}

export default function SettingsPage() { return <RoleGuard module="settings"><SettingsInner /></RoleGuard>; }
