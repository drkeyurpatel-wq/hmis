'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'centres' | 'staff' | 'departments' | 'wards' | 'tariffs' | 'auto_charges' | 'notifications' | 'roles' | 'system';

const EVENT_LABELS: Record<string, string> = {
  appointment_reminder: 'Appointment Reminder',
  lab_ready: 'Lab Results Ready',
  pharmacy_ready: 'Pharmacy Ready',
  discharge_summary: 'Discharge Summary',
  opd_token: 'OPD Token',
  payment_receipt: 'Payment Receipt',
  follow_up_reminder: 'Follow-up Reminder',
};

function SettingsInner() {
  const { staff: currentStaff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [tab, setTab] = useState<Tab>('centres');
  const [toast, setToast] = useState('');
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  // Data
  const [centres, setCentres] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [autoRules, setAutoRules] = useState<any[]>([]);
  const [notifPrefs, setNotifPrefs] = useState<any[]>([]);
  const [notifLogs, setNotifLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [testPhone, setTestPhone] = useState('');
  const [testSending, setTestSending] = useState('');

  // Forms
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    if (!sb()) return;
    setLoading(true);
    const [c, s, d, w, t, ar] = await Promise.all([
      sb().from('hmis_centres').select('*').order('name'),
      sb().from('hmis_staff').select('id, full_name, staff_type, designation, specialisation, phone, email, is_active, department:hmis_departments(name)').order('full_name'),
      sb().from('hmis_departments').select('*').eq('is_active', true).order('name'),
      sb().from('hmis_wards').select('*, centre:hmis_centres(name)').order('name'),
      centreId ? sb().from('hmis_tariff_master').select('*').eq('centre_id', centreId).eq('is_active', true).order('category, service_name') : { data: [] },
      centreId ? sb().from('hmis_billing_auto_rules').select('*').eq('centre_id', centreId).order('trigger_type, ward_type') : { data: [] },
    ]);
    const [np, nl] = await Promise.all([
      centreId ? sb().from('hmis_notification_preferences').select('*').eq('centre_id', centreId).eq('channel', 'whatsapp').order('event_type') : { data: [] },
      centreId ? sb().from('hmis_notification_log').select('*').eq('centre_id', centreId).order('created_at', { ascending: false }).limit(20) : { data: [] },
    ]);
    setCentres(c.data || []); setStaffList(s.data || []); setDepartments(d.data || []);
    setWards(w.data || []); setTariffs(t.data || []); setAutoRules(ar.data || []);
    setNotifPrefs(np.data || []); setNotifLogs(nl.data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const toggleStaffActive = async (id: string, isActive: boolean) => {
    await sb().from('hmis_staff').update({ is_active: isActive }).eq('id', id);
    flash(`Staff ${isActive ? 'activated' : 'deactivated'}`); load();
  };

  const updateTariffRate = async (id: string, field: string, value: number) => {
    await sb().from('hmis_tariff_master').update({ [field]: value }).eq('id', id);
    flash('Rate updated');
  };

  const toggleAutoRule = async (id: string, isActive: boolean) => {
    await sb().from('hmis_billing_auto_rules').update({ is_active: isActive }).eq('id', id);
    flash(`Rule ${isActive ? 'enabled' : 'disabled'}`); load();
  };

  const updateAutoRuleAmount = async (id: string, amount: number) => {
    await sb().from('hmis_billing_auto_rules').update({ charge_amount: amount }).eq('id', id);
    flash('Amount updated');
  };

  const toggleNotifPref = async (id: string, isEnabled: boolean) => {
    await sb().from('hmis_notification_preferences').update({ is_enabled: isEnabled }).eq('id', id);
    setNotifPrefs(prev => prev.map(p => p.id === id ? { ...p, is_enabled: isEnabled } : p));
    flash(`Notification ${isEnabled ? 'enabled' : 'disabled'}`);
  };

  const updateTemplate = async (id: string, text: string) => {
    await sb().from('hmis_notification_preferences').update({ template_text: text }).eq('id', id);
    flash('Template updated');
  };

  const sendTestNotification = async (eventType: string) => {
    if (!testPhone || testPhone.replace(/[\s\-]/g, '').length < 10) {
      flash('Enter a valid phone number first'); return;
    }
    setTestSending(eventType);
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: eventType,
          phone: testPhone,
          centre_id: centreId,
          data: {
            patient_name: 'Test Patient',
            doctor_name: 'Dr. Test',
            date: new Date().toLocaleDateString('en-IN'),
            time: '10:00 AM',
            centre_name: 'Health1 Hospital',
            test_names: 'CBC, LFT',
            collection_point: 'Lab Reception',
            medicine_count: '3',
            pharmacy_counter: 'Counter 1',
            ipd_number: 'IPD-TEST-001',
            discharge_date: new Date().toLocaleDateString('en-IN'),
            follow_up_date: 'In 7 days',
          },
        }),
      });
      const result = await res.json();
      flash(result.success ? 'Test sent!' : (result.skipped ? 'Skipped (disabled)' : `Failed: ${result.error}`));
      load();
    } catch (e: any) {
      flash(`Error: ${e.message}`);
    }
    setTestSending('');
  };

  const filtered = (list: any[], field: string = 'full_name') =>
    search ? list.filter(i => JSON.stringify(i).toLowerCase().includes(search.toLowerCase())) : list;

  const tabs: [Tab, string][] = [
    ['centres', 'Centres'], ['staff', 'Staff'], ['departments', 'Departments'],
    ['wards', 'Wards & Rooms'], ['tariffs', 'Tariff Master'], ['auto_charges', 'Auto-Charge Rules'],
    ['notifications', 'Notifications'], ['roles', 'Roles & Access'], ['system', 'System'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Settings & Configuration</h1><p className="text-xs text-gray-500">System-wide configuration for Health1 HMIS</p></div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs w-56" placeholder="Search..." />
      </div>

      <div className="flex gap-1 border-b">{tabs.map(([k, l]) =>
        <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-xs font-medium rounded-xl ${tab === k ? 'bg-teal-600 text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'}`}>{l}</button>
      )}</div>

      {/* CENTRES */}
      {tab === 'centres' && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Centre</th><th className="p-2">Code</th><th className="p-2">Phone</th><th className="p-2">Beds (Paper/Opr)</th><th className="p-2">Active</th>
        </tr></thead><tbody>{filtered(centres, 'name').map(c => (
          <tr key={c.id} className="border-b"><td className="p-2 font-medium">{c.name}<div className="text-[10px] text-gray-400">{c.address}</div></td>
            <td className="p-2 text-center font-mono">{c.code}</td><td className="p-2 text-center">{c.phone}</td>
            <td className="p-2 text-center">{c.total_beds || '—'}/{c.operational_beds || '—'}</td>
            <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{c.is_active ? 'Active' : 'Inactive'}</span></td></tr>
        ))}</tbody></table>
      </div>}

      {/* STAFF */}
      {tab === 'staff' && <div className="space-y-2">
        <div className="text-xs text-gray-500">{staffList.length} staff members ({staffList.filter(s => s.is_active).length} active)</div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Name</th><th className="p-2">Type</th><th className="p-2">Designation</th><th className="p-2">Department</th><th className="p-2">Phone</th><th className="p-2">Active</th>
          </tr></thead><tbody>{filtered(staffList).slice(0, 100).map(s => (
            <tr key={s.id} className={`border-b ${!s.is_active ? 'opacity-40' : ''}`}>
              <td className="p-2 font-medium">{s.full_name}{s.specialisation ? <div className="text-[10px] text-gray-400">{s.specialisation}</div> : null}</td>
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${s.staff_type === 'doctor' ? 'bg-blue-100 text-teal-700' : s.staff_type === 'nurse' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100'}`}>{s.staff_type}</span></td>
              <td className="p-2 text-center text-gray-500">{s.designation || '—'}</td>
              <td className="p-2 text-center text-gray-500">{s.department?.name || '—'}</td>
              <td className="p-2 text-center text-gray-400">{s.phone || '—'}</td>
              <td className="p-2 text-center"><button onClick={() => toggleStaffActive(s.id, !s.is_active)} className={`w-8 h-4 rounded-full relative ${s.is_active ? 'bg-green-500' : 'bg-gray-300'}`}><div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${s.is_active ? 'right-0.5' : 'left-0.5'}`} /></button></td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>}

      {/* DEPARTMENTS */}
      {tab === 'departments' && <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-2 bg-gray-50 border-b text-xs font-bold text-gray-500">{departments.length} departments</div>
        <div className="grid grid-cols-4 gap-2 p-4">{filtered(departments, 'name').map(d => (
          <div key={d.id} className="border rounded-lg px-3 py-2 text-xs"><span className="font-medium">{d.name}</span><span className="text-[10px] text-gray-400 ml-1">{d.code}</span></div>
        ))}</div>
      </div>}

      {/* WARDS */}
      {tab === 'wards' && <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
          <th className="p-2 text-left">Ward</th><th className="p-2">Type</th><th className="p-2">Floor</th><th className="p-2">Centre</th><th className="p-2">Active</th>
        </tr></thead><tbody>{filtered(wards, 'name').map(w => (
          <tr key={w.id} className="border-b"><td className="p-2 font-medium">{w.name}</td>
            <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${w.type === 'icu' ? 'bg-red-100 text-red-700' : w.type === 'private' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100'}`}>{w.type?.replace('_', ' ')}</span></td>
            <td className="p-2 text-center">{w.floor || '—'}</td>
            <td className="p-2 text-center text-gray-400">{w.centre?.name || '—'}</td>
            <td className="p-2 text-center"><span className={`text-[9px] ${w.is_active ? 'text-green-600' : 'text-red-500'}`}>{w.is_active ? '✓' : '✗'}</span></td></tr>
        ))}</tbody></table>
      </div>}

      {/* TARIFFS */}
      {tab === 'tariffs' && <div className="space-y-2">
        <div className="text-xs text-gray-500">{tariffs.length} tariffs</div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Code</th><th className="p-2 text-left">Service</th><th className="p-2">Category</th>
            <th className="p-2 text-right">Self</th><th className="p-2 text-right">Insurance</th><th className="p-2 text-right">PMJAY</th><th className="p-2 text-right">CGHS</th>
          </tr></thead><tbody>{filtered(tariffs, 'service_name').slice(0, 100).map(t => (
            <tr key={t.id} className="border-b hover:bg-gray-50">
              <td className="p-2 font-mono text-[10px]">{t.service_code}</td>
              <td className="p-2 font-medium">{t.service_name}</td>
              <td className="p-2 text-center text-gray-500">{t.category?.replace('_', ' ')}</td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_self} onBlur={e => updateTariffRate(t.id, 'rate_self', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_insurance} onBlur={e => updateTariffRate(t.id, 'rate_insurance', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_pmjay} onBlur={e => updateTariffRate(t.id, 'rate_pmjay', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
              <td className="p-2 text-right"><input type="number" defaultValue={t.rate_cghs} onBlur={e => updateTariffRate(t.id, 'rate_cghs', parseFloat(e.target.value))} className="w-20 text-right px-1 py-0.5 border rounded text-[10px]" /></td>
            </tr>
          ))}</tbody></table>
        </div>
      </div>}

      {/* AUTO-CHARGE RULES */}
      {tab === 'auto_charges' && <div className="space-y-2">
        <div className="text-xs text-gray-500">{autoRules.length} rules — edit amounts and toggle active/inactive</div>
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Rule</th><th className="p-2">Trigger</th><th className="p-2">Ward</th><th className="p-2 text-right">Amount (₹)</th><th className="p-2 text-center">Active</th>
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
      </div>}

      {/* NOTIFICATIONS */}
      {tab === 'notifications' && <div className="space-y-4">
        {!centreId && <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre to manage notification preferences.</div>}
        {centreId && <>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm">WhatsApp Notification Preferences</h3>
                <p className="text-[10px] text-gray-500">Toggle which events trigger WhatsApp messages for this centre</p>
              </div>
              <div className="flex items-center gap-2">
                <input type="text" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Test phone (e.g. 9876543210)" className="px-2 py-1 border rounded text-xs w-48" />
              </div>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Event</th>
                <th className="p-2 text-left">Template Preview</th>
                <th className="p-2 text-center">Enabled</th>
                <th className="p-2 text-center">Test</th>
              </tr></thead>
              <tbody>{notifPrefs.map(p => (
                <tr key={p.id} className={`border-b ${!p.is_enabled ? 'opacity-50' : ''}`}>
                  <td className="p-2 font-medium">{EVENT_LABELS[p.event_type] || p.event_type}</td>
                  <td className="p-2"><input type="text" defaultValue={p.template_text || ''} onBlur={e => updateTemplate(p.id, e.target.value)} className="w-full px-2 py-1 border rounded text-[10px] text-gray-600" placeholder="Default template" /></td>
                  <td className="p-2 text-center">
                    <button onClick={() => toggleNotifPref(p.id, !p.is_enabled)} className={`w-8 h-4 rounded-full relative ${p.is_enabled ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`w-3 h-3 bg-white rounded-full absolute top-0.5 transition-all ${p.is_enabled ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </td>
                  <td className="p-2 text-center">
                    {['appointment_reminder', 'lab_ready', 'pharmacy_ready', 'discharge_summary'].includes(p.event_type) && (
                      <button
                        onClick={() => sendTestNotification(p.event_type)}
                        disabled={testSending === p.event_type}
                        className="px-2 py-0.5 bg-blue-600 text-white rounded text-[10px] hover:bg-blue-700 disabled:opacity-50"
                      >{testSending === p.event_type ? 'Sending...' : 'Send Test'}</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
            {notifPrefs.length === 0 && <div className="p-6 text-center text-xs text-gray-400">No notification preferences found. Run the SQL migration to seed defaults.</div>}
          </div>

          {notifLogs.length > 0 && <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b">
              <h3 className="font-bold text-sm">Recent Notification Log</h3>
            </div>
            <table className="w-full text-xs">
              <thead><tr className="bg-gray-50 border-b">
                <th className="p-2 text-left">Time</th>
                <th className="p-2">Event</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-left">Error</th>
              </tr></thead>
              <tbody>{notifLogs.map(l => (
                <tr key={l.id} className="border-b">
                  <td className="p-2 text-gray-500">{new Date(l.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="p-2 text-center">{EVENT_LABELS[l.event_type] || l.event_type}</td>
                  <td className="p-2 text-center font-mono">{l.phone ? `...${l.phone.slice(-4)}` : '—'}</td>
                  <td className="p-2 text-center"><span className={`px-1.5 py-0.5 rounded text-[9px] ${l.status === 'sent' ? 'bg-green-100 text-green-700' : l.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{l.status}</span></td>
                  <td className="p-2 text-gray-400 truncate max-w-[200px]">{l.error_message || '—'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>}
        </>}
      </div>}

      {/* ROLES */}
      {tab === 'roles' && <div className="bg-white rounded-xl border p-6 text-center">
        <div className="text-3xl mb-3">👥</div>
        <h3 className="font-bold text-sm mb-2">Staff & Access Management</h3>
        <p className="text-xs text-gray-500 mb-4">Create users, assign roles, edit permissions with the checkbox matrix editor.</p>
        <a href="/staff" className="px-6 py-2.5 bg-teal-600 text-white text-sm rounded-lg inline-block">Open Staff & Access →</a>
      </div>}

      {/* SYSTEM */}
      {tab === 'system' && <div className="space-y-3">
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-sm mb-2">System Information</h3>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-gray-50 rounded p-2"><b>Version:</b> Health1 HMIS v2.0</div>
            <div className="bg-gray-50 rounded p-2"><b>Stack:</b> Next.js 14 + Supabase + Vercel</div>
            <div className="bg-gray-50 rounded p-2"><b>Supabase:</b> bmuupgrzbfmddjwcqlss (Mumbai)</div>
            <div className="bg-gray-50 rounded p-2"><b>HFR ID:</b> IN2410013685</div>
            <div className="bg-gray-50 rounded p-2"><b>PACS:</b> Stradus (Shilaj)</div>
            <div className="bg-gray-50 rounded p-2"><b>Lab Instrument:</b> Mindray BC-5000 (TCP 5100)</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h3 className="font-bold text-sm mb-2">Integrations</h3>
          <div className="grid grid-cols-3 gap-2 text-xs">
            {[
              { name: 'NHCX Insurance', status: 'Sandbox pending', color: 'text-amber-600' },
              { name: 'Stradus PACS', status: 'Webhook configured', color: 'text-green-600' },
              { name: 'Mindray BC-5000', status: 'API endpoint ready', color: 'text-green-600' },
              { name: 'VPMS (Purchase)', status: 'Cross-DB bridge live', color: 'text-green-600' },
              { name: 'WhatsApp Alerts', status: 'Template ready', color: 'text-teal-600' },
              { name: 'Tally (Accounting)', status: 'Routes built', color: 'text-teal-600' },
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
