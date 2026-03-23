'use client';
// app/(dashboard)/ward-board/page.tsx
// Real-time ward board — designed for wall-mounted displays at nursing stations
// Shows all beds with live patient info, vitals status, pending meds/tasks

import React, { useState, useEffect, useCallback } from 'react';
import { RoleGuard } from '@/components/ui/shared';
import { useAuthStore } from '@/lib/store/auth';
import { sb } from '@/lib/supabase/browser';
import { Heart, Pill, AlertTriangle, Clock, RefreshCw, BedDouble, Activity } from 'lucide-react';
import Link from 'next/link';

interface BedCard {
  bedId: string; bedNumber: string; roomNumber: string; wardName: string; wardType: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'reserved';
  patient?: { id: string; name: string; uhid: string; age: number; gender: string; ipd: string; daysAdmitted: number; doctor: string; diagnosis: string; payorType: string; };
  vitals?: { hr: number; bp: string; spo2: number; temp: number; news2: number; lastRecorded: string; };
  medsDue: number; labsPending: number; criticalAlerts: number;
}

function WardBoardInner() {
  const { activeCentreId } = useAuthStore();
  const centreId = activeCentreId || '';
  const [wards, setWards] = useState<any[]>([]);
  const [selectedWard, setSelectedWard] = useState('all');
  const [cards, setCards] = useState<BedCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState('');

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);

    // Load wards
    const { data: wardData } = await sb()!.from('hmis_wards').select('id, name, type, floor').eq('centre_id', centreId).eq('is_active', true).order('name');
    setWards(wardData || []);

    // Load all beds with rooms and wards
    let bedQ = sb()!.from('hmis_beds')
      .select('id, bed_number, status, current_admission_id, room:hmis_rooms!inner(room_number, ward:hmis_wards!inner(id, name, type, floor))')
      .eq('is_active', true).eq('room.ward.centre_id', centreId);
    if (selectedWard !== 'all') bedQ = bedQ.eq('room.ward.id', selectedWard);
    const { data: bedData } = await bedQ.order('bed_number');

    // Get all active admissions for this centre
    const admissionIds = (bedData || []).filter((b: any) => b.current_admission_id).map((b: any) => b.current_admission_id);
    let admissionMap: Record<string, any> = {};
    if (admissionIds.length > 0) {
      const { data: adms } = await sb()!.from('hmis_admissions')
        .select('id, ipd_number, admission_date, payor_type, provisional_diagnosis, patient:hmis_patients!inner(id, first_name, last_name, uhid, age_years, gender), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
        .in('id', admissionIds);
      for (const a of adms || []) admissionMap[a.id] = a;
    }

    // Get latest vitals for all admitted patients
    const patientIds = Object.values(admissionMap).map((a: any) => (a.patient as any)?.id).filter(Boolean);
    let vitalsMap: Record<string, any> = {};
    if (patientIds.length > 0) {
      const { data: vitals } = await sb()!.from('hmis_vitals')
        .select('patient_id, heart_rate, systolic_bp, diastolic_bp, spo2, temperature, recorded_at')
        .in('patient_id', patientIds).order('recorded_at', { ascending: false });
      // Keep only latest per patient
      for (const v of vitals || []) {
        if (!vitalsMap[v.patient_id]) vitalsMap[v.patient_id] = v;
      }
    }

    // Get MAR due counts per admission
    let medsDueMap: Record<string, number> = {};
    if (admissionIds.length > 0) {
      const { data: mar } = await sb()!.from('hmis_mar').select('admission_id')
        .in('admission_id', admissionIds).in('status', ['due', 'overdue']);
      for (const m of mar || []) medsDueMap[m.admission_id] = (medsDueMap[m.admission_id] || 0) + 1;
    }

    // Build cards
    const bedCards: BedCard[] = (bedData || []).map((b: any) => {
      const ward = (b.room as any)?.ward as any;
      const adm = b.current_admission_id ? admissionMap[b.current_admission_id] : null;
      const pt = adm ? (adm.patient as any) : null;
      const v = pt ? vitalsMap[pt.id] : null;

      return {
        bedId: b.id, bedNumber: b.bed_number, roomNumber: (b.room as any)?.room_number || '',
        wardName: ward?.name || '', wardType: ward?.type || '',
        status: b.status,
        patient: pt ? {
          id: pt.id, name: `${pt.first_name} ${pt.last_name || ''}`, uhid: pt.uhid,
          age: pt.age_years, gender: pt.gender, ipd: adm.ipd_number,
          daysAdmitted: Math.ceil((Date.now() - new Date(adm.admission_date).getTime()) / 86400000),
          doctor: (adm.doctor as any)?.full_name || '', diagnosis: adm.provisional_diagnosis || '',
          payorType: adm.payor_type || 'self',
        } : undefined,
        vitals: v ? {
          hr: v.heart_rate, bp: v.systolic_bp ? `${v.systolic_bp}/${v.diastolic_bp || '?'}` : '',
          spo2: v.spo2, temp: v.temperature ? Number(v.temperature) : 0,
          news2: 0, lastRecorded: v.recorded_at,
        } : undefined,
        medsDue: b.current_admission_id ? (medsDueMap[b.current_admission_id] || 0) : 0,
        labsPending: 0, criticalAlerts: 0,
      };
    });

    setCards(bedCards);
    setLoading(false);
    setLastRefresh(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
  }, [centreId, selectedWard]);

  useEffect(() => { load(); }, [load]);
  // Auto-refresh every 30s
  useEffect(() => { const i = setInterval(load, 30000); return () => clearInterval(i); }, [load]);

  const vitalsAgo = (d: string) => {
    const mins = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h`;
  };
  const vitalsOverdue = (d: string) => (Date.now() - new Date(d).getTime()) > 4 * 3600000; // >4h

  const occupied = cards.filter(c => c.status === 'occupied');
  const available = cards.filter(c => c.status === 'available');
  const icuCards = occupied.filter(c => c.wardType === 'icu' || c.wardType === 'transplant_icu');

  return (
    <div className="w-full lg:max-w-[1800px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold">Ward Board</h1>
          <p className="text-xs text-gray-500">{occupied.length} occupied · {available.length} available · Refresh: {lastRefresh}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedWard} onChange={(e: any) => setSelectedWard(e.target.value)} className="px-3 py-1.5 border rounded-lg text-sm">
            <option value="all">All Wards</option>
            {wards.map((w: any) => <option key={w.id} value={w.id}>{w.name} ({w.type})</option>)}
          </select>
          <button onClick={load} className="p-2 hover:bg-gray-100 rounded-lg"><RefreshCw size={14} className={loading ? 'animate-spin text-gray-400' : 'text-gray-500'} /></button>
        </div>
      </div>

      {/* Bed Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
        {cards.map((c: any) => (
          <div key={c.bedId} className={`rounded-xl border p-2.5 transition-all ${
            c.status === 'available' ? 'bg-green-50 border-green-200' :
            c.status === 'occupied' ? (c.criticalAlerts > 0 ? 'bg-red-50 border-red-300 ring-2 ring-red-200' :
              c.medsDue > 0 ? 'bg-amber-50 border-amber-200' :
              c.wardType === 'icu' ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200') :
            c.status === 'cleaning' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-100 border-gray-200'
          }`}>
            {/* Bed header */}
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold">{c.bedNumber}</span>
              {c.status === 'available' && <span className="text-[9px] bg-green-200 text-green-800 px-1.5 py-0.5 rounded-full">FREE</span>}
              {c.status === 'cleaning' && <span className="text-[9px] bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded-full">CLEANING</span>}
              {c.wardType === 'icu' && c.status === 'occupied' && <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full">ICU</span>}
            </div>

            {c.patient && (
              <Link href={`/patients/${c.patient.id}`} className="block">
                {/* Patient info */}
                <div className="text-xs font-semibold text-gray-800 truncate">{c.patient.name}</div>
                <div className="text-[10px] text-gray-400">{c.patient.uhid} · D{c.patient.daysAdmitted} · {c.patient.payorType.toUpperCase()}</div>
                <div className="text-[10px] text-gray-500 truncate">{c.patient.doctor}</div>

                {/* Vitals mini */}
                {c.vitals ? (
                  <div className={`mt-1.5 grid grid-cols-3 gap-1 ${c.vitals.lastRecorded && vitalsOverdue(c.vitals.lastRecorded) ? 'opacity-50' : ''}`}>
                    <div className="text-[10px]"><span className="text-gray-400">HR</span> <span className={c.vitals.hr > 100 || c.vitals.hr < 60 ? 'text-red-600 font-bold' : 'font-semibold'}>{c.vitals.hr || '—'}</span></div>
                    <div className="text-[10px]"><span className="text-gray-400">BP</span> <span className="font-semibold">{c.vitals.bp || '—'}</span></div>
                    <div className="text-[10px]"><span className="text-gray-400">O₂</span> <span className={c.vitals.spo2 < 94 ? 'text-red-600 font-bold' : 'font-semibold'}>{c.vitals.spo2 || '—'}</span></div>
                  </div>
                ) : (
                  <div className="mt-1.5 text-[10px] text-red-400">No vitals</div>
                )}
                {c.vitals?.lastRecorded && <div className="text-[9px] text-gray-400 mt-0.5">{vitalsAgo(c.vitals.lastRecorded)} ago{vitalsOverdue(c.vitals.lastRecorded) ? ' ⚠️' : ''}</div>}

                {/* Badges */}
                <div className="flex gap-1 mt-1.5">
                  {c.medsDue > 0 && <span className="text-[9px] bg-amber-200 text-amber-800 px-1 py-0.5 rounded">💊{c.medsDue}</span>}
                  {c.criticalAlerts > 0 && <span className="text-[9px] bg-red-200 text-red-800 px-1 py-0.5 rounded animate-pulse">⚠️{c.criticalAlerts}</span>}
                </div>
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function WardBoardPage() { return <RoleGuard><WardBoardInner /></RoleGuard>; }
