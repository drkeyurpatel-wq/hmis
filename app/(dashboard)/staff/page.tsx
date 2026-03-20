'use client';
import React, { useState, useMemo } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useStaffManagement, useRoles, ALL_MODULES, type Permissions, hasModuleAccess } from '@/lib/rbac/rbac-hooks';
import { validateStaffCreation, getFieldError } from '@/lib/utils/validation';

type Tab = 'staff' | 'create' | 'bulk' | 'roles' | 'permissions';

const STAFF_TYPES = ['doctor','nurse','technician','admin','support','pharmacist','lab_tech','receptionist','accountant'];
const fmt = (n: number) => n.toLocaleString('en-IN');

function StaffInner() {
  const { staff: me, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const mgmt = useStaffManagement(centreId);
  const roles = useRoles();
  const [tab, setTab] = useState<Tab>('staff');
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  // Create form
  const [form, setForm] = useState({ employeeCode: '', fullName: '', email: '', password: '', phone: '', staffType: 'doctor', designation: '', roleName: 'doctor', specialisation: '', medicalRegNo: '' });
  const [creating, setCreating] = useState(false);

  // Bulk import
  const [csvText, setCsvText] = useState('');
  const [bulkResult, setBulkResult] = useState<any>(null);
  const [bulking, setBulking] = useState(false);

  // Permission editor
  const [editingRole, setEditingRole] = useState<any>(null);
  const [editPerms, setEditPerms] = useState<Permissions>({});

  // Filtered staff
  const filtered = useMemo(() => {
    let list = mgmt.staffList;
    if (search) list = list.filter(s => s.full_name?.toLowerCase().includes(search.toLowerCase()) || s.employee_code?.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter) list = list.filter(s => s.staff_type === typeFilter);
    return list;
  }, [mgmt.staffList, search, typeFilter]);

  // Auto-generate email from name
  const autoEmail = (name: string) => name.toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/).join('.') + '@health1.in';
  const autoCode = (type: string) => `H1-${type.slice(0, 3).toUpperCase()}-${String(mgmt.stats.total + 1).padStart(3, '0')}`;

  const handleCreate = async () => {
    if (!form.fullName || !form.email || !form.password) return;
    setCreating(true);
    const result = await mgmt.createUser(form);
    if (result.success) { flash(`Created: ${form.fullName} (${form.email})`); setForm({ employeeCode: '', fullName: '', email: '', password: '', phone: '', staffType: 'doctor', designation: '', roleName: 'doctor', specialisation: '', medicalRegNo: '' }); }
    else flash(result.error || 'Failed');
    setCreating(false);
  };

  const handleBulk = async () => {
    if (!csvText.trim()) return;
    setBulking(true);
    const lines = csvText.trim().split('\n').filter(l => l.trim() && !l.startsWith('employee_code'));
    const users = lines.map(l => {
      const [employee_code, full_name, email, password, phone, staff_type, designation, role_name, specialisation, medical_reg_no] = l.split(',').map(s => s.trim());
      return { employee_code, full_name, email, password: password || 'Health1@2026', phone, staff_type: staff_type || 'support', designation: designation || '', role_name: role_name || 'receptionist', specialisation, medical_reg_no };
    });
    const result = await mgmt.bulkCreate(users);
    setBulkResult(result);
    setBulking(false);
    flash(`Bulk: ${result.success} created, ${result.failed} failed`);
  };

  const startEditPerms = (role: any) => { setEditingRole(role); setEditPerms(role.permissions || {}); setTab('permissions'); };
  const togglePerm = (mod: string, action: string) => {
    setEditPerms(prev => {
      const curr = prev[mod] || [];
      const next = curr.includes(action) ? curr.filter(a => a !== action) : [...curr, action];
      return { ...prev, [mod]: next };
    });
  };
  const toggleAllModule = (mod: string, actions: string[]) => {
    setEditPerms(prev => {
      const curr = prev[mod] || [];
      const allOn = actions.every(a => curr.includes(a));
      return { ...prev, [mod]: allOn ? [] : [...actions] };
    });
  };
  const savePerms = async () => {
    if (!editingRole) return;
    await roles.updatePermissions(editingRole.id, editPerms);
    flash(`Permissions updated for ${editingRole.name}`);
    setTab('roles');
    setEditingRole(null);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      {toast && <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm">{toast}</div>}

      <div className="flex items-center justify-between">
        <div><h1 className="text-xl font-bold">Staff & Access Management</h1>
          <p className="text-xs text-gray-500">{mgmt.stats.total} staff ({mgmt.stats.active} active) | {roles.roles.length} roles</p></div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-6 gap-2">
        <div className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Total</div><div className="text-xl font-bold">{mgmt.stats.total}</div></div>
        <div className="bg-green-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Active</div><div className="text-xl font-bold text-green-700">{mgmt.stats.active}</div></div>
        <div className="bg-red-50 rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500">Inactive</div><div className="text-xl font-bold text-red-700">{mgmt.stats.inactive}</div></div>
        {Object.entries(mgmt.stats.byType).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3).map(([type, count]) =>
          <div key={type} className="bg-white rounded-xl border p-2 text-center"><div className="text-[9px] text-gray-500 capitalize">{type.replace('_', ' ')}</div><div className="text-xl font-bold">{count as number}</div></div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b">{(['staff', 'create', 'bulk', 'roles', ...(editingRole ? ['permissions'] as Tab[] : [])] as Tab[]).map(t =>
        <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-xs font-medium border-b-2 -mb-px capitalize ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500'}`}>
          {t === 'staff' ? `Staff List (${filtered.length})` : t === 'create' ? '+ Create User' : t === 'bulk' ? 'Bulk Import' : t === 'roles' ? `Roles (${roles.roles.length})` : `Edit: ${editingRole?.name}`}
        </button>
      )}</div>

      {/* ===== STAFF LIST ===== */}
      {tab === 'staff' && <div className="space-y-3">
        <div className="flex gap-2">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="flex-1 px-3 py-2 border rounded-lg text-xs" placeholder="Search name, code, email..." />
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="px-3 py-2 border rounded-lg text-xs">
            <option value="">All Types</option>{STAFF_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select>
        </div>
        {mgmt.loading ? <div className="animate-pulse h-48 bg-gray-200 rounded-xl" /> :
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50 border-b">
            <th className="p-2 text-left">Code</th><th className="p-2 text-left">Name</th><th className="p-2">Type</th><th className="p-2">Role</th><th className="p-2">Email</th><th className="p-2">Phone</th><th className="p-2">Status</th><th className="p-2">Actions</th>
          </tr></thead><tbody>{filtered.slice(0, 100).map(s => {
            const role = s.centres?.[0]?.role;
            return (
              <tr key={s.id} className="border-b hover:bg-gray-50">
                <td className="p-2 font-mono text-[10px]">{s.employee_code}</td>
                <td className="p-2 font-medium">{s.full_name}{s.designation && <span className="text-gray-400 ml-1">{s.designation}</span>}</td>
                <td className="p-2 text-center"><span className="text-[9px] bg-gray-100 px-1.5 py-0.5 rounded capitalize">{s.staff_type?.replace('_', ' ')}</span></td>
                <td className="p-2 text-center">
                  <select value={role?.id || ''} onChange={e => mgmt.changeRole(s.id, e.target.value)} className="text-[10px] border rounded px-1 py-0.5">
                    {roles.roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </select>
                </td>
                <td className="p-2 text-gray-400 text-[10px]">{s.email}</td>
                <td className="p-2 text-gray-400 text-[10px]">{s.phone}</td>
                <td className="p-2 text-center"><button onClick={() => mgmt.toggleActive(s.id, !s.is_active)} className={`text-[9px] px-1.5 py-0.5 rounded ${s.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.is_active ? 'Active' : 'Inactive'}</button></td>
                <td className="p-2 text-center"><button onClick={() => { const pw = prompt('New password:'); if (pw && s.auth_user_id) mgmt.resetPassword(s.auth_user_id, pw).then(r => flash(r.success ? 'Password reset' : r.error || 'Failed')); }} className="text-[9px] text-blue-600 hover:underline">Reset PW</button></td>
              </tr>
            );
          })}</tbody></table>
        </div>}
      </div>}

      {/* ===== CREATE USER ===== */}
      {tab === 'create' && <div className="bg-white rounded-xl border p-5 space-y-4 max-w-3xl">
        <h2 className="font-bold text-sm">Create Staff User</h2>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-xs text-gray-500">Full Name *</label>
            <input type="text" value={form.fullName} onChange={e => { setForm(f => ({ ...f, fullName: e.target.value, email: autoEmail(e.target.value), employeeCode: f.employeeCode || autoCode(f.staffType) })); }} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Dr. Amit Shah" /></div>
          <div><label className="text-xs text-gray-500">Employee Code *</label>
            <input type="text" value={form.employeeCode} onChange={e => setForm(f => ({ ...f, employeeCode: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="H1-DOC-001" /></div>
          <div><label className="text-xs text-gray-500">Staff Type *</label>
            <select value={form.staffType} onChange={e => setForm(f => ({ ...f, staffType: e.target.value, roleName: e.target.value === 'doctor' ? 'doctor' : e.target.value === 'nurse' ? 'nurse' : e.target.value === 'pharmacist' ? 'pharmacist' : e.target.value === 'lab_tech' ? 'lab_technician' : e.target.value === 'receptionist' ? 'receptionist' : e.target.value === 'admin' ? 'admin' : 'receptionist' }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {STAFF_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Email (Login ID) *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" /></div>
          <div><label className="text-xs text-gray-500">Password *</label>
            <input type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Health1@2026" /></div>
          <div><label className="text-xs text-gray-500">Phone</label>
            <input type="text" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="9876543210" /></div>
          <div><label className="text-xs text-gray-500">Designation</label>
            <input type="text" value={form.designation} onChange={e => setForm(f => ({ ...f, designation: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Consultant, HOD, Staff Nurse..." /></div>
          <div><label className="text-xs text-gray-500">Role (auto-assigned by type)</label>
            <select value={form.roleName} onChange={e => setForm(f => ({ ...f, roleName: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm">
              {roles.roles.map(r => <option key={r.name} value={r.name}>{r.name} — {r.description?.substring(0, 40)}</option>)}</select></div>
          <div><label className="text-xs text-gray-500">Specialisation</label>
            <input type="text" value={form.specialisation} onChange={e => setForm(f => ({ ...f, specialisation: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Cardiology, Neurology..." /></div>
        </div>
        <button onClick={handleCreate} disabled={creating || !form.fullName || !form.email || !form.password}
          className="px-6 py-2.5 bg-blue-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">{creating ? 'Creating...' : 'Create User'}</button>
      </div>}

      {/* ===== BULK IMPORT ===== */}
      {tab === 'bulk' && <div className="bg-white rounded-xl border p-5 space-y-4 max-w-4xl">
        <h2 className="font-bold text-sm">Bulk Import — CSV Format</h2>
        <div className="bg-gray-50 rounded-lg p-3 text-[10px] font-mono">employee_code,full_name,email,password,phone,staff_type,designation,role_name,specialisation,medical_reg_no</div>
        <div className="text-xs text-gray-500">Paste CSV below. Default password: <code className="bg-gray-100 px-1 rounded">Health1@2026</code> if left blank. Default role: <code className="bg-gray-100 px-1 rounded">receptionist</code> if not specified.</div>
        <textarea value={csvText} onChange={e => setCsvText(e.target.value)} rows={12} className="w-full px-3 py-2 border rounded-lg text-xs font-mono"
          placeholder={`H1-DOC-001,Dr. Amit Shah,amit.shah@health1.in,Health1@2026,9876543210,doctor,Consultant Cardiologist,doctor,Cardiology,GJ-12345\nH1-NRS-001,Priya Patel,priya.patel@health1.in,,9876543211,nurse,Staff Nurse ICU,nurse,,\nH1-REC-001,Ravi Kumar,ravi.kumar@health1.in,,9876543212,receptionist,Front Desk,receptionist,,`} />
        <div className="flex gap-3 items-center">
          <button onClick={handleBulk} disabled={bulking || !csvText.trim()} className="px-6 py-2.5 bg-green-600 text-white text-sm rounded-lg font-medium disabled:opacity-40">{bulking ? 'Importing...' : `Import ${csvText.trim().split('\n').filter(l => l.trim() && !l.startsWith('employee')).length} Users`}</button>
          {bulkResult && <span className="text-xs"><span className="text-green-700 font-bold">{bulkResult.success} created</span> {bulkResult.failed > 0 && <span className="text-red-700 font-bold">{bulkResult.failed} failed</span>}</span>}
        </div>
        {bulkResult?.results?.filter((r: any) => !r.success).length > 0 && <div className="bg-red-50 rounded-lg p-3 text-xs">
          <div className="font-bold text-red-700 mb-1">Errors:</div>
          {bulkResult.results.filter((r: any) => !r.success).map((r: any, i: number) => <div key={i}>{r.employee_code}: {r.error}</div>)}
        </div>}
      </div>}

      {/* ===== ROLES ===== */}
      {tab === 'roles' && <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {roles.roles.map(role => {
            const permCount = Object.values(role.permissions || {}).flat().length;
            const moduleCount = Object.keys(role.permissions || {}).filter(m => ((role.permissions || {})[m] || []).length > 0).length;
            return (
              <div key={role.id} className={`bg-white rounded-xl border p-4 ${role.is_system ? 'border-blue-200' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <div><span className="font-bold text-sm capitalize">{role.name.replace('_', ' ')}</span>
                    {role.is_system && <span className="ml-1 text-[8px] bg-blue-100 text-blue-700 px-1 py-0.5 rounded">SYSTEM</span>}</div>
                  <button onClick={() => startEditPerms(role)} className="px-2 py-1 bg-blue-100 text-blue-700 text-[10px] rounded">Edit Permissions</button>
                </div>
                <div className="text-xs text-gray-500 mb-2">{role.description}</div>
                <div className="text-[10px] text-gray-400">{moduleCount} modules, {permCount} permissions</div>
                {/* Module chips */}
                <div className="flex flex-wrap gap-1 mt-2">{Object.entries(role.permissions || {}).filter(([_, v]) => (v as string[]).length > 0).map(([mod, actions]) =>
                  <span key={mod} className="text-[8px] bg-gray-100 px-1.5 py-0.5 rounded">{ALL_MODULES.find(m => m.key === mod)?.icon || ''} {mod} ({(actions as string[]).length})</span>
                )}</div>
              </div>
            );
          })}
        </div>
      </div>}

      {/* ===== PERMISSION EDITOR ===== */}
      {tab === 'permissions' && editingRole && <div className="bg-white rounded-xl border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div><h2 className="font-bold text-sm">Edit Permissions: <span className="text-blue-700 capitalize">{editingRole.name.replace('_', ' ')}</span></h2>
            <p className="text-xs text-gray-500">{editingRole.description}</p></div>
          <div className="flex gap-2">
            <button onClick={() => { setTab('roles'); setEditingRole(null); }} className="px-3 py-1.5 bg-gray-200 text-xs rounded-lg">Cancel</button>
            <button onClick={savePerms} className="px-4 py-1.5 bg-green-600 text-white text-xs rounded-lg font-medium">Save Permissions</button>
          </div>
        </div>

        {/* Checkbox matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-gray-50">
            <th className="p-2 text-left w-40">Module</th>
            {['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'].map(a =>
              <th key={a} className="p-2 text-center w-16 capitalize">{a}</th>
            )}
            <th className="p-2 text-center w-16">All</th>
          </tr></thead><tbody>{ALL_MODULES.map(mod => {
            const perms = editPerms[mod.key] || [];
            const allOn = mod.actions.every(a => perms.includes(a));
            return (
              <tr key={mod.key} className="border-b hover:bg-blue-50/30">
                <td className="p-2 font-medium"><span className="mr-1">{mod.icon}</span>{mod.label}</td>
                {['view', 'create', 'edit', 'delete', 'print', 'approve', 'export', 'admin'].map(action =>
                  <td key={action} className="p-2 text-center">
                    {mod.actions.includes(action) ?
                      <input type="checkbox" checked={perms.includes(action)} onChange={() => togglePerm(mod.key, action)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 accent-blue-600" /> :
                      <span className="text-gray-200">—</span>
                    }
                  </td>
                )}
                <td className="p-2 text-center">
                  <button onClick={() => toggleAllModule(mod.key, mod.actions)} className={`text-[9px] px-2 py-0.5 rounded ${allOn ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                    {allOn ? 'All ✓' : 'All'}
                  </button>
                </td>
              </tr>
            );
          })}</tbody></table>
        </div>
      </div>}
    </div>
  );
}

export default function StaffPage() { return <RoleGuard module="settings"><StaffInner /></RoleGuard>; }
