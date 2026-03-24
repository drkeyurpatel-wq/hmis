// lib/alerts/safety-ticker-hooks.ts
// Real-time clinical safety ticker — polls every 30s for critical items across the centre

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface TickerItem {
  id: string;
  type: 'critical_lab' | 'overdue_med' | 'news2_high' | 'pending_discharge' | 'nurse_call' | 'vital_abnormal' | 'pending_consent';
  severity: 'critical' | 'high' | 'medium';
  patientId: string;
  patientName: string;
  admissionId?: string;
  bedLabel?: string;
  title: string;
  detail: string;
  action: string; // URL to navigate to
  timestamp: string;
}

export interface TickerCounts {
  criticalLabs: number;
  overdueMeds: number;
  news2High: number;
  pendingDischarge: number;
  nurseCalls: number;
  vitalAbnormal: number;
  total: number;
}

export function useSafetyTicker(centreId: string | null, staffType: string | null) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [counts, setCounts] = useState<TickerCounts>({
    criticalLabs: 0, overdueMeds: 0, news2High: 0,
    pendingDischarge: 0, nurseCalls: 0, vitalAbnormal: 0, total: 0,
  });
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;

    const allItems: TickerItem[] = [];
    const today = new Date().toISOString().split('T')[0];

    try {
      // 1. CRITICAL LABS — unacknowledged critical/abnormal results
      const { data: critLabs } = await sb()!.from('hmis_lab_orders')
        .select('id, test_name, patient_id, patient:hmis_patients!inner(first_name, last_name, uhid), results:hmis_lab_results(parameter_name, result_value, is_critical, is_abnormal)')
        .eq('centre_id', centreId)
        .eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
        .limit(50);

      for (const lab of critLabs || []) {
        const critResults = (lab.results || []).filter((r: any) => r.is_critical);
        if (critResults.length > 0) {
          const pt = lab.patient as any;
          const paramSummary = critResults.map((r: any) => `${r.parameter_name}: ${r.result_value}`).join(', ');
          allItems.push({
            id: `lab-${lab.id}`, type: 'critical_lab', severity: 'critical',
            patientId: lab.patient_id, patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            title: `Critical: ${lab.test_name}`, detail: paramSummary,
            action: `/patients/${lab.patient_id}`, timestamp: lab.created_at || new Date().toISOString(),
          });
        }
      }

      // 2. OVERDUE MEDICATIONS — MAR entries past due time
      const { data: overdueMeds } = await sb()!.from('hmis_mar')
        .select('id, drug_name, scheduled_time, admission:hmis_admissions!inner(id, bed_id, patient:hmis_patients!inner(id, first_name, last_name))')
        .eq('centre_id', centreId)
        .eq('status', 'scheduled')
        .lt('scheduled_time', new Date().toISOString())
        .gte('scheduled_time', new Date(Date.now() - 4 * 3600000).toISOString())
        .limit(30);

      for (const med of overdueMeds || []) {
        const adm = med.admission as any;
        const pt = adm?.patient;
        if (!pt) continue;
        allItems.push({
          id: `med-${med.id}`, type: 'overdue_med', severity: 'high',
          patientId: pt.id, patientName: `${pt.first_name} ${pt.last_name}`.trim(),
          admissionId: adm.id,
          title: `Overdue: ${med.drug_name}`, detail: `Due at ${new Date(med.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
          action: `/ipd/${adm.id}?tab=mar`, timestamp: med.scheduled_time,
        });
      }

      // 3. PENDING DISCHARGES — discharge initiated but not completed (>4 hours)
      const { data: pendingDisch } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, patient:hmis_patients!inner(id, first_name, last_name, uhid)')
        .eq('centre_id', centreId)
        .eq('status', 'discharge_initiated')
        .limit(20);

      for (const adm of pendingDisch || []) {
        const pt = adm.patient as any;
        allItems.push({
          id: `disch-${adm.id}`, type: 'pending_discharge', severity: 'medium',
          patientId: pt.id, patientName: `${pt.first_name} ${pt.last_name}`.trim(),
          admissionId: adm.id,
          title: `Pending discharge`, detail: `IPD: ${adm.ipd_number}`,
          action: `/ipd/${adm.id}?tab=discharge`, timestamp: new Date().toISOString(),
        });
      }

      // 4. ACTIVE NURSE CALLS (from PX module)
      const { data: nurseCalls } = await sb()!.from('hmis_px_nurse_calls')
        .select('id, patient_name, bed_label, ward_name, reason, priority, created_at')
        .eq('centre_id', centreId)
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: true })
        .limit(10);

      for (const nc of nurseCalls || []) {
        allItems.push({
          id: `nc-${nc.id}`, type: 'nurse_call',
          severity: nc.priority === 'emergency' ? 'critical' : nc.priority === 'urgent' ? 'high' : 'medium',
          patientId: '', patientName: nc.patient_name || 'Unknown',
          bedLabel: nc.bed_label,
          title: `Nurse call: ${nc.reason}`, detail: `${nc.ward_name || ''} Bed ${nc.bed_label || ''}`,
          action: '/px-nursing', timestamp: nc.created_at,
        });
      }

      // 5. HIGH NEWS2 SCORES — from recent ICU charts
      const { data: highNews } = await sb()!.from('hmis_clinical_alerts')
        .select('id, patient_id, admission_id, title, description, severity, data, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId)
        .eq('alert_type', 'news2_high')
        .eq('status', 'active')
        .limit(10);

      for (const alert of highNews || []) {
        const pt = alert.patient as any;
        allItems.push({
          id: `news-${alert.id}`, type: 'news2_high', severity: alert.severity === 'emergency' ? 'critical' : 'high',
          patientId: alert.patient_id, patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
          admissionId: alert.admission_id,
          title: alert.title, detail: alert.description,
          action: `/ipd/${alert.admission_id}`, timestamp: new Date().toISOString(),
        });
      }

      // Sort: critical first, then high, then by timestamp
      const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
      allItems.sort((a, b) => {
        const sd = (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9);
        if (sd !== 0) return sd;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setItems(allItems);
      setCounts({
        criticalLabs: allItems.filter(i => i.type === 'critical_lab').length,
        overdueMeds: allItems.filter(i => i.type === 'overdue_med').length,
        news2High: allItems.filter(i => i.type === 'news2_high').length,
        pendingDischarge: allItems.filter(i => i.type === 'pending_discharge').length,
        nurseCalls: allItems.filter(i => i.type === 'nurse_call').length,
        vitalAbnormal: allItems.filter(i => i.type === 'vital_abnormal').length,
        total: allItems.length,
      });
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Safety ticker error:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000); // 30s refresh
    return () => clearInterval(intervalRef.current);
  }, [load]);

  return { items, counts, loading, lastRefresh, refresh: load };
}
