'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

interface Department { id: string; name: string; code: string; hod_name?: string; is_active: boolean; }

interface Props { centreId: string; flash: (m: string) => void; }

export default function DepartmentsConfig({ centreId, flash }: Props) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', code: '', hod_name: '' });

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_departments').select('id, name, code, hod_name, is_active').eq('centre_id', centreId).order('name');
    setDepartments(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => { setForm({ name: '', code: '', hod_name: '' }); setShowAdd(false); setEditId(null); };

  const saveDept = async () => {
    if (!centreId || !sb() || !form.name.trim()) { flash('Department name is required'); return; }
    const code = form.code || form.name.substring(0, 4).toUpperCase();

    if (editId) {
      const { error } = await sb()!.from('hmis_departments').update({ name: form.name, code, hod_name: form.hod_name || null }).eq('id', editId);
      if (error) flash(`Error: ${error.message}`); else flash('Department updated');
    } else {
      const { error } = await sb()!.from('hmis_departments').insert({ centre_id: centreId, name: form.name, code, hod_name: form.hod_name || null, is_active: true });
      if (error) flash(`Error: ${error.message}`); else flash('Department added');
    }
    resetForm();
    load();
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    await sb()!.from('hmis_departments').update({ is_active: isActive }).eq('id', id);
    flash(`Department ${isActive ? 'activated' : 'deactivated'}`);
    setDepartments(prev => prev.map(d => d.id === id ? { ...d, is_active: isActive } : d));
  };

  const startEdit = (d: Department) => {
    setEditId(d.id);
    setForm({ name: d.name, code: d.code || '', hod_name: d.hod_name || '' });
    setShowAdd(true);
  };

  if (!centreId) return <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">Select a centre first.</div>;
  if (loading) return <div className="text-xs text-gray-400 p-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-sm">Departments ({departments.length})</h3>
          <p className="text-[10px] text-gray-500">Manage departments for this centre</p>
        </div>
        <button onClick={() => { resetForm(); setShowAdd(true); }} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg">+ Add Department</button>
      </div>

      {/* Add/Edit Form */}
      {showAdd && <div className="bg-blue-50 rounded-xl border border-blue-200 p-4 space-y-3">
        <h4 className="font-bold text-xs text-blue-700">{editId ? 'Edit Department' : 'New Department'}</h4>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="text-[10px] text-gray-500 font-medium">Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="e.g. Cardiology" autoFocus /></div>
          <div><label className="text-[10px] text-gray-500 font-medium">Code</label>
            <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Auto-generated if blank" /></div>
          <div><label className="text-[10px] text-gray-500 font-medium">HOD Name</label>
            <input value={form.hod_name} onChange={e => setForm(f => ({ ...f, hod_name: e.target.value }))} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Dr. Name" /></div>
        </div>
        <div className="flex gap-2">
          <button onClick={saveDept} className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded-lg">{editId ? 'Update' : 'Add'}</button>
          <button onClick={resetForm} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg border">Cancel</button>
        </div>
      </div>}

      {/* Department List */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-xs">
          <thead><tr className="bg-gray-50 border-b">
            <th className="p-3 text-left font-medium">Department</th>
            <th className="p-3 text-center font-medium">Code</th>
            <th className="p-3 text-center font-medium">HOD</th>
            <th className="p-3 text-center font-medium">Status</th>
            <th className="p-3 text-center font-medium">Actions</th>
          </tr></thead>
          <tbody>{departments.map(d => (
            <tr key={d.id} className={`border-b hover:bg-gray-50 ${!d.is_active ? 'opacity-40' : ''}`}>
              <td className="p-3 font-medium">{d.name}</td>
              <td className="p-3 text-center font-mono text-gray-500">{d.code || '—'}</td>
              <td className="p-3 text-center text-gray-500">{d.hod_name || '—'}</td>
              <td className="p-3 text-center">
                <button onClick={() => toggleActive(d.id, !d.is_active)} className={`w-9 h-5 rounded-full relative ${d.is_active ? 'bg-green-500' : 'bg-gray-300'}`}>
                  <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-[3px] transition-all ${d.is_active ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </td>
              <td className="p-3 text-center">
                <button onClick={() => startEdit(d)} className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded border hover:bg-gray-200">Edit</button>
              </td>
            </tr>
          ))}</tbody>
        </table>
        {departments.length === 0 && <div className="p-6 text-center text-xs text-gray-400">No departments found. Add one above.</div>}
      </div>
    </div>
  );
}
