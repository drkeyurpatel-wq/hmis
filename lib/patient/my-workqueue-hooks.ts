'use client';
// lib/patient/my-workqueue-hooks.ts
// Loads the work queue for the current user based on their role.
// Doctor sees: OPD queue + IPD patients + results to review
// Nurse sees: ward patients + vitals due + meds to give + tasks
// Receptionist sees: appointments + walk-ins + registrations
// Admin sees: alerts + revenue + occupancy

import { useState, useCallback, useEffect } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface WorkItem {
  id: string;
  type: 'opd_patient' | 'ipd_patient' | 'vitals_due' | 'meds_due' | 'lab_result' | 'rad_result' | 'critical_alert' | 'pending_discharge' | 'pending_approval';
  patientId: string;
  patientName: string;
  patientUhid: string;
  title: string;
  subtitle?: string;
  urgency: 'routine' | 'urgent' | 'critical';
  action: string; // URL to navigate to
  actionLabel: string;
  timestamp: string;
  meta?: Record<string, any>;
}

export function useMyWorkQueue(centreId: string | null, staffId: string | null, staffType: string | null) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, urgent: 0, critical: 0, completed: 0 });

  const load = useCallback(async () => {
    if (!centreId || !staffId || !sb()) { setLoading(false); return; }
    setLoading(true);
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const items: WorkItem[] = [];

    // ============================================================
    // DOCTOR WORK QUEUE
    // ============================================================
    if (staffType === 'doctor' || staffType === 'consultant' || staffType === 'admin') {
      // My OPD patients (waiting + checked_in + with_doctor)
      const { data: opdVisits } = await sb().from('hmis_opd_visits')
        .select('id, token_number, status, chief_complaint, check_in_time, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender)')
        .eq('centre_id', centreId).eq('doctor_id', staffId)
        .in('status', ['waiting', 'checked_in', 'with_doctor'])
        .order('token_number', { ascending: true });

      for (const v of opdVisits || []) {
        const pt = v.patient as any;
        items.push({
          id: `opd-${v.id}`, type: 'opd_patient', patientId: pt.id,
          patientName: `${pt.first_name} ${pt.last_name || ''}`, patientUhid: pt.uhid,
          title: `T${v.token_number} — ${v.chief_complaint || 'OPD Consult'}`,
          subtitle: v.status === 'waiting' ? 'Waiting' : v.status === 'checked_in' ? 'Checked in' : 'In progress',
          urgency: 'routine',
          action: `/emr-v2?patient=${pt.id}&visit=${v.id}`,
          actionLabel: 'Consult',
          timestamp: v.check_in_time || now.toISOString(),
        });
      }

      // My IPD patients
      const { data: myIPD } = await sb().from('hmis_admissions')
        .select('id, ipd_number, admission_date, provisional_diagnosis, status, patient:hmis_patients!inner(id, uhid, first_name, last_name, age_years, gender), bed:hmis_beds(bed_number)')
        .eq('centre_id', centreId).eq('primary_doctor_id', staffId).eq('status', 'active');

      for (const a of myIPD || []) {
        const pt = a.patient as any;
        const bed = a.bed as any;
        const days = Math.ceil((now.getTime() - new Date(a.admission_date).getTime()) / 86400000);
        items.push({
          id: `ipd-${a.id}`, type: 'ipd_patient', patientId: pt.id,
          patientName: `${pt.first_name} ${pt.last_name || ''}`, patientUhid: pt.uhid,
          title: `${a.ipd_number} — ${a.provisional_diagnosis || 'IPD'}`,
          subtitle: `Bed ${bed?.bed_number || '?'} · Day ${days}`,
          urgency: days > 7 ? 'urgent' : 'routine',
          action: `/patients/${pt.id}`,
          actionLabel: 'View',
          timestamp: a.admission_date,
        });
      }

      // Pending lab results to review (my patients)
      const { data: pendingLabs } = await sb().from('hmis_lab_orders')
        .select('id, test_name, status, ordered_at, patient:hmis_patients!inner(id, uhid, first_name, last_name)')
        .eq('centre_id', centreId).eq('ordered_by', staffId)
        .in('status', ['reported', 'verified'])
        .order('ordered_at', { ascending: false }).limit(10);

      for (const lab of pendingLabs || []) {
        const pt = lab.patient as any;
        items.push({
          id: `lab-${lab.id}`, type: 'lab_result', patientId: pt.id,
          patientName: `${pt.first_name} ${pt.last_name || ''}`, patientUhid: pt.uhid,
          title: `${lab.test_name} — ${lab.status}`,
          urgency: 'routine',
          action: `/patients/${pt.id}`,
          actionLabel: 'Review',
          timestamp: lab.ordered_at,
        });
      }
    }

    // ============================================================
    // NURSE WORK QUEUE
    // ============================================================
    if (staffType === 'nurse' || staffType === 'admin') {
      // All admitted patients at my centre — vitals + meds due
      const { data: admitted } = await sb().from('hmis_admissions')
        .select('id, ipd_number, admission_date, patient:hmis_patients!inner(id, uhid, first_name, last_name), bed:hmis_beds(bed_number, room:hmis_rooms(ward:hmis_wards(name, type)))')
        .eq('centre_id', centreId).eq('status', 'active');

      for (const a of admitted || []) {
        const pt = a.patient as any;
        const bed = a.bed as any;
        const ward = bed?.room?.ward as any;

        // Check latest vitals
        const { data: lastVitals } = await sb().from('hmis_vitals')
          .select('recorded_at').eq('patient_id', pt.id)
          .order('recorded_at', { ascending: false }).limit(1).maybeSingle();

        const vitalsAge = lastVitals ? (now.getTime() - new Date(lastVitals.recorded_at).getTime()) / 3600000 : 999;
        const isICU = ward?.type === 'icu' || ward?.type === 'transplant_icu';
        const vitalsDueThreshold = isICU ? 1 : 4; // ICU: every hour, ward: every 4 hours

        if (vitalsAge > vitalsDueThreshold) {
          items.push({
            id: `vitals-${a.id}`, type: 'vitals_due', patientId: pt.id,
            patientName: `${pt.first_name} ${pt.last_name || ''}`, patientUhid: pt.uhid,
            title: `Vitals due — ${vitalsAge > 24 ? 'No vitals recorded' : `Last ${Math.round(vitalsAge)}h ago`}`,
            subtitle: `Bed ${bed?.bed_number || '?'} · ${ward?.name || ''}`,
            urgency: vitalsAge > 8 ? 'critical' : vitalsAge > vitalsDueThreshold * 2 ? 'urgent' : 'routine',
            action: `/patients/${pt.id}`,
            actionLabel: 'Record',
            timestamp: lastVitals?.recorded_at || a.admission_date,
          });
        }

        // Check meds due
        const { data: medsDue, count: medsCount } = await sb().from('hmis_mar')
          .select('id', { count: 'exact', head: true })
          .eq('admission_id', a.id).in('status', ['due', 'overdue']);

        if (medsCount && medsCount > 0) {
          items.push({
            id: `meds-${a.id}`, type: 'meds_due', patientId: pt.id,
            patientName: `${pt.first_name} ${pt.last_name || ''}`, patientUhid: pt.uhid,
            title: `${medsCount} medication${medsCount > 1 ? 's' : ''} due`,
            subtitle: `Bed ${bed?.bed_number || '?'} · ${ward?.name || ''}`,
            urgency: medsCount > 3 ? 'urgent' : 'routine',
            action: `/patients/${pt.id}`,
            actionLabel: 'Administer',
            timestamp: now.toISOString(),
          });
        }
      }
    }

    // ============================================================
    // CRITICAL ALERTS (all roles)
    // ============================================================
    const { data: criticals } = await sb().from('hmis_lab_critical_alerts')
      .select('id, parameter_name, result_value, created_at, patient_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(5);

    for (const c of criticals || []) {
      const { data: pt } = await sb().from('hmis_patients').select('uhid, first_name, last_name').eq('id', c.patient_id).single();
      if (pt) {
        items.push({
          id: `crit-${c.id}`, type: 'critical_alert', patientId: c.patient_id,
          patientName: `${pt.first_name} ${pt.last_name || ''}`, patientUhid: pt.uhid,
          title: `! CRITICAL: ${c.parameter_name} = ${c.result_value}`,
          urgency: 'critical',
          action: `/patients/${c.patient_id}`,
          actionLabel: 'Respond',
          timestamp: c.created_at,
        });
      }
    }

    // Sort: critical first, then urgent, then by timestamp
    items.sort((a, b) => {
      const urgencyOrder: Record<string, number> = { critical: 0, urgent: 1, routine: 2 };
      const diff = (urgencyOrder[a.urgency] || 2) - (urgencyOrder[b.urgency] || 2);
      if (diff !== 0) return diff;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setItems(items);
    setStats({
      total: items.length,
      urgent: items.filter(i => i.urgency === 'urgent').length,
      critical: items.filter(i => i.urgency === 'critical').length,
      completed: 0,
    });
    setLoading(false);
  }, [centreId, staffId, staffType]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 90s
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { const i = setInterval(load, 90000); return () => clearInterval(i); }, [load]);

  return { items, loading, stats, reload: load };
}
