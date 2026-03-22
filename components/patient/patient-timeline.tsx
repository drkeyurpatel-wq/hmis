'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';
import {
  UserPlus, Calendar, Stethoscope, FlaskConical, Pill, ScanLine,
  BedDouble, Scissors, CreditCard, Heart, FileText, Activity, LogOut, AlertTriangle,
} from 'lucide-react';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  icon: any;
  color: string; // tailwind bg class
  iconColor: string;
  time: Date;
  metadata?: Record<string, any>;
}

const EVENT_STYLES: Record<string, { icon: any; color: string; iconColor: string }> = {
  registration: { icon: UserPlus, color: 'bg-teal-100', iconColor: 'text-teal-700' },
  opd_visit: { icon: Calendar, color: 'bg-blue-100', iconColor: 'text-blue-700' },
  encounter: { icon: Stethoscope, color: 'bg-purple-100', iconColor: 'text-purple-700' },
  lab_ordered: { icon: FlaskConical, color: 'bg-cyan-100', iconColor: 'text-cyan-700' },
  lab_result: { icon: FlaskConical, color: 'bg-cyan-50', iconColor: 'text-cyan-600' },
  prescription: { icon: Pill, color: 'bg-amber-100', iconColor: 'text-amber-700' },
  radiology: { icon: ScanLine, color: 'bg-indigo-100', iconColor: 'text-indigo-700' },
  admission: { icon: BedDouble, color: 'bg-purple-100', iconColor: 'text-purple-700' },
  surgery: { icon: Scissors, color: 'bg-rose-100', iconColor: 'text-rose-700' },
  billing: { icon: CreditCard, color: 'bg-emerald-100', iconColor: 'text-emerald-700' },
  vitals: { icon: Activity, color: 'bg-pink-50', iconColor: 'text-pink-600' },
  discharge: { icon: LogOut, color: 'bg-teal-50', iconColor: 'text-teal-600' },
  er_visit: { icon: AlertTriangle, color: 'bg-red-100', iconColor: 'text-red-700' },
  teleconsult: { icon: Stethoscope, color: 'bg-teal-100', iconColor: 'text-teal-700' },
};

