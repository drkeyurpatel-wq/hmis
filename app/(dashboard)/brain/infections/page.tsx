'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/use-supabase-query';
import { TableSkeleton, EmptyState, CardSkeleton, RoleGuard } from '@/components/ui/shared';
import { ArrowLeft, Bug, Plus, X } from 'lucide-react';
import type { InfectionType, DetectionSource, InfectionOutcome } from '@/types/database';

const INFECTION_LABELS: Record<InfectionType, string> = {
  ssi: 'SSI (Surgical Site)', clabsi: 'CLABSI', cauti: 'CAUTI',
  vap: 'VAP', cdiff: 'C. difficile', mrsa: 'MRSA', other_hai: 'Other HAI',
};

const INFECTION_COLORS: Record<InfectionType, string> = {
  ssi: 'bg-red-100 text-red-700', clabsi: 'bg-orange-100 text-orange-700',
  cauti: 'bg-amber-100 text-amber-700', vap: 'bg-purple-100 text-purple-700',
  cdiff: 'bg-pink-100 text-pink-700', mrsa: 'bg-rose-100 text-rose-700',
  other_hai: 'bg-gray-100 text-gray-700',
};

const OUTCOME_COLORS: Record<InfectionOutcome, string> = {
  resolved: 'bg-green-100 text-green-700', ongoing: 'bg-amber-100 text-amber-700',
  readmitted: 'bg-orange-100 text-orange-700', death: 'bg-red-100 text-red-700',
};

