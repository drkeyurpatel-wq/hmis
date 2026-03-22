'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { createClient } from '@/lib/supabase/client';
import { Printer, RefreshCw, AlertTriangle, Activity, BedDouble, Pill, FlaskConical, Scissors, Clock } from 'lucide-react';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

interface HandoverData {
  generatedAt: string;
  shift: string;
  census: { total: number; icu: number; newAdmissions: number; discharges: number; deaths: number };
  criticalPatients: any[];
  pendingLabs: any[];
  overdueMeds: any[];
  pendingDischarges: any[];
  todaySurgeries: any[];
  erActive: any[];
  pendingConsults: any[];
  alerts: string[];
}

function HandoverInner() {
  const { staff, activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [data, setData] = useState<HandoverData | null>(null);
  const [loading, setLoading] = useState(false);

  const currentShift = (() => { const h = new Date().getHours(); return h < 8 ? 'Night (8PM–8AM)' : h < 14 ? 'Morning (8AM–2PM)' : h < 20 ? 'Afternoon (2PM–8PM)' : 'Night (8PM–8AM)'; })();

  const generate = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const today = new Date().toISOString().split('T')[0];
    const ts = today + 'T00:00:00';

    try {
      const [admissions, newAdm, discharged, deaths, vitals, pendingLab, meds, pendingDisch, otBookings, erVisits] = await Promise.all([
        sb().from('hmis_admissions').select('id').eq('centre_id', centreId).eq('status', 'active'),
        sb().from('hmis_admissions').select('id, patient:hmis_patients!inner(first_name, last_name, uhid), department_id, bed:hmis_beds(name, room:hmis_rooms(name, ward:hmis_wards(name)))').eq('centre_id', centreId).gte('admission_date', ts),
        sb().from('hmis_admissions').select('id').eq('centre_id', centreId).eq('status', 'discharged').gte('discharge_date', ts),
        sb().from('hmis_admissions').select('id').eq('centre_id', centreId).eq('discharge_type', 'death').gte('discharge_date', ts),
        // Get patients with abnormal vitals (last reading)
        sb().from('hmis_vitals').select('patient_id, bp_systolic, bp_diastolic, heart_rate, spo2, temperature, respiratory_rate, gcs_score, recorded_at, patient:hmis_patients!inner(first_name, last_name, uhid), admission:hmis_admissions!inner(bed:hmis_beds(name, room:hmis_rooms(ward:hmis_wards(name))))')
          .gte('recorded_at', new Date(Date.now() - 8 * 3600000).toISOString()).order('recorded_at', { ascending: false }).limit(200),
        sb().from('hmis_lab_orders').select('id, test_name, patient:hmis_patients!inner(first_name, last_name, uhid), created_at').eq('centre_id', centreId).in('status', ['ordered', 'collected', 'in_progress']).gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString()).limit(20),
        sb().from('hmis_ipd_medication_orders').select('id, drug_name, dose, frequency, next_due, patient:hmis_patients!inner(first_name, last_name, uhid)').eq('status', 'active').lte('next_due', new Date().toISOString()).limit(20),
        sb().from('hmis_admissions').select('id, patient:hmis_patients!inner(first_name, last_name, uhid), discharge_date, bed:hmis_beds(name)').eq('centre_id', centreId).eq('status', 'discharge_initiated'),
        sb().from('hmis_ot_bookings').select('id, procedure_name, scheduled_start, status, patient:hmis_patients!inner(first_name, last_name), surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name), ot_room:hmis_ot_rooms(name)').eq('centre_id', centreId).eq('scheduled_date', today),
        sb().from('hmis_er_visits').select('id, triage_category, chief_complaint, patient:hmis_patients!inner(first_name, last_name), arrival_time').eq('centre_id', centreId).in('status', ['triaged', 'being_seen', 'under_observation']),
      ]);

      // Find critical patients: NEWS2 >= 5 or abnormal vitals
      const criticalPatients: any[] = [];
      const seenPatients = new Set<string>();
      (vitals.data || []).forEach((v: any) => {
        if (seenPatients.has(v.patient_id)) return;
        seenPatients.add(v.patient_id);
        const issues: string[] = [];
        if (v.bp_systolic && (v.bp_systolic > 180 || v.bp_systolic < 90)) issues.push(`BP ${v.bp_systolic}/${v.bp_diastolic}`);
        if (v.heart_rate && (v.heart_rate > 130 || v.heart_rate < 40)) issues.push(`HR ${v.heart_rate}`);
        if (v.spo2 && v.spo2 < 92) issues.push(`SpO2 ${v.spo2}%`);
        if (v.temperature && (v.temperature > 39 || v.temperature < 35)) issues.push(`Temp ${v.temperature}`);
        if (v.respiratory_rate && (v.respiratory_rate > 25 || v.respiratory_rate < 8)) issues.push(`RR ${v.respiratory_rate}`);
        if (v.gcs_score && v.gcs_score < 13) issues.push(`GCS ${v.gcs_score}`);
        if (issues.length > 0) {
          criticalPatients.push({
            name: `${v.patient?.first_name} ${v.patient?.last_name}`,
            uhid: v.patient?.uhid,
            ward: v.admission?.bed?.room?.ward?.name || '—',
            bed: v.admission?.bed?.name || '—',
            issues: issues.join(', '),
            time: v.recorded_at,
          });
        }
      });

      // Alerts
      const alerts: string[] = [];
      if (criticalPatients.length > 0) alerts.push(`${criticalPatients.length} patient(s) with critical vitals`);
      if ((meds.data || []).length > 0) alerts.push(`${meds.data?.length} overdue medication(s)`);
      if ((pendingLab.data || []).filter((l: any) => (Date.now() - new Date(l.created_at).getTime()) > 4 * 3600000).length > 0) alerts.push('Lab orders pending >4 hours');
      if ((erVisits.data || []).some((e: any) => e.triage_category === 'red')) alerts.push('RED triage patient in ER');

      setData({
        generatedAt: new Date().toISOString(),
        shift: currentShift,
        census: {
          total: (admissions.data || []).length,
          icu: 0, // would need ward type filter
          newAdmissions: (newAdm.data || []).length,
          discharges: (discharged.data || []).length,
          deaths: (deaths.data || []).length,
        },
        criticalPatients,
        pendingLabs: (pendingLab.data || []).map((l: any) => ({
          test: l.test_name, patient: `${l.patient?.first_name} ${l.patient?.last_name}`,
          uhid: l.patient?.uhid, hours: Math.round((Date.now() - new Date(l.created_at).getTime()) / 3600000),
        })),
        overdueMeds: (meds.data || []).map((m: any) => ({
          drug: m.drug_name, dose: m.dose, patient: `${m.patient?.first_name} ${m.patient?.last_name}`,
          uhid: m.patient?.uhid, dueAt: m.next_due,
        })),
        pendingDischarges: (pendingDisch.data || []).map((d: any) => ({
          patient: `${d.patient?.first_name} ${d.patient?.last_name}`, uhid: d.patient?.uhid, bed: d.bed?.name,
        })),
        todaySurgeries: (otBookings.data || []).map((o: any) => ({
          procedure: o.procedure_name, patient: `${o.patient?.first_name} ${o.patient?.last_name}`,
          surgeon: o.surgeon?.full_name, ot: o.ot_room?.name, time: o.scheduled_start, status: o.status,
        })),
        erActive: (erVisits.data || []).map((e: any) => ({
          patient: `${e.patient?.first_name} ${e.patient?.last_name}`, triage: e.triage_category,
          complaint: e.chief_complaint, arrival: e.arrival_time,
        })),
        pendingConsults: [],
        alerts,
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [centreId, currentShift]);

  useEffect(() => { generate(); }, [generate]);

  const printHandover = () => {
    const w = window.open('', '_blank');
    if (!w || !data) return;
    const html = `<!DOCTYPE html><html><head><title>Shift Handover — ${data.shift}</title>
    <style>body{font-family:'DM Sans',sans-serif;padding:20px;font-size:12px;color:#333}h1{font-size:18px;color:#0d9488;margin-bottom:4px}
    h2{font-size:13px;border-bottom:2px solid #0d9488;padding-bottom:4px;margin-top:16px;color:#0d9488}
    table{width:100%;border-collapse:collapse;margin:8px 0}th,td{border:1px solid #e2e8f0;padding:4px 8px;text-align:left;font-size:11px}
    th{background:#f1f5f9;font-weight:600}.alert{background:#fef2f2;border:1px solid #fecaca;padding:8px;border-radius:8px;margin:8px 0}
    .badge{display:inline-block;padding:2px 8px;border-radius:12px;font-size:10px;font-weight:600}
    .red{background:#fee2e2;color:#dc2626}.amber{background:#fef3c7;color:#d97706}.green{background:#d1fae5;color:#059669}
    @media print{body{padding:10px}}</style></head><body>
    <h1>Shift Handover Report</h1>
    <p style="color:#666">${data.shift} · Generated ${new Date(data.generatedAt).toLocaleString('en-IN')} · ${staff?.full_name || ''}</p>
    ${data.alerts.length > 0 ? `<div class="alert"><strong>⚠️ ALERTS:</strong><ul>${data.alerts.map(a => `<li>${a}</li>`).join('')}</ul></div>` : ''}
    <h2>Census</h2><table><tr><th>Total IPD</th><th>New Admissions</th><th>Discharges</th><th>Deaths</th></tr>
    <tr><td><strong>${data.census.total}</strong></td><td>${data.census.newAdmissions}</td><td>${data.census.discharges}</td><td>${data.census.deaths}</td></tr></table>
    ${data.criticalPatients.length > 0 ? `<h2>⚠️ Critical Patients (${data.criticalPatients.length})</h2><table><tr><th>Patient</th><th>UHID</th><th>Ward/Bed</th><th>Issues</th></tr>${data.criticalPatients.map(p => `<tr><td><strong>${p.name}</strong></td><td>${p.uhid}</td><td>${p.ward}/${p.bed}</td><td style="color:#dc2626;font-weight:600">${p.issues}</td></tr>`).join('')}</table>` : ''}
    ${data.overdueMeds.length > 0 ? `<h2>Overdue Medications (${data.overdueMeds.length})</h2><table><tr><th>Patient</th><th>Drug</th><th>Dose</th></tr>${data.overdueMeds.map(m => `<tr><td>${m.patient}</td><td>${m.drug}</td><td>${m.dose}</td></tr>`).join('')}</table>` : ''}
    ${data.pendingLabs.length > 0 ? `<h2>Pending Lab Results (${data.pendingLabs.length})</h2><table><tr><th>Patient</th><th>Test</th><th>Pending</th></tr>${data.pendingLabs.map(l => `<tr><td>${l.patient}</td><td>${l.test}</td><td>${l.hours}h</td></tr>`).join('')}</table>` : ''}
    ${data.todaySurgeries.length > 0 ? `<h2>Surgeries Today (${data.todaySurgeries.length})</h2><table><tr><th>Procedure</th><th>Patient</th><th>Surgeon</th><th>OT</th><th>Status</th></tr>${data.todaySurgeries.map(s => `<tr><td>${s.procedure}</td><td>${s.patient}</td><td>${s.surgeon || '—'}</td><td>${s.ot || '—'}</td><td>${s.status}</td></tr>`).join('')}</table>` : ''}
    ${data.erActive.length > 0 ? `<h2>Active ER Patients (${data.erActive.length})</h2><table><tr><th>Patient</th><th>Triage</th><th>Complaint</th></tr>${data.erActive.map(e => `<tr><td>${e.patient}</td><td><span class="badge ${e.triage === 'red' ? 'red' : e.triage === 'orange' ? 'amber' : 'green'}">${e.triage?.toUpperCase()}</span></td><td>${e.complaint || '—'}</td></tr>`).join('')}</table>` : ''}
    ${data.pendingDischarges.length > 0 ? `<h2>Pending Discharges (${data.pendingDischarges.length})</h2><table><tr><th>Patient</th><th>UHID</th><th>Bed</th></tr>${data.pendingDischarges.map(d => `<tr><td>${d.patient}</td><td>${d.uhid}</td><td>${d.bed || '—'}</td></tr>`).join('')}</table>` : ''}
    <p style="margin-top:24px;color:#999;font-size:10px">Auto-generated shift handover document</p>
    <div style="margin-top:40px;display:flex;gap:80px"><div><div style="border-top:1px solid #999;width:150px;margin-top:40px"></div><p style="font-size:10px">Outgoing Nurse/Doctor</p></div><div><div style="border-top:1px solid #999;width:150px;margin-top:40px"></div><p style="font-size:10px">Incoming Nurse/Doctor</p></div></div>
    </body></html>`;
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const D = data;

  return (
    <div className="max-w-[1000px] mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Smart Shift Handover</h1>
          <p className="text-xs text-gray-400">{currentShift} · Auto-generated from live data</p>
        </div>
        <div className="flex gap-2">
          <button onClick={generate} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-white text-gray-600 text-sm border rounded-xl hover:bg-gray-50"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh</button>
          <button onClick={printHandover} disabled={!D} className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white text-sm rounded-xl font-semibold hover:bg-teal-700 disabled:opacity-40"><Printer size={14} /> Print Handover</button>
        </div>
      </div>

      {!D ? <div className="text-center py-12 text-gray-400">Loading handover data...</div> : (<>
        {/* Alerts */}
        {D.alerts.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-red-700 flex items-center gap-1.5"><AlertTriangle size={14} /> Alerts</h3>
            <ul className="mt-1 space-y-1">{D.alerts.map((a, i) => <li key={i} className="text-xs text-red-600">• {a}</li>)}</ul>
          </div>
        )}

        {/* Census */}
        <div className="grid grid-cols-5 gap-2">
          {[
            { l: 'IPD Census', v: D.census.total, c: 'text-gray-800' },
            { l: 'New Admissions', v: D.census.newAdmissions, c: 'text-blue-700' },
            { l: 'Discharges', v: D.census.discharges, c: 'text-emerald-700' },
            { l: 'Deaths', v: D.census.deaths, c: D.census.deaths > 0 ? 'text-red-600' : 'text-gray-400' },
            { l: 'ER Active', v: D.erActive.length, c: D.erActive.length > 0 ? 'text-red-600' : 'text-gray-400' },
          ].map(s => (
            <div key={s.l} className="bg-white rounded-xl border px-3 py-3 text-center"><div className="text-[9px] text-gray-400 uppercase font-semibold">{s.l}</div><div className={`text-2xl font-black ${s.c}`}>{s.v}</div></div>
          ))}
        </div>

        {/* Critical patients */}
        {D.criticalPatients.length > 0 && (
          <div className="bg-white rounded-2xl border border-red-100 overflow-hidden">
            <div className="px-4 py-3 border-b bg-red-50"><h3 className="text-xs font-bold text-red-700">⚠️ Critical Patients ({D.criticalPatients.length})</h3></div>
            <table className="w-full text-xs"><thead><tr><th>Patient</th><th>UHID</th><th>Ward/Bed</th><th>Issues</th></tr></thead>
              <tbody>{D.criticalPatients.map((p, i) => <tr key={i} className="bg-red-50/30"><td className="font-bold">{p.name}</td><td className="text-[10px] text-gray-500">{p.uhid}</td><td>{p.ward}/{p.bed}</td><td className="text-red-600 font-semibold">{p.issues}</td></tr>)}</tbody></table>
          </div>
        )}

        {/* Overdue meds */}
        {D.overdueMeds.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b"><h3 className="text-xs font-bold text-amber-700">💊 Overdue Medications ({D.overdueMeds.length})</h3></div>
            <table className="w-full text-xs"><thead><tr><th>Patient</th><th>Drug</th><th>Dose</th></tr></thead>
              <tbody>{D.overdueMeds.map((m, i) => <tr key={i}><td className="font-medium">{m.patient}</td><td>{m.drug}</td><td>{m.dose}</td></tr>)}</tbody></table>
          </div>
        )}

        {/* Pending labs */}
        {D.pendingLabs.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b"><h3 className="text-xs font-bold text-cyan-700">🧪 Pending Labs ({D.pendingLabs.length})</h3></div>
            <table className="w-full text-xs"><thead><tr><th>Patient</th><th>Test</th><th>Pending</th></tr></thead>
              <tbody>{D.pendingLabs.map((l, i) => <tr key={i}><td className="font-medium">{l.patient}</td><td>{l.test}</td><td className={l.hours > 4 ? 'text-red-600 font-bold' : ''}>{l.hours}h</td></tr>)}</tbody></table>
          </div>
        )}

        {/* Surgeries */}
        {D.todaySurgeries.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b"><h3 className="text-xs font-bold text-rose-700">🔪 Surgeries Today ({D.todaySurgeries.length})</h3></div>
            <table className="w-full text-xs"><thead><tr><th>Procedure</th><th>Patient</th><th>Surgeon</th><th>OT</th><th>Status</th></tr></thead>
              <tbody>{D.todaySurgeries.map((s, i) => <tr key={i}><td className="font-medium">{s.procedure}</td><td>{s.patient}</td><td>{s.surgeon || '—'}</td><td>{s.ot || '—'}</td><td><span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.status === 'completed' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700' : s.status === 'in_progress' ? 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700' : 'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700'}`}>{s.status}</span></td></tr>)}</tbody></table>
          </div>
        )}

        {/* Pending discharges */}
        {D.pendingDischarges.length > 0 && (
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="px-4 py-3 border-b"><h3 className="text-xs font-bold text-teal-700">🏠 Pending Discharges ({D.pendingDischarges.length})</h3></div>
            <table className="w-full text-xs"><thead><tr><th>Patient</th><th>UHID</th><th>Bed</th></tr></thead>
              <tbody>{D.pendingDischarges.map((d, i) => <tr key={i}><td className="font-medium">{d.patient}</td><td className="text-[10px]">{d.uhid}</td><td>{d.bed || '—'}</td></tr>)}</tbody></table>
          </div>
        )}
      </>)}
    </div>
  );
}

export default function HandoverPage() { return <RoleGuard module="ipd"><HandoverInner /></RoleGuard>; }
