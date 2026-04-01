'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { RoleGuard, TableSkeleton } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { useReferralSources, useReferralSourceTypes } from '@/lib/referrals/useReferralSources';
import type { ReferralSource, ReferralSourceType, NewReferralSourceInput } from '@/lib/referrals/types';

const CI = 'w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm outline-none focus:border-h1-teal focus:ring-1 focus:ring-h1-teal bg-white';
const CL = 'block text-xs font-semibold text-gray-600 mb-1';

const TYPE_COLORS: Record<string, string> = {
  doctor: 'bg-blue-100 text-blue-700',
  hospital: 'bg-purple-100 text-purple-700',
  insurance_agent: 'bg-amber-100 text-amber-700',
  campaign: 'bg-green-100 text-green-700',
  walkin_source: 'bg-gray-100 text-gray-700',
};

function SourcesInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';

  const { sources, loading, error, load, create, update, deactivate } = useReferralSources(centreId);
  const { types: sourceTypes } = useReferralSourceTypes();

  const [filterType, setFilterType] = useState('');
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Add form state
  const [formData, setFormData] = useState<Record<string, string>>({
    type_id: '', name: '', speciality: '', clinic_name: '', hospital_name: '',
    company: '', city: '', phone: '', email: '', notes: '',
  });
  const [formSaving, setFormSaving] = useState(false);

  // Edit form state
  const [editData, setEditData] = useState<Record<string, string>>({});

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResults, setImportResults] = useState<{ added: number; errors: string[] } | null>(null);

  const filtered = sources.filter(s => {
    if (filterType && s.type_id !== filterType) return false;
    if (search) {
      const term = search.toLowerCase();
      if (!s.name.toLowerCase().includes(term) &&
          !(s.phone || '').includes(term) &&
          !(s.city || '').toLowerCase().includes(term)) return false;
    }
    return true;
  });

  const resetForm = () => {
    setFormData({ type_id: '', name: '', speciality: '', clinic_name: '', hospital_name: '', company: '', city: '', phone: '', email: '', notes: '' });
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.type_id) return;
    setFormSaving(true);
    const input: NewReferralSourceInput = {
      type_id: formData.type_id,
      name: formData.name.trim(),
      speciality: formData.speciality?.trim() || undefined,
      clinic_name: formData.clinic_name?.trim() || undefined,
      hospital_name: formData.hospital_name?.trim() || undefined,
      company: formData.company?.trim() || undefined,
      city: formData.city?.trim() || undefined,
      phone: formData.phone?.trim() || undefined,
      email: formData.email?.trim() || undefined,
      notes: formData.notes?.trim() || undefined,
    };
    const result = await create(input);
    if (result.success) {
      flash(`Source "${formData.name}" added`);
      resetForm();
      setShowAddForm(false);
    } else {
      flash(result.error || 'Failed to add source');
    }
    setFormSaving(false);
  };

  const handleUpdate = async (id: string) => {
    const result = await update(id, editData as any);
    if (result.success) {
      flash('Source updated');
      setEditingId(null);
    } else {
      flash(result.error || 'Failed to update');
    }
  };

  const handleDeactivate = async (id: string, name: string) => {
    if (!window.confirm(`Deactivate "${name}"? This source will no longer appear in searches.`)) return;
    const result = await deactivate(id);
    if (result.success) flash(`"${name}" deactivated`);
    else flash(result?.error || 'Failed to deactivate');
  };

  const handleCsvImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) { flash('CSV must have a header row and at least one data row'); return; }

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const nameIdx = headers.findIndex(h => h === 'name');
    const typeIdx = headers.findIndex(h => h === 'type' || h === 'type_code');
    const specIdx = headers.findIndex(h => h === 'speciality' || h === 'specialty');
    const clinicIdx = headers.findIndex(h => h === 'clinic_name' || h === 'clinic');
    const cityIdx = headers.findIndex(h => h === 'city');
    const phoneIdx = headers.findIndex(h => h === 'phone');

    if (nameIdx === -1) { flash('CSV must have a "name" column'); return; }

    const doctorType = sourceTypes.find(t => t.code === 'doctor');
    const errors: string[] = [];
    let added = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      const name = cols[nameIdx];
      if (!name) { errors.push(`Row ${i + 1}: Missing name`); continue; }

      let typeId = doctorType?.id || '';
      if (typeIdx >= 0 && cols[typeIdx]) {
        const matchType = sourceTypes.find(t => t.code === cols[typeIdx] || t.label.toLowerCase() === cols[typeIdx].toLowerCase());
        if (matchType) typeId = matchType.id;
      }
      if (!typeId) { errors.push(`Row ${i + 1}: Invalid type`); continue; }

      const input: NewReferralSourceInput = {
        type_id: typeId,
        name,
        speciality: specIdx >= 0 ? cols[specIdx] || undefined : undefined,
        clinic_name: clinicIdx >= 0 ? cols[clinicIdx] || undefined : undefined,
        city: cityIdx >= 0 ? cols[cityIdx] || undefined : undefined,
        phone: phoneIdx >= 0 ? cols[phoneIdx] || undefined : undefined,
      };

      const result = await create(input);
      if (result.success) added++;
      else errors.push(`Row ${i + 1}: ${result.error || 'Failed'}`);
    }

    setImportResults({ added, errors });
    if (fileRef.current) fileRef.current.value = '';
  };

  const selectedTypeCode = sourceTypes.find(t => t.id === formData.type_id)?.code || '';

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-h1-navy text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium animate-slide-in">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
            <Link href="/referrals" className="hover:text-h1-teal cursor-pointer">Referral Tracker</Link>
            <span>/</span>
            <span className="text-gray-900 font-medium">Manage Sources</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Referral Sources</h1>
          <p className="text-sm text-gray-500">Manage the master list of referral sources</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(!showImport)}
            className="px-4 py-2 bg-white border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Import CSV
          </button>
          <button
            onClick={() => { setShowAddForm(!showAddForm); resetForm(); }}
            className="px-4 py-2 bg-h1-navy text-white text-sm rounded-lg hover:bg-h1-navy/90 transition-colors cursor-pointer"
          >
            + Add Source
          </button>
        </div>
      </div>

      {/* CSV Import */}
      {showImport && (
        <div className="bg-white rounded-xl border p-5 space-y-3">
          <h3 className="text-sm font-bold text-gray-700">Import from CSV</h3>
          <p className="text-xs text-gray-500">CSV columns: name (required), type/type_code, speciality, clinic_name, city, phone</p>
          <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvImport}
            className="text-sm text-gray-600" />
          {importResults && (
            <div className="mt-2 p-3 bg-gray-50 rounded-lg text-xs">
              <p className="font-medium text-green-700">{importResults.added} sources imported</p>
              {importResults.errors.length > 0 && (
                <div className="mt-1 text-red-600">
                  {importResults.errors.slice(0, 5).map((e, i) => <p key={i}>{e}</p>)}
                  {importResults.errors.length > 5 && <p>...and {importResults.errors.length - 5} more errors</p>}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl border p-5 space-y-4">
          <h3 className="text-sm font-bold text-gray-700">Add New Referral Source</h3>

          <div>
            <label className={CL}>Source Type *</label>
            <div className="flex flex-wrap gap-2">
              {sourceTypes.map(t => (
                <button
                  key={t.id}
                  onClick={() => setFormData(p => ({ ...p, type_id: t.id }))}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors cursor-pointer ${
                    formData.type_id === t.id
                      ? 'bg-h1-navy text-white border-h1-navy'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-h1-teal'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {formData.type_id && (
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><label className={CL}>Name *</label><input className={CI} value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} /></div>
              {(selectedTypeCode === 'doctor') && (
                <div><label className={CL}>Speciality</label><input className={CI} value={formData.speciality} onChange={e => setFormData(p => ({ ...p, speciality: e.target.value }))} /></div>
              )}
              {(selectedTypeCode === 'doctor') && (
                <div><label className={CL}>Clinic Name</label><input className={CI} value={formData.clinic_name} onChange={e => setFormData(p => ({ ...p, clinic_name: e.target.value }))} /></div>
              )}
              {(selectedTypeCode === 'hospital') && (
                <div><label className={CL}>Hospital Name</label><input className={CI} value={formData.hospital_name} onChange={e => setFormData(p => ({ ...p, hospital_name: e.target.value }))} /></div>
              )}
              {(selectedTypeCode === 'insurance_agent') && (
                <div><label className={CL}>Company</label><input className={CI} value={formData.company} onChange={e => setFormData(p => ({ ...p, company: e.target.value }))} /></div>
              )}
              <div><label className={CL}>City</label><input className={CI} value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} /></div>
              <div><label className={CL}>Phone</label><input className={CI} value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className={CL}>Email</label><input className={CI} value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} /></div>
            </div>
          )}

          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={formSaving || !formData.name.trim() || !formData.type_id}
              className="px-4 py-2 text-sm font-medium bg-h1-navy text-white rounded-lg disabled:opacity-50 cursor-pointer">
              {formSaving ? 'Adding...' : 'Add Source'}
            </button>
            <button onClick={() => { setShowAddForm(false); resetForm(); }}
              className="px-4 py-2 text-sm font-medium bg-gray-100 rounded-lg cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 flex flex-wrap gap-3 items-center">
        <input
          className="px-3 py-1.5 text-xs border rounded-lg w-56"
          placeholder="Search by name, phone, city..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex gap-1.5">
          <button
            onClick={() => setFilterType('')}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors cursor-pointer ${
              !filterType ? 'bg-h1-navy text-white border-h1-navy' : 'bg-white text-gray-500 border-gray-200'
            }`}
          >
            All
          </button>
          {sourceTypes.map(t => (
            <button
              key={t.id}
              onClick={() => setFilterType(filterType === t.id ? '' : t.id)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors cursor-pointer ${
                filterType === t.id ? 'bg-h1-teal text-white border-h1-teal' : 'bg-white text-gray-500 border-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} sources</span>
      </div>

      {/* Table */}
      {loading ? <TableSkeleton rows={8} cols={7} /> : (
        <div className="bg-white rounded-xl border overflow-hidden">
          {filtered.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-gray-500">No referral sources found</p>
              <p className="text-xs text-gray-400 mt-1">Add sources using the button above or import from CSV</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 text-left text-gray-500 font-medium">
                    <th className="px-4 py-2.5">Name</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Details</th>
                    <th className="px-4 py-2.5">Phone</th>
                    <th className="px-4 py-2.5 text-right">Patients</th>
                    <th className="px-4 py-2.5 text-right">Revenue</th>
                    <th className="px-4 py-2.5">Last Referral</th>
                    <th className="px-4 py-2.5 w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className="border-t hover:bg-gray-50 transition-colors">
                      {editingId === s.id ? (
                        <>
                          <td className="px-4 py-2" colSpan={6}>
                            <div className="flex gap-2 items-center">
                              <input className="px-2 py-1 text-xs border rounded w-40" value={editData.name || ''} onChange={e => setEditData(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
                              <input className="px-2 py-1 text-xs border rounded w-28" value={editData.speciality || ''} onChange={e => setEditData(p => ({ ...p, speciality: e.target.value }))} placeholder="Speciality" />
                              <input className="px-2 py-1 text-xs border rounded w-28" value={editData.city || ''} onChange={e => setEditData(p => ({ ...p, city: e.target.value }))} placeholder="City" />
                              <input className="px-2 py-1 text-xs border rounded w-28" value={editData.phone || ''} onChange={e => setEditData(p => ({ ...p, phone: e.target.value }))} placeholder="Phone" />
                            </div>
                          </td>
                          <td className="px-4 py-2" colSpan={2}>
                            <div className="flex gap-1">
                              <button onClick={() => handleUpdate(s.id)} className="px-2 py-1 text-[10px] bg-h1-navy text-white rounded cursor-pointer">Save</button>
                              <button onClick={() => setEditingId(null)} className="px-2 py-1 text-[10px] bg-gray-100 rounded cursor-pointer">Cancel</button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            <Link href={`/referrals/${s.id}`} className="hover:text-h1-teal cursor-pointer">{s.name}</Link>
                          </td>
                          <td className="px-4 py-2.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${TYPE_COLORS[s.type_code || ''] || 'bg-gray-100 text-gray-600'}`}>
                              {s.type_label}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">
                            {s.speciality || s.clinic_name || s.hospital_name || s.company || '—'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">{s.phone || '—'}</td>
                          <td className="px-4 py-2.5 text-right font-semibold">{s.total_patients}</td>
                          <td className="px-4 py-2.5 text-right">
                            {s.total_revenue > 0 ? `₹${Math.round(s.total_revenue).toLocaleString('en-IN')}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500">
                            {s.last_referral_date ? new Date(s.last_referral_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex gap-1">
                              <button
                                onClick={() => { setEditingId(s.id); setEditData({ name: s.name, speciality: s.speciality || '', city: s.city || '', phone: s.phone || '' }); }}
                                className="px-2 py-1 text-[10px] bg-gray-100 rounded hover:bg-gray-200 cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeactivate(s.id, s.name)}
                                className="px-2 py-1 text-[10px] bg-red-50 text-red-600 rounded hover:bg-red-100 cursor-pointer"
                              >
                                Deactivate
                              </button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SourceManagementPage() {
  return (
    <RoleGuard module="referrals">
      <SourcesInner />
    </RoleGuard>
  );
}
