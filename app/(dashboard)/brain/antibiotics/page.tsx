'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth';
import { useSupabaseQuery, useSupabaseMutation } from '@/lib/hooks/use-supabase-query';
import { TableSkeleton, EmptyState, CardSkeleton, RoleGuard } from '@/components/ui/shared';
import { ArrowLeft, Pill } from 'lucide-react';
import type { AlertSeverity, AlertStatus, AntibioticAlertType } from '@/types/database';

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: 'bg-blue-100 text-blue-700',
  warning: 'bg-amber-100 text-amber-700',
  critical: 'bg-red-100 text-red-700',
};

const ALERT_LABELS: Record<AntibioticAlertType, string> = {
  duration_exceeded: 'Duration >7d',
  broad_spectrum_no_culture: 'Broad Spectrum, No C&S',
  escalation_no_justification: 'Unjustified Escalation',
  duplicate_class: 'Duplicate Class',
  renal_dose_adjustment: 'Renal Dose Needed',
  antibiotic_allergy_risk: 'Allergy Risk',
  iv_to_oral_opportunity: 'IV-to-Oral Switch',
  prophylaxis_exceeded: 'Prophylaxis >24h',
  restricted_antibiotic: 'Restricted Antibiotic',
  no_deescalation: 'No De-escalation',
};

function AntibioticStewardshipInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { data: alerts, isLoading, error, isEmpty, refetch } = useSupabaseQuery(
    (sb) => sb.from('brain_antibiotic_alerts')
      .select('*, patient:hmis_patients(id, uhid, first_name, last_name), prescribing_doctor:hmis_staff(id, full_name)')
      .eq('centre_id', centreId)
      .eq('status', statusFilter)
      .order('created_at', { ascending: false })
      .limit(200),
    [centreId, statusFilter],
    { enabled: !!centreId }
  );

  const { data: usageData } = useSupabaseQuery(
    (sb) => sb.from('brain_antibiotic_usage')
      .select('*')
      .eq('centre_id', centreId)
      .order('month', { ascending: false })
      .limit(6),
    [centreId],
    { enabled: !!centreId }
  );

  const { mutate: updateAlert, isMutating } = useSupabaseMutation(
    (sb, input: { id: string; status: string; resolution_note?: string }) =>
      sb.from('brain_antibiotic_alerts')
        .update({ status: input.status, resolved_at: new Date().toISOString(), resolution_note: input.resolution_note })
        .eq('id', input.id),
    { onSuccess: () => refetch() }
  );

  const allAlerts = alerts as Array<Record<string, unknown>> | null;

  // Alert type distribution
  const typeCounts: Record<string, number> = {};
  allAlerts?.forEach((a) => {
    const t = a.alert_type as string;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  const severityCounts = { info: 0, warning: 0, critical: 0 };
  allAlerts?.forEach((a) => {
    const s = a.severity as AlertSeverity;
    if (s in severityCounts) severityCounts[s]++;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/brain" className="p-2 hover:bg-gray-100 rounded-lg cursor-pointer">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Antibiotic Stewardship</h1>
          <p className="text-sm text-gray-500">Monitor prescribing patterns and stewardship compliance</p>
        </div>
      </div>

      {/* Severity Summary */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Critical</div>
            <div className="text-2xl font-bold text-red-600">{severityCounts.critical}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Warning</div>
            <div className="text-2xl font-bold text-amber-600">{severityCounts.warning}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 mb-1">Info</div>
            <div className="text-2xl font-bold text-blue-600">{severityCounts.info}</div>
          </div>
        </div>
      )}

      {/* Alert Type Breakdown */}
      {!isLoading && Object.keys(typeCounts).length > 0 && (
        <div className="bg-white rounded-xl border p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Alert Type Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(typeCounts)
              .sort(([, a], [, b]) => b - a)
              .map(([type, count]) => {
                const maxCount = Math.max(...Object.values(typeCounts));
                return (
                  <div key={type} className="flex items-center gap-3">
                    <div className="w-40 text-xs text-gray-600 truncate">
                      {ALERT_LABELS[type as AntibioticAlertType] || type}
                    </div>
                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-300"
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <div className="text-xs font-medium text-gray-700 w-8 text-right">{count}</div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Status Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500">Status:</span>
        {(['active', 'acknowledged', 'resolved', 'overridden'] as AlertStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 text-xs rounded-full cursor-pointer capitalize ${statusFilter === s ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Alerts Table */}
      {isLoading ? (
        <TableSkeleton rows={8} cols={6} />
      ) : isEmpty ? (
        <EmptyState
          title="No antibiotic alerts generated yet"
          description="The engine runs automatically when sufficient clinical data is available. Alerts are generated from active antibiotic prescriptions."
        />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-4 py-3 font-medium text-gray-600">Patient</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Alert Type</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Drug</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Severity</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Doctor</th>
                  <th className="px-4 py-3 font-medium text-gray-600">Recommendation</th>
                  {statusFilter === 'active' && <th className="px-4 py-3 font-medium text-gray-600">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {(allAlerts ?? []).map((alert) => {
                  const patient = alert.patient as Record<string, unknown> | null;
                  const doctor = alert.prescribing_doctor as Record<string, unknown> | null;

                  return (
                    <tr key={alert.id as string} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {patient ? `${patient.first_name} ${patient.last_name}` : '--'}
                        </div>
                        <div className="text-xs text-gray-400">{patient?.uhid as string}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium">
                          {ALERT_LABELS[alert.alert_type as AntibioticAlertType] || (alert.alert_type as string)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{alert.drug_name as string}</div>
                        <div className="text-xs text-gray-400">{alert.drug_class as string}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${SEVERITY_COLORS[alert.severity as AlertSeverity]}`}>
                          {alert.severity as string}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {doctor?.full_name as string || '--'}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs">
                        {alert.recommendation as string}
                      </td>
                      {statusFilter === 'active' && (
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button
                              onClick={() => updateAlert({ id: alert.id as string, status: 'acknowledged' })}
                              disabled={isMutating}
                              className="px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded cursor-pointer hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Acknowledge
                            </button>
                            <button
                              onClick={() => {
                                const note = window.prompt('Resolution note:');
                                if (note !== null) updateAlert({ id: alert.id as string, status: 'resolved', resolution_note: note || 'Resolved' });
                              }}
                              disabled={isMutating}
                              className="px-2 py-1 text-xs bg-green-50 text-green-600 rounded cursor-pointer hover:bg-green-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Resolve
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Usage Trends */}
      {usageData && (usageData as Array<Record<string, unknown>>).length > 0 && (
        <div className="bg-white rounded-xl border p-4 mt-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Monthly Antibiotic Usage</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-left">
                  <th className="px-3 py-2 font-medium text-gray-600">Month</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Usage Rate</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Avg Duration</th>
                  <th className="px-3 py-2 font-medium text-gray-600">Culture First Rate</th>
                  <th className="px-3 py-2 font-medium text-gray-600">DDD/100 Bed-Days</th>
                </tr>
              </thead>
              <tbody>
                {(usageData as Array<Record<string, unknown>>).map((row) => (
                  <tr key={row.id as string} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium">{row.month as string}</td>
                    <td className="px-3 py-2">{row.antibiotic_usage_rate as number}%</td>
                    <td className="px-3 py-2">{row.avg_duration_days as number}d</td>
                    <td className="px-3 py-2">{row.culture_before_antibiotic_rate as number}%</td>
                    <td className="px-3 py-2">{row.ddd_per_100_bed_days as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AntibioticStewardshipDashboard() {
  return (
    <RoleGuard module="brain">
      <AntibioticStewardshipInner />
    </RoleGuard>
  );
}
