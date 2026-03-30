// lib/alerts/safety-ticker-hooks.ts
// Real-time clinical safety ticker — polls every 30s

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface TickerItem {
  id: string;
  type: 'critical_lab' | 'overdue_med' | 'news2_high' | 'pending_discharge' | 'nurse_call' | 'vital_abnormal';
  severity: 'critical' | 'high' | 'medium';
  patientName: string;
  bedLabel?: string;
  title: string;
  detail: string;
  action: string;
  timestamp: string;
}

export interface TickerCounts {
  criticalLabs: number;
  overdueMeds: number;
  news2High: number;
  pendingDischarge: number;
  nurseCalls: number;
  total: number;
}

export function useSafetyTicker(centreId: string | null, staffType: string | null) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [counts, setCounts] = useState<TickerCounts>({
    criticalLabs: 0, overdueMeds: 0, news2High: 0,
    pendingDischarge: 0, nurseCalls: 0, total: 0,
  });
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    const allItems: TickerItem[] = [];

    try {
      // 1. CRITICAL LABS — completed in last 24h with critical results
      const { data: critLabs } = await sb().from('hmis_lab_orders')
        .select('id, test_name, patient_id, patient:hmis_patients!inner(first_name, last_name)')
        .eq('centre_id', centreId).eq('status', 'completed')
        .gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
        .limit(50);

      for (const lab of critLabs || []) {
        // Check if this lab has critical results
        const { data: results } = await sb().from('hmis_lab_results')
          .select('parameter_name, result_value, is_critical')
          .eq('lab_order_id', lab.id).eq('is_critical', true).limit(5);

        if (results && results.length > 0) {
          const pt = lab.patient as any;
          const paramSummary = results.map((r: any) => `${r.parameter_name}: ${r.result_value}`).join(', ');
          allItems.push({
            id: `lab-${lab.id}`, type: 'critical_lab', severity: 'critical',
            patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            title: `Critical: ${lab.test_name}`, detail: paramSummary,
            action: `/patients/${lab.patient_id}`, timestamp: new Date().toISOString(),
          });
        }
      }

      // 2. OVERDUE MEDS — MAR entries past due, join through medication_order for drug name
      const { data: overdueMar } = await sb().from('hmis_mar')
        .select(`id, scheduled_time, status,
          medication_order:hmis_ipd_medication_orders!inner(drug_name,
            admission:hmis_admissions!inner(id, centre_id, 
              patient:hmis_patients!inner(id, first_name, last_name)))`)
        .eq('status', 'scheduled')
        .lt('scheduled_time', new Date().toISOString())
        .gte('scheduled_time', new Date(Date.now() - 4 * 3600000).toISOString())
        .limit(30);

      for (const mar of overdueMar || []) {
        const medOrder = mar.medication_order as any;
        const adm = medOrder?.admission;
        const pt = adm?.patient;
        if (!pt || adm?.centre_id !== centreId) continue;
        allItems.push({
          id: `med-${mar.id}`, type: 'overdue_med', severity: 'high',
          patientName: `${pt.first_name} ${pt.last_name}`.trim(),
          title: `Overdue: ${medOrder.drug_name}`,
          detail: `Due at ${new Date(mar.scheduled_time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`,
          action: `/ipd/${adm.id}?tab=mar`, timestamp: mar.scheduled_time,
        });
      }

      // 3. PENDING DISCHARGES
      const { data: pendingDisch } = await sb().from('hmis_admissions')
        .select('id, ipd_number, patient:hmis_patients!inner(id, first_name, last_name)')
        .eq('centre_id', centreId).eq('status', 'discharge_initiated').limit(20);

      for (const adm of pendingDisch || []) {
        const pt = adm.patient as any;
        allItems.push({
          id: `disch-${adm.id}`, type: 'pending_discharge', severity: 'medium',
          patientName: `${pt.first_name} ${pt.last_name}`.trim(),
          title: `Pending discharge`, detail: `IPD: ${adm.ipd_number}`,
          action: `/ipd/${adm.id}?tab=discharge`, timestamp: new Date().toISOString(),
        });
      }

      // 4. ACTIVE NURSE CALLS (PX module)
      const { data: nurseCalls } = await sb().from('hmis_px_nurse_calls')
        .select('id, patient_name, bed_label, ward_name, reason, priority, created_at')
        .eq('centre_id', centreId)
        .in('status', ['pending', 'acknowledged'])
        .order('created_at', { ascending: true }).limit(10);

      for (const nc of nurseCalls || []) {
        allItems.push({
          id: `nc-${nc.id}`, type: 'nurse_call',
          severity: nc.priority === 'emergency' ? 'critical' : nc.priority === 'urgent' ? 'high' : 'medium',
          patientName: nc.patient_name || 'Unknown', bedLabel: nc.bed_label,
          title: `Nurse call: ${nc.reason}`, detail: `${nc.ward_name || ''} Bed ${nc.bed_label || ''}`,
          action: '/px-nursing', timestamp: nc.created_at,
        });
      }

      // 5. CLINICAL ALERTS (NEWS2, vital abnormal) — only if table exists
      try {
        const { data: alerts } = await sb().from('hmis_clinical_alerts')
          .select('id, patient_id, admission_id, title, description, severity, patient:hmis_patients!inner(first_name, last_name)')
          .eq('centre_id', centreId).eq('status', 'active')
          .in('severity', ['critical', 'emergency']).limit(10);

        for (const a of alerts || []) {
          const pt = a.patient as any;
          allItems.push({
            id: `alert-${a.id}`, type: 'news2_high',
            severity: a.severity === 'emergency' ? 'critical' : 'high',
            patientName: `${pt?.first_name || ''} ${pt?.last_name || ''}`.trim(),
            title: a.title, detail: a.description || '',
            action: a.admission_id ? `/ipd/${a.admission_id}` : `/patients/${a.patient_id}`,
            timestamp: new Date().toISOString(),
          });
        }
      } catch { /* Table may not exist yet — graceful fallback */ }

      // Sort: critical first, then high, then timestamp
      const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2 };
      allItems.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));

      setItems(allItems);
      setCounts({
        criticalLabs: allItems.filter(i => i.type === 'critical_lab').length,
        overdueMeds: allItems.filter(i => i.type === 'overdue_med').length,
        news2High: allItems.filter(i => i.type === 'news2_high').length,
        pendingDischarge: allItems.filter(i => i.type === 'pending_discharge').length,
        nurseCalls: allItems.filter(i => i.type === 'nurse_call').length,
        total: allItems.length,
      });
    } catch (err) {
      console.error('Safety ticker error:', err);
    } finally {
      setLoading(false);
    }
  }, [centreId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30000);
    return () => clearInterval(intervalRef.current);
  }, [load]);

  return { items, counts, loading, refresh: load };
}
