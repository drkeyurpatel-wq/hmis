// lib/beds/bed-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export interface BedData {
  id: string; bedNumber: string; status: 'available' | 'occupied' | 'reserved' | 'maintenance' | 'housekeeping';
  roomId: string; roomNumber: string; roomType: string; dailyRate: number;
  wardId: string; wardName: string; wardType: string; floor: string;
  // Patient info (only if occupied)
  admissionId?: string; ipdNumber?: string;
  patientName?: string; patientUhid?: string; patientAge?: number; patientGender?: string;
  doctorName?: string; department?: string;
  admissionDate?: string; expectedDischarge?: string; daysAdmitted?: number;
  payorType?: string; diagnosis?: string;
}

export interface WardSummary {
  wardId: string; wardName: string; wardType: string; floor: string;
  total: number; occupied: number; available: number; reserved: number; maintenance: number; housekeeping: number;
  occupancyPct: number;
  rooms: { roomId: string; roomNumber: string; roomType: string; beds: BedData[] }[];
}

export function useBedBoard(centreId: string | null) {
  const [beds, setBeds] = useState<BedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true); setError(null);

    try {
      // Single query: beds + room + ward + current admission + patient + doctor
      const { data, error: dbErr } = await sb().from('hmis_beds')
        .select(`id, bed_number, status, room_id, current_admission_id, is_active,
          room:hmis_rooms!inner(id, room_number, room_type, daily_rate,
            ward:hmis_wards!inner(id, name, type, floor, centre_id))`)
        .eq('room.ward.centre_id', centreId)
        .eq('is_active', true)
        .order('room.ward.name')
        .order('room.room_number')
        .order('bed_number');

      if (dbErr) throw new Error(dbErr.message);

      // Load active admissions with patient+doctor for occupied beds
      const occupiedBedIds = (data || []).filter((b: any) => b.status === 'occupied' && b.current_admission_id).map((b: any) => b.current_admission_id);
      let admissionMap = new Map<string, any>();

      if (occupiedBedIds.length > 0) {
        const { data: admissions } = await sb().from('hmis_admissions')
          .select(`id, ipd_number, admission_date, expected_discharge, payor_type, provisional_diagnosis, status, bed_id,
            patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
            doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name),
            department:hmis_departments(name)`)
          .in('id', occupiedBedIds);

        (admissions || []).forEach((a: any) => admissionMap.set(a.id, a));
      }

      // Also get admissions linked by bed_id for any we missed
      const occupiedBedUUIDs = (data || []).filter((b: any) => b.status === 'occupied').map((b: any) => b.id);
      if (occupiedBedUUIDs.length > 0) {
        const { data: bedAdmissions } = await sb().from('hmis_admissions')
          .select(`id, ipd_number, admission_date, expected_discharge, payor_type, provisional_diagnosis, status, bed_id,
            patient:hmis_patients!inner(first_name, last_name, uhid, age_years, gender),
            doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name),
            department:hmis_departments(name)`)
          .in('bed_id', occupiedBedUUIDs)
          .eq('status', 'active');

        (bedAdmissions || []).forEach((a: any) => {
          if (a.bed_id && !admissionMap.has(a.id)) admissionMap.set(a.id, a);
        });
      }

      // Build BedData array
      const today = Date.now();
      const bedList: BedData[] = (data || []).map((b: any) => {
        const admission = b.current_admission_id ? admissionMap.get(b.current_admission_id) : null;
        // Try by bed_id if not found by admission_id
        const admByBed = !admission ? Array.from(admissionMap.values()).find((a: any) => a.bed_id === b.id) : null;
        const adm = admission || admByBed;

        const daysAdmitted = adm?.admission_date ? Math.floor((today - new Date(adm.admission_date).getTime()) / 86400000) : undefined;

        return {
          id: b.id, bedNumber: b.bed_number, status: b.status,
          roomId: b.room.id, roomNumber: b.room.room_number, roomType: b.room.room_type, dailyRate: parseFloat(b.room.daily_rate || 0),
          wardId: b.room.ward.id, wardName: b.room.ward.name, wardType: b.room.ward.type, floor: b.room.ward.floor || '',
          admissionId: adm?.id, ipdNumber: adm?.ipd_number,
          patientName: adm ? `${adm.patient?.first_name} ${adm.patient?.last_name}` : undefined,
          patientUhid: adm?.patient?.uhid, patientAge: adm?.patient?.age_years, patientGender: adm?.patient?.gender,
          doctorName: adm?.doctor?.full_name, department: adm?.department?.name,
          admissionDate: adm?.admission_date, expectedDischarge: adm?.expected_discharge, daysAdmitted,
          payorType: adm?.payor_type, diagnosis: adm?.provisional_diagnosis,
        };
      });

      setBeds(bedList);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 2 minutes
  useEffect(() => {
    const interval = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  // ---- WARD SUMMARIES ----
  const wards = useMemo((): WardSummary[] => {
    const wardMap = new Map<string, WardSummary>();
    beds.forEach(b => {
      if (!wardMap.has(b.wardId)) {
        wardMap.set(b.wardId, { wardId: b.wardId, wardName: b.wardName, wardType: b.wardType, floor: b.floor, total: 0, occupied: 0, available: 0, reserved: 0, maintenance: 0, housekeeping: 0, occupancyPct: 0, rooms: [] });
      }
      const ward = wardMap.get(b.wardId)!;
      ward.total++;
      ward[b.status]++;

      // Group by room
      let room = ward.rooms.find(r => r.roomId === b.roomId);
      if (!room) { room = { roomId: b.roomId, roomNumber: b.roomNumber, roomType: b.roomType, beds: [] }; ward.rooms.push(room); }
      room.beds.push(b);
    });
    wardMap.forEach(w => { w.occupancyPct = w.total > 0 ? Math.round((w.occupied / w.total) * 100) : 0; });
    return Array.from(wardMap.values()).sort((a, b) => a.wardName.localeCompare(b.wardName));
  }, [beds]);

  // ---- TOTALS ----
  const totals = useMemo(() => ({
    total: beds.length,
    occupied: beds.filter(b => b.status === 'occupied').length,
    available: beds.filter(b => b.status === 'available').length,
    reserved: beds.filter(b => b.status === 'reserved').length,
    maintenance: beds.filter(b => b.status === 'maintenance').length,
    housekeeping: beds.filter(b => b.status === 'housekeeping').length,
    occupancyPct: beds.length > 0 ? Math.round(beds.filter(b => b.status === 'occupied').length / beds.length * 100) : 0,
  }), [beds]);

  // ---- STATUS CHANGE ----
  const updateBedStatus = useCallback(async (bedId: string, newStatus: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };

    const bed = beds.find(b => b.id === bedId);
    if (!bed) return { success: false, error: 'Bed not found' };

    // Validate transitions
    if (bed.status === 'occupied' && newStatus === 'available') {
      return { success: false, error: 'Cannot mark occupied bed as available. Discharge the patient first.' };
    }
    if (bed.status === 'occupied' && newStatus !== 'housekeeping' && newStatus !== 'maintenance') {
      return { success: false, error: 'Occupied bed can only be changed after discharge (auto-sets to housekeeping).' };
    }

    const { error: dbErr } = await sb().from('hmis_beds').update({ status: newStatus }).eq('id', bedId);
    if (dbErr) return { success: false, error: dbErr.message };

    load();
    return { success: true };
  }, [beds, load]);

  // ---- TRANSFER ----
  const transferBed = useCallback(async (admissionId: string, fromBedId: string, toBedId: string, reason: string, staffId: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };

    const toBed = beds.find(b => b.id === toBedId);
    if (!toBed) return { success: false, error: 'Destination bed not found' };
    if (toBed.status !== 'available') return { success: false, error: `Destination bed ${toBed.wardName} / ${toBed.roomNumber} / ${toBed.bedNumber} is ${toBed.status}, not available.` };

    // 1. Log transfer
    const { error: transferErr } = await sb().from('hmis_bed_transfers').insert({
      admission_id: admissionId, from_bed_id: fromBedId, to_bed_id: toBedId,
      reason: reason || 'Bed transfer', transferred_by: staffId,
    });
    if (transferErr) return { success: false, error: `Transfer log failed: ${transferErr.message}` };

    // 2. Update admission bed_id
    const { error: admErr } = await sb().from('hmis_admissions').update({ bed_id: toBedId, updated_at: new Date().toISOString() }).eq('id', admissionId);
    if (admErr) return { success: false, error: `Admission update failed: ${admErr.message}` };

    // 3. Free old bed (housekeeping)
    await sb().from('hmis_beds').update({ status: 'housekeeping', current_admission_id: null }).eq('id', fromBedId);

    // 4. Occupy new bed
    await sb().from('hmis_beds').update({ status: 'occupied', current_admission_id: admissionId }).eq('id', toBedId);

    load();
    return { success: true };
  }, [beds, load]);

  // ---- RESERVE ----
  const reserveBed = useCallback(async (bedId: string): Promise<{ success: boolean; error?: string }> => {
    const bed = beds.find(b => b.id === bedId);
    if (!bed) return { success: false, error: 'Bed not found' };
    if (bed.status !== 'available') return { success: false, error: `Bed is ${bed.status}, can only reserve available beds.` };

    const { error: dbErr } = await sb().from('hmis_beds').update({ status: 'reserved' }).eq('id', bedId);
    if (dbErr) return { success: false, error: dbErr.message };
    load();
    return { success: true };
  }, [beds, load]);

  // ---- MARK AVAILABLE (from housekeeping/reserved/maintenance) ----
  const markAvailable = useCallback(async (bedId: string): Promise<{ success: boolean; error?: string }> => {
    const bed = beds.find(b => b.id === bedId);
    if (!bed) return { success: false, error: 'Bed not found' };
    if (bed.status === 'occupied') return { success: false, error: 'Cannot mark occupied bed available. Discharge patient first.' };

    const { error: dbErr } = await sb().from('hmis_beds').update({ status: 'available', current_admission_id: null }).eq('id', bedId);
    if (dbErr) return { success: false, error: dbErr.message };
    load();
    return { success: true };
  }, [beds, load]);

  return { beds, wards, totals, loading, error, load, updateBedStatus, transferBed, reserveBed, markAvailable };
}