function InfectionControlInner() {
  const { activeCentreId, staff } = useAuthStore();
  const centreId = activeCentreId || '';
  const [showForm, setShowForm] = useState(false);
  const [patientSearch, setPatientSearch] = useState('');
  const [form, setForm] = useState({
    patient_id: '',
    infection_type: 'ssi' as InfectionType,
    detection_date: new Date().toISOString().slice(0, 10),
    detection_source: 'clinical_signs' as DetectionSource,
    organism: '',
    procedure_name: '',
    treatment: '',
  });

  // Patient search for the form
  const { data: patientResults } = useSupabaseQuery(
    (sb) => sb.from('hmis_patients')
      .select('id, uhid, first_name, last_name')
      .or(`uhid.ilike.%${patientSearch}%,first_name.ilike.%${patientSearch}%,last_name.ilike.%${patientSearch}%`)
      .limit(5),
    [patientSearch],
    { enabled: patientSearch.length >= 2 }
  );

  const { data: events, isLoading, error, isEmpty, refetch } = useSupabaseQuery(
    (sb) => sb.from('brain_infection_events')
      .select('*, patient:hmis_patients(id, uhid, first_name, last_name)')
      .eq('centre_id', centreId)
      .order('detection_date', { ascending: false })
      .limit(200),
    [centreId],
    { enabled: !!centreId }
  );

  const { data: rates } = useSupabaseQuery(
    (sb) => sb.from('brain_infection_rates')
      .select('*')
      .eq('centre_id', centreId)
      .order('month', { ascending: false })
      .limit(6),
    [centreId],
    { enabled: !!centreId }
  );

  const { mutate: createEvent, isMutating } = useSupabaseMutation(
    (sb, input: Record<string, unknown>) => sb.from('brain_infection_events').insert(input).select().single(),
    { onSuccess: () => { refetch(); setShowForm(false); } }
  );

  const allEvents = events as Array<Record<string, unknown>> | null;
  const allRates = rates as Array<Record<string, unknown>> | null;

  // Type distribution
  const typeCounts: Record<string, number> = {};
  allEvents?.forEach((e) => {
    const t = e.infection_type as string;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const handleSubmit = () => {
    if (!form.detection_date || !form.patient_id) return;
    createEvent({
      centre_id: centreId,
      patient_id: form.patient_id,
      infection_type: form.infection_type,
      detection_date: form.detection_date,
      detection_source: form.detection_source,
      organism: form.organism || null,
      procedure_name: form.procedure_name || null,
      treatment: form.treatment || null,
      reported_by: staff?.id || null,
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Link href="/brain" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Infection Control (HAI)</h1>
            <p className="text-sm text-gray-500">Hospital-acquired infection monitoring and rates</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" /> Report Infection
        </button>
      </div>

      {/* Infection Rates Gauges */}
      {allRates && allRates.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'SSI Rate', value: allRates[0]?.ssi_rate as number, unit: '/100 surgeries', benchmark: 2.0 },
            { label: 'CLABSI Rate', value: allRates[0]?.clabsi_rate as number, unit: '/1000 line-days', benchmark: 1.0 },
            { label: 'CAUTI Rate', value: allRates[0]?.cauti_rate as number, unit: '/1000 catheter-days', benchmark: 2.0 },
            { label: 'VAP Rate', value: allRates[0]?.vap_rate as number, unit: '/1000 vent-days', benchmark: 2.0 },
          ].map((gauge) => (
            <div key={gauge.label} className="bg-white rounded-xl border p-4">
              <div className="text-xs text-gray-500 mb-1">{gauge.label}</div>
              <div className={`text-2xl font-bold ${(gauge.value ?? 0) > gauge.benchmark ? 'text-red-600' : 'text-green-600'}`}>
                {(gauge.value ?? 0).toFixed(1)}
              </div>
              <div className="text-xs text-gray-400">{gauge.unit}</div>
              <div className="text-xs text-gray-400 mt-1">Benchmark: &lt;{gauge.benchmark}</div>
            </div>
          ))}
        </div>
      )}

      {/* Type Distribution */}
      {!isLoading && Object.keys(typeCounts).length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {Object.entries(typeCounts).map(([type, count]) => (
            <div key={type} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${INFECTION_COLORS[type as InfectionType] || 'bg-gray-100'}`}>
              {INFECTION_LABELS[type as InfectionType] || type}: {count}
            </div>
          ))}
        </div>
      )}

      {/* Report Form */}
      {showForm && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Report New Infection Event</h3>
            <button onClick={() => setShowForm(false)} className="p-1 hover:bg-gray-100 rounded cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="relative">
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient *</label>
              {form.patient_id ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {(patientResults as Array<Record<string, unknown>> | null)?.find((p) => p.id === form.patient_id)
                      ? `${(patientResults as Array<Record<string, unknown>>).find((p) => p.id === form.patient_id)!.first_name} ${(patientResults as Array<Record<string, unknown>>).find((p) => p.id === form.patient_id)!.last_name}`
                      : 'Selected'}
                  </span>
                  <button onClick={() => { setForm({ ...form, patient_id: '' }); setPatientSearch(''); }} className="text-xs text-red-500 cursor-pointer">Clear</button>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    placeholder="Search by UHID or name..."
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                  {patientResults && (patientResults as Array<Record<string, unknown>>).length > 0 && (
                    <div className="absolute z-10 top-full left-0 right-0 bg-white border rounded-lg shadow-lg mt-1 max-h-40 overflow-auto">
                      {(patientResults as Array<Record<string, unknown>>).map((p) => (
                        <button
                          key={p.id as string}
                          onClick={() => { setForm({ ...form, patient_id: p.id as string }); setPatientSearch(''); }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer"
                        >
                          <span className="font-medium">{p.first_name as string} {p.last_name as string}</span>
                          <span className="text-xs text-gray-400 ml-2">{p.uhid as string}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Infection Type *</label>
              <select
                value={form.infection_type}
                onChange={(e) => setForm({ ...form, infection_type: e.target.value as InfectionType })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(INFECTION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Detection Date *</label>
              <input
                type="date"
                value={form.detection_date}
                onChange={(e) => setForm({ ...form, detection_date: e.target.value })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Detection Source</label>
              <select
                value={form.detection_source}
                onChange={(e) => setForm({ ...form, detection_source: e.target.value as DetectionSource })}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="lab_culture">Lab Culture</option>
                <option value="clinical_signs">Clinical Signs</option>
                <option value="surveillance">Surveillance</option>
                <option value="readmission">Readmission</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Organism</label>
              <input
                type="text"
                value={form.organism}
                onChange={(e) => setForm({ ...form, organism: e.target.value })}
                placeholder="E. coli, MRSA, etc."
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Procedure</label>
              <input
                type="text"
                value={form.procedure_name}
                onChange={(e) => setForm({ ...form, procedure_name: e.target.value })}
                placeholder="Surgery name"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Treatment</label>
              <input
                type="text"
                value={form.treatment}
                onChange={(e) => setForm({ ...form, treatment: e.target.value })}
                placeholder="Antibiotic treatment"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={handleSubmit}
              disabled={isMutating || !form.patient_id}
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2"
            >
              {isMutating && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Submit Report
            </button>
          </div>
        </div>
      )}

      {/* Events Timeline */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isEmpty ? (
        <EmptyState
          title="No infection events recorded yet"
          description="The engine runs automatically when sufficient clinical data is available. You can also manually report events using the button above."
        />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Type</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Patient</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Organism</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Outcome</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Investigated</th>
                </tr>
              </thead>
              <tbody>
                {(allEvents ?? []).map((event) => {
                  const patient = event.patient as Record<string, unknown> | null;
                  const iType = event.infection_type as InfectionType;
                  const outcome = event.outcome as InfectionOutcome | null;

                  return (
                    <tr key={event.id as string} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{event.detection_date as string}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${INFECTION_COLORS[iType]}`}>
                          {INFECTION_LABELS[iType]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {patient ? `${patient.first_name} ${patient.last_name}` : '--'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{(event.organism as string) || '--'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 capitalize">
                        {((event.detection_source as string) || '--').replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3">
                        {outcome ? (
                          <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium capitalize ${OUTCOME_COLORS[outcome]}`}>
                            {outcome}
                          </span>
                        ) : '--'}
                      </td>
                      <td className="px-4 py-3">
                        {event.investigated ? (
                          <span className="text-green-600 text-xs font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InfectionControlDashboard() {
  return (
    <RoleGuard module="brain">
      <InfectionControlInner />
    </RoleGuard>
  );
}
