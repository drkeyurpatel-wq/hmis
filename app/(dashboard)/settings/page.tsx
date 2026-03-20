'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

type Tab = 'centres' | 'staff' | 'departments' | 'wards' | 'tariffs' | 'auto_charges' | 'roles' | 'system';

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
  const [loading, setLoading] = useState(true);

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
    setCentres(c.data || []); setStaffList(s.data || []); setDepartments(d.data || []);
    setWards(w.data || []); setTariffs(t.data || []); setAutoRules(ar.data || []);
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

  const filtered = (list: any[], field: string = 'full_name') =>
    search ? list.filter(i => JSON.stringify(i).toLowerCase().includes(search.toLowerCase())) : list;

  const tabs: [Tab, string][] = [
    ['centres', 'Centres'], ['staff', 'Staff'], ['departments', 'Departments'],
    ['wards', 'Wards & Rooms'], ['tariffs', 'Tariff Master'], ['auto_charges', 'Auto-Charge Rules'],
    ['roles', 'Roles & Access'], ['system', 'System'],
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}
      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Settings & Configuration</h1><p className="text-xs text-gray-500">System-wide configuration for Health1 HMIS</p></div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="px-3 py-1.5 border rounded-lg text-xs w-56" placeholder="Search..." />
      </div>

      <div className="flex gap-1 border-b">{tabs.map(([k, l]) =>
        <button key={k} onClick={() => setTab(k)} className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>{l}</button>
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
              <td className="p-2 text-center"><span className={`px-1 py-0.5 rounded text-[9px] ${s.staff_type === 'doctor' ? 'bg-blue-100 text-blue-700' : s.staff_type === 'nurse' ? 'bg-teal-100 text-teal-700' : 'bg-gray-100'}`}>{s.staff_type}</span></td>
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

      {/* ROLES */}
      {tab === 'roles' && <div className="bg-white rounded-xl border p-4">
        <h3 className="font-bold text-sm mb-3">Role-Based Access Control</h3>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {[
            { role: 'MD / Admin', modules: 'All modules, Settings, Reports, User management', color: 'bg-red-50 border-red-200' },
            { role: 'Doctor', modules: 'EMR, OPD, IPD (own patients), Lab results, Radiology, Pharmacy', color: 'bg-blue-50 border-blue-200' },
            { role: 'Nurse', modules: 'IPD nursing, Vitals, MAR, Bed management, Barcode scan', color: 'bg-teal-50 border-teal-200' },
            { role: 'Billing Staff', modules: 'Billing (all tabs), Estimates, Collections, Day-end', color: 'bg-green-50 border-green-200' },
            { role: 'Lab Tech', modules: 'Lab module, Sample collection, Result entry', color: 'bg-purple-50 border-purple-200' },
            { role: 'Radiology Tech', modules: 'Radiology worklist, PACS link, Stradus integration', color: 'bg-indigo-50 border-indigo-200' },
            { role: 'Pharmacist', modules: 'Pharmacy dispense, Stock management, Drug master', color: 'bg-pink-50 border-pink-200' },
            { role: 'Front Desk', modules: 'OPD queue, Patient registration, Appointments', color: 'bg-amber-50 border-amber-200' },
            { role: 'Operations / CEO', modules: 'Command Centre, Reports, Bed Management, VPMS', color: 'bg-orange-50 border-orange-200' },
          ].map(r => (
            <div key={r.role} className={`rounded-lg border p-3 ${r.color}`}>
              <div className="font-bold mb-1">{r.role}</div>
              <div className="text-gray-600">{r.modules}</div>
            </div>
          ))}
        </div>
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
              { name: 'WhatsApp Alerts', status: 'Template ready', color: 'text-blue-600' },
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
