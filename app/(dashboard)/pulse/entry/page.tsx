'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { usePulse, useCentres, formatDate } from '@/lib/pulse/pulse-hooks';
import { StatsSkeleton } from '@/components/ui/shared';
import { PenLine, RefreshCw, Save, ArrowLeft, Check } from 'lucide-react';
import Link from 'next/link';

function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

interface EntryForm {
  opd_count: number;
  emergency_count: number;
  new_admissions: number;
  discharges: number;
  surgeries: number;
  billing_amount: number;
  collection_amount: number;
  pharmacy_sales: number;
  beds_occupied: number;
}

const EMPTY_FORM: EntryForm = {
  opd_count: 0, emergency_count: 0,
  new_admissions: 0, discharges: 0, surgeries: 0,
  billing_amount: 0, collection_amount: 0, pharmacy_sales: 0,
  beds_occupied: 0,
};

export default function PulseManualEntryPage() {
  const { staff } = useAuthStore();
  const pulse = usePulse();
  const { centres, loading: centresLoading } = useCentres();

  const [date, setDate] = useState(yesterday);
  const [selectedCentre, setSelectedCentre] = useState('');
  const [form, setForm] = useState<EntryForm>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [toast, setToast] = useState('');

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  // Select first centre by default
  useEffect(() => {
    if (centres.length > 0 && !selectedCentre) {
      setSelectedCentre(centres[0].id);
    }
  }, [centres, selectedCentre]);

  // Load existing data when centre/date changes
  useEffect(() => {
    if (!selectedCentre || !date) return;
    (async () => {
      const data = await pulse.getDashboard(date, selectedCentre);
      if (data.length > 0) {
        const s = data[0];
        setForm({
          opd_count: s.opd_count || 0,
          emergency_count: s.emergency_count || 0,
          new_admissions: s.new_admissions || 0,
          discharges: s.discharges || 0,
          surgeries: s.surgeries || 0,
          billing_amount: s.billing_amount || 0,
          collection_amount: s.collection_amount || 0,
          pharmacy_sales: s.pharmacy_sales || 0,
          beds_occupied: s.beds_occupied || 0,
        });
      } else {
        setForm({ ...EMPTY_FORM });
      }
    })();
  }, [selectedCentre, date]); // eslint-disable-line react-hooks/exhaustive-deps

  const centreInfo = centres.find((c: { id: string }) => c.id === selectedCentre);
  const occupancy = centreInfo && centreInfo.beds_operational > 0
    ? ((form.beds_occupied / centreInfo.beds_operational) * 100).toFixed(1)
    : '0.0';

  const handleAutoGenerate = async () => {
    if (!selectedCentre) return;
    setAutoGenerating(true);
    const result = await pulse.generateSnapshot(selectedCentre, date);
    if (result !== null) {
      // Reload to check if data appeared
      const data = await pulse.getDashboard(date, selectedCentre);
      if (data.length > 0) {
        const s = data[0];
        const allZero = !s.opd_count && !s.billing_amount && !s.new_admissions;
        if (allZero) {
          flash('HMIS returned zeros — enter data manually below');
        } else {
          setForm({
            opd_count: s.opd_count || 0,
            emergency_count: s.emergency_count || 0,
            new_admissions: s.new_admissions || 0,
            discharges: s.discharges || 0,
            surgeries: s.surgeries || 0,
            billing_amount: s.billing_amount || 0,
            collection_amount: s.collection_amount || 0,
            pharmacy_sales: s.pharmacy_sales || 0,
            beds_occupied: s.beds_occupied || 0,
          });
          flash('Auto-generated from HMIS data');
        }
      }
    }
    setAutoGenerating(false);
  };

  const handleSave = async () => {
    if (!selectedCentre) return;
    setSaving(true);
    const bedsTotal = centreInfo?.beds_operational || 0;
    const success = await pulse.upsertSnapshot({
      centre_id: selectedCentre,
      snapshot_date: date,
      opd_count: form.opd_count,
      emergency_count: form.emergency_count,
      new_admissions: form.new_admissions,
      discharges: form.discharges,
      surgeries: form.surgeries,
      billing_amount: form.billing_amount,
      collection_amount: form.collection_amount,
      pharmacy_sales: form.pharmacy_sales,
      beds_occupied: form.beds_occupied,
      beds_total: bedsTotal,
      occupancy_pct: bedsTotal > 0 ? (form.beds_occupied / bedsTotal) * 100 : 0,
    });
    if (success) flash('Snapshot saved');
    setSaving(false);
  };

  const updateField = (field: keyof EntryForm, value: string) => {
    const num = field === 'billing_amount' || field === 'collection_amount' || field === 'pharmacy_sales'
      ? parseFloat(value) || 0
      : parseInt(value, 10) || 0;
    setForm((f: EntryForm) => ({ ...f, [field]: num }));
  };

  const role = staff?.staff_type || '';
  const allowed = ['admin', 'md', 'ceo', 'centre_head'].includes(role);
  if (!allowed && role) {
    return (
      <div className="max-w-7xl mx-auto py-12 text-center">
        <PenLine size={48} className="mx-auto text-gray-300 mb-4" />
        <h2 className="text-lg font-semibold text-gray-700">Access Restricted</h2>
        <p className="text-sm text-gray-500 mt-1">Manual entry is available to admin and centre head roles.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg text-sm">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/pulse" className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <PenLine size={20} className="text-teal-600" />
              Manual Entry
            </h1>
          </div>
          <p className="text-sm text-gray-500 ml-7">Enter daily numbers for centres not yet on HMIS</p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        <input
          type="date"
          value={date}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDate(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
        />
        <select
          value={selectedCentre}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCentre(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none cursor-pointer flex-1 min-w-[200px]"
        >
          <option value="">Select Centre</option>
          {centres.map((c: { id: string; name: string }) => (
            <option key={c.id} value={c.id}>
              {c.name.replace('Health1 Super Speciality Hospitals — ', '').replace('Health1 ', '')}
            </option>
          ))}
        </select>
        <button
          onClick={handleAutoGenerate}
          disabled={autoGenerating || !selectedCentre}
          className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={autoGenerating ? 'animate-spin' : ''} />
          {autoGenerating ? 'Checking HMIS...' : 'Auto-generate from HMIS'}
        </button>
      </div>

      {centresLoading ? (
        <StatsSkeleton count={4} />
      ) : !selectedCentre ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center text-gray-500">
          Select a centre to begin entry
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
            {/* Patient Flow */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Patient Flow</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {([
                  { key: 'opd_count', label: 'OPD Count' },
                  { key: 'emergency_count', label: 'Emergency Count' },
                  { key: 'new_admissions', label: 'New Admissions' },
                  { key: 'discharges', label: 'Discharges' },
                  { key: 'surgeries', label: 'Surgeries' },
                ] as { key: keyof EntryForm; label: string }[]).map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                    <input
                      type="number"
                      min={0}
                      value={form[f.key] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(f.key, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue */}
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Revenue</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {([
                  { key: 'billing_amount', label: 'Billing Amount (₹)' },
                  { key: 'collection_amount', label: 'Collection Amount (₹)' },
                  { key: 'pharmacy_sales', label: 'Pharmacy Sales (₹)' },
                ] as { key: keyof EntryForm; label: string }[]).map(f => (
                  <div key={f.key}>
                    <label className="block text-xs text-gray-500 mb-1">{f.label}</label>
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={form[f.key] || ''}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField(f.key, e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Beds */}
            <div className="px-6 py-4">
              <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Bed Occupancy</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 items-end">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Occupied Beds</label>
                  <input
                    type="number"
                    min={0}
                    max={centreInfo?.beds_operational || 999}
                    value={form.beds_occupied || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateField('beds_occupied', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Total Beds</label>
                  <div className="border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
                    {centreInfo?.beds_operational || 0}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Occupancy</label>
                  <div className={`border rounded-lg px-3 py-2 text-sm font-bold ${
                    parseFloat(occupancy) >= 80 ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : parseFloat(occupancy) >= 60 ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                  }`}>
                    {occupancy}%
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              {saving ? 'Saving...' : 'Save Snapshot'}
            </button>
          </div>

          {pulse.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {pulse.error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
