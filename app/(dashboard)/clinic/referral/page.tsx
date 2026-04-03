'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import {
  ArrowUpRight, Search, XCircle, Clock, CheckCircle,
  RefreshCw, AlertTriangle, Users, Building2,
} from 'lucide-react';
import type { ClinicReferral, ClinicReferralStatus, ReferralUrgency } from '@/types/database';

const STATUS_CONFIG: Record<ClinicReferralStatus, { label: string; color: string }> = {
  referred: { label: 'Referred', color: 'bg-blue-100 text-blue-700' },
  appointment_created: { label: 'Appointment Created', color: 'bg-teal-100 text-teal-700' },
  patient_visited: { label: 'Patient Visited', color: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-600' },
  no_show: { label: 'No Show', color: 'bg-red-100 text-red-700' },
};

const URGENCY_OPTIONS: { value: ReferralUrgency; label: string; color: string }[] = [
  { value: 'routine', label: 'Routine', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'urgent', label: 'Urgent', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  { value: 'emergency', label: 'Emergency', color: 'bg-red-100 text-red-700 border-red-200' },
];

const DEPARTMENTS = [
  'General Medicine', 'Cardiology', 'Neurology', 'Orthopaedics', 'ENT',
  'Ophthalmology', 'Dermatology', 'Gynaecology', 'Paediatrics', 'Surgery',
  'Urology', 'Gastroenterology', 'Pulmonology', 'Nephrology', 'Oncology',
];

type Tab = 'refer' | 'my-referrals';

export default function ReferralPage() {
  const { staff, activeCentreId, hubCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [activeTab, setActiveTab] = useState<Tab>('refer');
  const [referrals, setReferrals] = useState<ClinicReferral[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Form state
  const [patientSearch, setPatientSearch] = useState('');
  const [patientResults, setPatientResults] = useState<any[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [department, setDepartment] = useState('');
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState<ReferralUrgency>('routine');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const loadReferrals = useCallback(async () => {
    if (!centreId) return;
    setLoading(true);
    const client = sb();
    let query = client
      .from('hmis_clinic_referrals')
      .select('*, patient:hmis_patients(first_name, last_name, uhid), to_centre:hmis_centres!to_centre_id(name)')
      .eq('from_centre_id', centreId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    const { data } = await query;
    setReferrals((data as any) || []);
    setLoading(false);
  }, [centreId, statusFilter]);

  useEffect(() => { loadReferrals(); }, [loadReferrals]);

  // Patient search
  useEffect(() => {
    if (patientSearch.length < 2) { setPatientResults([]); return; }
    const timeout = setTimeout(async () => {
      const client = sb();
      const { data } = await client
        .from('hmis_patients')
        .select('id, first_name, last_name, uhid, phone_primary')
        .or(`first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%,uhid.ilike.%${patientSearch}%`)
        .limit(8);
      setPatientResults(data || []);
    }, 300);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  const generateReferralNumber = () => {
    const d = new Date();
    const dateStr = d.toISOString().slice(2, 10).replace(/-/g, '');
    const seq = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `REF-${dateStr}-${seq}`;
  };

  const handleSubmit = async () => {
    if (!selectedPatient || !reason || !hubCentreId) return;
    setSaving(true);
    const client = sb();

    const { error } = await client.from('hmis_clinic_referrals').insert({
      from_centre_id: centreId,
      to_centre_id: hubCentreId,
      patient_id: selectedPatient.id,
      referral_number: generateReferralNumber(),
      reason,
      urgency,
      department: department || null,
      referred_by: staff?.id,
      clinical_notes: clinicalNotes || null,
      status: 'referred',
    });

    if (!error) {
      setSelectedPatient(null);
      setPatientSearch('');
      setReason('');
      setDepartment('');
      setUrgency('routine');
      setClinicalNotes('');
      setActiveTab('my-referrals');
      loadReferrals();
    }
    setSaving(false);
  };

  return (
    <div className="w-full max-w-[1280px] mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Refer to Hospital</h1>
          <p className="text-sm text-gray-500">Refer patients to the hub hospital for specialist care</p>
        </div>
        <button onClick={loadReferrals} className="p-2 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer">
          <RefreshCw size={16} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        <button onClick={() => setActiveTab('refer')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'refer' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>
          <ArrowUpRight size={14} /> New Referral
        </button>
        <button onClick={() => setActiveTab('my-referrals')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
            activeTab === 'my-referrals' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}>
          <Clock size={14} /> My Referrals ({referrals.length})
        </button>
      </div>

      {/* New Referral Form */}
      {activeTab === 'refer' && (
        <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
          {/* Patient search */}
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Patient *</label>
            {selectedPatient ? (
              <div className="flex items-center gap-3 px-3 py-2 bg-teal-50 rounded-lg border border-teal-200">
                <span className="text-sm font-medium text-gray-800">
                  {selectedPatient.first_name} {selectedPatient.last_name}
                </span>
                <span className="text-xs text-gray-500 font-mono">{selectedPatient.uhid}</span>
                <button onClick={() => { setSelectedPatient(null); setPatientSearch(''); }}
                  className="ml-auto text-gray-400 hover:text-red-500 cursor-pointer">
                  <XCircle size={16} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  placeholder="Search by name, UHID, or phone..."
                  className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                />
                {patientResults.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                    {patientResults.map((p: any) => (
                      <button key={p.id} onClick={() => { setSelectedPatient(p); setPatientResults([]); setPatientSearch(''); }}
                        className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b last:border-0 cursor-pointer">
                        <span className="font-medium">{p.first_name} {p.last_name}</span>
                        <span className="text-gray-400 ml-2 font-mono text-xs">{p.uhid}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Department</label>
              <select value={department} onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                <option value="">Select department...</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Urgency *</label>
              <div className="flex gap-2">
                {URGENCY_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setUrgency(opt.value)}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                      urgency === opt.value ? opt.color + ' ring-2 ring-offset-1 ring-current' : 'bg-gray-50 text-gray-400 border-gray-200'
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Reason for Referral *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="e.g., Needs CT scan, Suspected cardiac issue, Surgery required..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Clinical Notes</label>
            <textarea
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              rows={3}
              placeholder="Consultation findings, relevant history..."
              className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!selectedPatient || !reason || saving || !hubCentreId}
            className="px-5 py-2.5 bg-orange-500 text-white rounded-lg text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer">
            {saving ? 'Creating Referral...' : 'Create Referral'}
          </button>

          {!hubCentreId && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle size={12} />
              No hub centre configured for this clinic. Contact admin.
            </p>
          )}
        </div>
      )}

      {/* My Referrals */}
      {activeTab === 'my-referrals' && (
        <div className="space-y-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <button onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'
              }`}>All</button>
            {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
              <button key={key} onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-colors cursor-pointer ${
                  statusFilter === key ? 'bg-[#0f1729] text-white' : 'bg-white text-gray-500 border hover:bg-gray-50'
                }`}>{cfg.label}</button>
            ))}
          </div>

          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="animate-spin text-gray-300 mx-auto" size={24} />
            </div>
          ) : referrals.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <ArrowUpRight size={32} className="mx-auto text-gray-200 mb-2" />
              <p className="text-sm text-gray-400">No referrals found</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
              {referrals.map((ref) => {
                const statusCfg = STATUS_CONFIG[ref.status];
                const urgCfg = URGENCY_OPTIONS.find(u => u.value === ref.urgency);
                return (
                  <div key={ref.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800">
                        {(ref.patient as any)?.first_name} {(ref.patient as any)?.last_name}
                      </span>
                      <span className="text-xs text-gray-400 font-mono">{(ref.patient as any)?.uhid}</span>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      {ref.urgency !== 'routine' && (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          ref.urgency === 'emergency' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {ref.urgency}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{ref.reason}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                      <span>{ref.referral_number}</span>
                      {ref.department && <span>&middot; {ref.department}</span>}
                      <span>&middot; {(ref.to_centre as any)?.name || 'Hub Hospital'}</span>
                      <span>&middot; {new Date(ref.created_at).toLocaleDateString('en-IN')}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
