'use client';
import React, { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { RoleGuard } from '@/components/ui/shared';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

function SettingsInner() {
  const { staff, centres, activeCentreId } = useAuthStore();
  const [tab, setTab] = useState('profile');
  const [centreList, setCentreList] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [toast, setToast] = useState('');
  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 2500); };

  useEffect(() => {
    if (!sb()) return;
    async function load() {
      const { data: c } = await sb().from('hmis_centres').select('*').eq('is_active', true).order('name');
      setCentreList(c || []);
      const { data: s } = await sb().from('hmis_staff').select('id, full_name, staff_type, designation, specialisation, phone, email, is_active').order('full_name');
      setStaffList(s || []);
      const { data: d } = await sb().from('hmis_departments').select('*').eq('is_active', true).order('name');
      setDepartments(d || []);
    }
    load();
  }, []);

  return (
    <div className="max-w-5xl mx-auto">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Settings</h1><p className="text-sm text-gray-500">System configuration and master data</p></div>

      <div className="flex gap-2 mb-6">{[['profile','My Profile'],['centres','Centres'],['staff','Staff'],['departments','Departments'],['system','System']].map(([k,l]) =>
        <button key={k} onClick={() => setTab(k)} className={`px-4 py-2 text-sm rounded-lg border ${tab === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200'}`}>{l}</button>
      )}</div>

      {/* My Profile */}
      {tab === 'profile' && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xl">
              {staff?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??'}
            </div>
            <div><h2 className="text-xl font-bold">{staff?.full_name || 'Loading...'}</h2>
              <p className="text-sm text-gray-500">{staff?.designation || staff?.staff_type} | {staff?.specialisation || ''}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[['Full name', staff?.full_name], ['Staff type', staff?.staff_type], ['Designation', staff?.designation],
              ['Specialisation', staff?.specialisation], ['Phone', staff?.phone], ['Email', staff?.email],
              ['Centres', centres.map(c => c.centre?.name).join(', ')],
              ['Active centre', centres.find(c => c.centre_id === activeCentreId)?.centre?.name || '--'],
            ].map(([label, val]) => (
              <div key={label as string} className="py-2 border-b"><span className="text-gray-500">{label as string}</span>
                <span className="float-right font-medium">{(val as string) || '--'}</span></div>
            ))}
          </div>
        </div>
      )}

      {/* Centres */}
      {tab === 'centres' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Code</th><th className="text-left p-3 font-medium text-gray-500">Name</th>
            <th className="text-left p-3 font-medium text-gray-500">Address</th><th className="text-left p-3 font-medium text-gray-500">Phone</th>
            <th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{centreList.map((c: any) => (
            <tr key={c.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{c.code}</td><td className="p-3 font-medium">{c.name}</td>
              <td className="p-3 text-xs text-gray-500">{c.address || '--'}</td>
              <td className="p-3 text-xs">{c.phone || '--'}</td>
              <td className="p-3">{c.is_active ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* Staff */}
      {tab === 'staff' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Name</th><th className="text-left p-3 font-medium text-gray-500">Type</th>
            <th className="text-left p-3 font-medium text-gray-500">Designation</th><th className="text-left p-3 font-medium text-gray-500">Specialisation</th>
            <th className="text-left p-3 font-medium text-gray-500">Phone</th><th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{staffList.map((s: any) => (
            <tr key={s.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{s.full_name}</td>
              <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-xs ${s.staff_type === 'doctor' ? 'bg-blue-100 text-blue-700' : s.staff_type === 'nurse' ? 'bg-purple-100 text-purple-700' : s.staff_type === 'admin' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{s.staff_type}</span></td>
              <td className="p-3 text-xs">{s.designation || '--'}</td>
              <td className="p-3 text-xs">{s.specialisation || '--'}</td>
              <td className="p-3 text-xs">{s.phone || '--'}</td>
              <td className="p-3">{s.is_active ? <span className="text-green-600 text-xs">Active</span> : <span className="text-red-400 text-xs">Inactive</span>}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* Departments */}
      {tab === 'departments' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm"><thead><tr className="bg-gray-50 border-b">
            <th className="text-left p-3 font-medium text-gray-500">Name</th><th className="text-left p-3 font-medium text-gray-500">Code</th>
            <th className="text-left p-3 font-medium text-gray-500">Status</th>
          </tr></thead><tbody>{departments.map((d: any) => (
            <tr key={d.id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-medium">{d.name}</td><td className="p-3 font-mono text-xs">{d.code || '--'}</td>
              <td className="p-3">{d.is_active ? <span className="text-green-600 text-xs">Active</span> : <span className="text-gray-400 text-xs">Inactive</span>}</td>
            </tr>
          ))}</tbody></table>
        </div>
      )}

      {/* System */}
      {tab === 'system' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm mb-3">System information</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[['Application', 'Health1 HMIS v1.0'], ['Framework', 'Next.js 14 + Supabase'],
                ['Database', '77 tables, RLS enabled'], ['Hosting', 'Vercel + Supabase Cloud'],
                ['Supabase project', 'bmuupgrzbfmddjwcqlss'], ['Region', 'Mumbai (ap-south-1)'],
              ].map(([k, v]) => (
                <div key={k} className="py-2 border-b"><span className="text-gray-500">{k}</span><span className="float-right font-mono text-xs">{v}</span></div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm mb-3">WhatsApp integration</h3>
            <p className="text-xs text-gray-500 mb-3">7 templates configured: appointment reminder, OPD token, lab results, discharge alert, payment receipt, pharmacy ready, follow-up reminder</p>
            <p className="text-xs text-gray-400">Status: {process.env.NEXT_PUBLIC_WHATSAPP_API_URL ? 'Configured' : 'Not configured — set WHATSAPP_API_URL in environment'}</p>
          </div>

          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold text-sm mb-3">Quick links</h3>
            <div className="space-y-2">
              <a href="https://supabase.com/dashboard/project/bmuupgrzbfmddjwcqlss" target="_blank" className="block text-sm text-blue-600 hover:text-blue-800">Supabase Dashboard</a>
              <a href="https://vercel.com/drkeyurpatel-wq/hmis" target="_blank" className="block text-sm text-blue-600 hover:text-blue-800">Vercel Deployments</a>
              <a href="https://github.com/drkeyurpatel-wq/hmis" target="_blank" className="block text-sm text-blue-600 hover:text-blue-800">GitHub Repository</a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() { return <RoleGuard module="settings"><SettingsInner /></RoleGuard>; }