export function PatientTimeline({ patientId }: { patientId: string }) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const load = useCallback(async () => {
    if (!patientId || !sb()) return;
    setLoading(true);
    const items: TimelineEvent[] = [];

    try {
      const [patient, visits, encounters, labOrders, radOrders, admissions, otBookings, bills, erVisits, teleconsults] = await Promise.all([
        sb().from('hmis_patients').select('created_at, first_name, last_name, uhid').eq('id', patientId).single(),
        sb().from('hmis_opd_visits').select('id, visit_number, chief_complaint, status, created_at, doctor:hmis_staff!inner(full_name)').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(50),
        sb().from('hmis_emr_encounters').select('id, encounter_type, chief_complaints, diagnoses, prescriptions, created_at, doctor:hmis_staff!hmis_emr_encounters_doctor_id_fkey(full_name)').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(30),
        sb().from('hmis_lab_orders').select('id, test_name, status, result_value, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(30),
        sb().from('hmis_radiology_orders').select('id, study_description, status, created_at').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20),
        sb().from('hmis_admissions').select('id, ipd_number, admission_date, discharge_date, status, department_id').eq('patient_id', patientId).order('admission_date', { ascending: false }).limit(10),
        sb().from('hmis_ot_bookings').select('id, procedure_name, scheduled_date, status, surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name)').eq('patient_id', patientId).order('scheduled_date', { ascending: false }).limit(10),
        sb().from('hmis_bills').select('id, bill_number, net_amount, paid_amount, status, bill_date').eq('patient_id', patientId).order('created_at', { ascending: false }).limit(20),
        sb().from('hmis_er_visits').select('id, triage_category, chief_complaint, arrival_time, status').eq('patient_id', patientId).order('arrival_time', { ascending: false }).limit(10),
        sb().from('hmis_teleconsults').select('id, chief_complaint, status, scheduled_at, doctor:hmis_staff!hmis_teleconsults_doctor_id_fkey(full_name)').eq('patient_id', patientId).order('scheduled_at', { ascending: false }).limit(10),
      ]);

      // Registration
      if (patient.data) {
        items.push({ id: 'reg', type: 'registration', title: 'Patient Registered', description: `UHID: ${patient.data.uhid}`, time: new Date(patient.data.created_at), ...EVENT_STYLES.registration });
      }

      // OPD Visits
      (visits.data || []).forEach((v: any) => items.push({
        id: `opd-${v.id}`, type: 'opd_visit', title: `OPD Visit — ${v.visit_number || ''}`,
        description: `${v.chief_complaint || 'Consultation'} · Dr. ${v.doctor?.full_name?.split(' ').pop() || ''}`,
        time: new Date(v.created_at), ...EVENT_STYLES.opd_visit,
      }));

      // Encounters
      (encounters.data || []).forEach((e: any) => {
        const dx = Array.isArray(e.diagnoses) && e.diagnoses.length > 0 ? e.diagnoses[0]?.label || '' : '';
        const cc = Array.isArray(e.chief_complaints) ? e.chief_complaints.join(', ') : '';
        items.push({
          id: `enc-${e.id}`, type: 'encounter', title: `Clinical Encounter`,
          description: `${cc || dx || e.encounter_type || 'Encounter'} · Dr. ${e.doctor?.full_name?.split(' ').pop() || ''}`,
          time: new Date(e.created_at), ...EVENT_STYLES.encounter,
          metadata: { prescriptions: e.prescriptions?.length || 0 },
        });
      });

      // Lab
      (labOrders.data || []).forEach((l: any) => items.push({
        id: `lab-${l.id}`, type: l.status === 'completed' ? 'lab_result' : 'lab_ordered',
        title: l.status === 'completed' ? 'Lab Result' : 'Lab Ordered',
        description: `${l.test_name || 'Test'}${l.result_value ? ` — ${l.result_value}` : ''}`,
        time: new Date(l.created_at), ...(l.status === 'completed' ? EVENT_STYLES.lab_result : EVENT_STYLES.lab_ordered),
      }));

      // Radiology
      (radOrders.data || []).forEach((r: any) => items.push({
        id: `rad-${r.id}`, type: 'radiology', title: 'Imaging Study',
        description: r.study_description || 'Radiology', time: new Date(r.created_at), ...EVENT_STYLES.radiology,
      }));

      // Admissions
      (admissions.data || []).forEach((a: any) => {
        items.push({
          id: `adm-${a.id}`, type: 'admission', title: `Admitted — ${a.ipd_number || ''}`,
          description: `IPD Admission`, time: new Date(a.admission_date), ...EVENT_STYLES.admission,
        });
        if (a.discharge_date) items.push({
          id: `dis-${a.id}`, type: 'discharge', title: 'Discharged',
          description: `${a.status === 'discharged' ? 'Normal' : a.status} discharge`, time: new Date(a.discharge_date), ...EVENT_STYLES.discharge,
        });
      });

      // Surgeries
      (otBookings.data || []).forEach((o: any) => items.push({
        id: `ot-${o.id}`, type: 'surgery', title: 'Surgery',
        description: `${o.procedure_name || 'Procedure'} · Dr. ${o.surgeon?.full_name?.split(' ').pop() || ''}`,
        time: new Date(o.scheduled_date + 'T08:00:00'), ...EVENT_STYLES.surgery,
      }));

      // Bills
      (bills.data || []).forEach((b: any) => items.push({
        id: `bill-${b.id}`, type: 'billing', title: `Bill ${b.bill_number || ''}`,
        description: `₹${Math.round(parseFloat(b.net_amount || 0)).toLocaleString('en-IN')} · ${b.status}`,
        time: new Date(b.bill_date + 'T12:00:00'), ...EVENT_STYLES.billing,
      }));

      // ER
      (erVisits.data || []).forEach((e: any) => items.push({
        id: `er-${e.id}`, type: 'er_visit', title: `ER Visit — ${(e.triage_category || '').toUpperCase()}`,
        description: e.chief_complaint || 'Emergency', time: new Date(e.arrival_time), ...EVENT_STYLES.er_visit,
      }));

      // Teleconsults
      (teleconsults.data || []).forEach((t: any) => items.push({
        id: `tele-${t.id}`, type: 'teleconsult', title: 'Teleconsult',
        description: `${t.chief_complaint || 'Video consultation'} · Dr. ${t.doctor?.full_name?.split(' ').pop() || ''}`,
        time: new Date(t.scheduled_at), ...EVENT_STYLES.teleconsult,
      }));

    } catch (e) { console.error('Timeline load error:', e); }

    items.sort((a, b) => b.time.getTime() - a.time.getTime());
    setEvents(items);
    setLoading(false);
  }, [patientId]);

  useEffect(() => { load(); }, [load]);

  const filtered = filter === 'all' ? events : events.filter(e => e.type === filter || (filter === 'lab' && (e.type === 'lab_ordered' || e.type === 'lab_result')));
  const types = [...new Set(events.map(e => e.type))];

  if (loading) return <div className="animate-pulse space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}</div>;

  return (
    <div className="space-y-3">
      {/* Filter pills */}
      <div className="flex gap-1 flex-wrap">
        <button onClick={() => setFilter('all')} className={`px-2.5 py-1 text-[10px] font-medium rounded-lg ${filter === 'all' ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>All ({events.length})</button>
        {types.map(t => {
          const s = EVENT_STYLES[t];
          return <button key={t} onClick={() => setFilter(t)} className={`px-2.5 py-1 text-[10px] font-medium rounded-lg capitalize ${filter === t ? 'bg-teal-50 text-teal-700 border border-teal-200' : 'bg-gray-50 text-gray-500'}`}>{t.replace('_', ' ')}</button>;
        })}
      </div>

      {/* Timeline */}
      <div className="relative pl-8">
        {/* Vertical line */}
        <div className="absolute left-[15px] top-0 bottom-0 w-[2px] bg-gray-100" />

        {filtered.map((event, i) => {
          const Icon = event.icon;
          const showDate = i === 0 || filtered[i - 1].time.toDateString() !== event.time.toDateString();
          return (
            <React.Fragment key={event.id}>
              {showDate && (
                <div className="relative -left-8 mb-2 mt-4 first:mt-0">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider bg-white pr-3">
                    {event.time.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
              )}
              <div className="relative mb-3 flex items-start gap-3">
                {/* Dot */}
                <div className={`absolute -left-8 w-[30px] h-[30px] rounded-full ${event.color} flex items-center justify-center z-10 border-2 border-white`}>
                  <Icon size={13} className={event.iconColor} />
                </div>
                {/* Content */}
                <div className="bg-white rounded-xl border border-gray-100 p-3 flex-1 hover:shadow-sm transition-shadow">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-800">{event.title}</span>
                    <span className="text-[9px] text-gray-400">{event.time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{event.description}</div>
                  {event.metadata && event.metadata.prescriptions && event.metadata.prescriptions > 0 && <span className="text-[9px] text-amber-600 mt-0.5 inline-block">{event.metadata.prescriptions} prescriptions</span>}
                </div>
              </div>
            </React.Fragment>
          );
        })}
        {filtered.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">No events found</div>}
      </div>
    </div>
  );
}
