// lib/bed-management/bed-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

export type BedStatus = 'available' | 'occupied' | 'reserved' | 'maintenance' | 'housekeeping';

export interface BedData {
  id: string; bedNumber: string; status: BedStatus; isActive: boolean;
  roomId: string; roomNumber: string; roomType: string; dailyRate: number;
  wardId: string; wardName: string; wardType: string; floor: string;
  // Occupied bed → patient info
  admissionId?: string; patientName?: string; uhid?: string; doctorName?: string;
  admissionDate?: string; daysAdmitted?: number; payorType?: string;
  diagnosis?: string; expectedDischarge?: string;
}

export interface WardSummary {
  wardId: string; wardName: string; wardType: string; floor: string;
  totalBeds: number; occupied: number; available: number; reserved: number;
  maintenance: number; housekeeping: number; occupancyPct: number;
  rooms: RoomSummary[];
}

export interface RoomSummary {
  roomId: string; roomNumber: string; roomType: string; dailyRate: number;
  beds: BedData[];
}

// ============================================================
// Main Hook
// ============================================================
export function useBedManagement(centreId: string | null) {
  const [beds, setBeds] = useState<BedData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!centreId || !sb()) { setLoading(false); return; }
    setLoading(true);
    setError(null);

    try {
      // Single query: beds + room + ward + current admission + patient + doctor
      const { data, error: qErr } = await sb()
        .from('hmis_beds')
        .select(`
          id, bed_number, status, is_active, room_id, current_admission_id,
          room:hmis_rooms!inner(
            id, room_number, room_type, daily_rate,
            ward:hmis_wards!inner(id, name, type, floor, centre_id)
          )
        `)
        .eq('room.ward.centre_id', centreId)
        .eq('is_active', true)
        .order('bed_number');

      if (qErr) throw qErr;

      // Fetch active admissions separately to get patient + doctor
      const occupiedBedIds = (data || []).filter((b: any) => b.current_admission_id).map((b: any) => b.current_admission_id);
      let admissionMap = new Map<string, any>();

      if (occupiedBedIds.length > 0) {
        const { data: admissions } = await sb()
          .from('hmis_admissions')
          .select('id, admission_date, expected_discharge, payor_type, provisional_diagnosis, patient:hmis_patients!inner(first_name, last_name, uhid), doctor:hmis_staff!hmis_admissions_primary_doctor_id_fkey(full_name)')
          .in('id', occupiedBedIds);

        (admissions || []).forEach((a: any) => admissionMap.set(a.id, a));
      }

      const today = new Date();
      const bedList: BedData[] = (data || []).map((b: any) => {
        const adm = b.current_admission_id ? admissionMap.get(b.current_admission_id) : null;
        const admDate = adm?.admission_date ? new Date(adm.admission_date) : null;
        const daysAdm = admDate ? Math.max(0, Math.floor((today.getTime() - admDate.getTime()) / 86400000)) : undefined;

        return {
          id: b.id,
          bedNumber: b.bed_number,
          status: b.status as BedStatus,
          isActive: b.is_active,
          roomId: b.room.id,
          roomNumber: b.room.room_number,
          roomType: b.room.room_type,
          dailyRate: parseFloat(b.room.daily_rate || 0),
          wardId: b.room.ward.id,
          wardName: b.room.ward.name,
          wardType: b.room.ward.type,
          floor: b.room.ward.floor || '',
          admissionId: b.current_admission_id || undefined,
          patientName: adm ? `${adm.patient?.first_name} ${adm.patient?.last_name}` : undefined,
          uhid: adm?.patient?.uhid,
          doctorName: adm?.doctor?.full_name,
          admissionDate: adm?.admission_date?.split('T')[0],
          daysAdmitted: daysAdm,
          payorType: adm?.payor_type,
          diagnosis: adm?.provisional_diagnosis,
          expectedDischarge: adm?.expected_discharge,
        };
      });

      setBeds(bedList);
    } catch (err: any) {
      setError(err.message || 'Failed to load beds');
    }
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  // ---- WARD TREE ----
  const wards = useMemo((): WardSummary[] => {
    const wardMap = new Map<string, WardSummary>();

    beds.forEach(b => {
      if (!wardMap.has(b.wardId)) {
        wardMap.set(b.wardId, {
          wardId: b.wardId, wardName: b.wardName, wardType: b.wardType, floor: b.floor,
          totalBeds: 0, occupied: 0, available: 0, reserved: 0, maintenance: 0, housekeeping: 0, occupancyPct: 0,
          rooms: [],
        });
      }
      const ward = wardMap.get(b.wardId)!;
      ward.totalBeds++;
      if (b.status === 'occupied') ward.occupied++;
      else if (b.status === 'available') ward.available++;
      else if (b.status === 'reserved') ward.reserved++;
      else if (b.status === 'maintenance') ward.maintenance++;
      else if (b.status === 'housekeeping') ward.housekeeping++;

      // Find or create room
      let room = ward.rooms.find(r => r.roomId === b.roomId);
      if (!room) {
        room = { roomId: b.roomId, roomNumber: b.roomNumber, roomType: b.roomType, dailyRate: b.dailyRate, beds: [] };
        ward.rooms.push(room);
      }
      room.beds.push(b);
    });

    wardMap.forEach(w => {
      w.occupancyPct = w.totalBeds > 0 ? Math.round((w.occupied / w.totalBeds) * 100) : 0;
      w.rooms.sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }));
    });

    return Array.from(wardMap.values()).sort((a, b) => a.wardName.localeCompare(b.wardName));
  }, [beds]);

  // ---- TOTALS ----
  const totals = useMemo(() => {
    const t = { total: 0, occupied: 0, available: 0, reserved: 0, maintenance: 0, housekeeping: 0, occupancyPct: 0 };
    beds.forEach(b => {
      t.total++;
      if (b.status === 'occupied') t.occupied++;
      else if (b.status === 'available') t.available++;
      else if (b.status === 'reserved') t.reserved++;
      else if (b.status === 'maintenance') t.maintenance++;
      else if (b.status === 'housekeeping') t.housekeeping++;
    });
    t.occupancyPct = t.total > 0 ? Math.round((t.occupied / t.total) * 100) : 0;
    return t;
  }, [beds]);

  // ---- ACTIONS ----

  // Change bed status
  const updateBedStatus = useCallback(async (bedId: string, newStatus: BedStatus, admissionId?: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };

    const bed = beds.find(b => b.id === bedId);
    if (!bed) return { success: false, error: 'Bed not found' };

    // Validate transitions
    if (newStatus === 'occupied' && !admissionId) {
      return { success: false, error: 'Cannot mark bed occupied without an admission' };
    }
    if (bed.status === 'occupied' && newStatus === 'available') {
      return { success: false, error: 'Occupied bed must go through housekeeping before becoming available. Use "Mark Housekeeping" first.' };
    }
    if (bed.status === 'maintenance' && newStatus === 'occupied') {
      return { success: false, error: 'Cannot admit to a bed under maintenance. Mark available first.' };
    }

    const update: any = { status: newStatus };
    if (newStatus === 'occupied' && admissionId) update.current_admission_id = admissionId;
    if (newStatus !== 'occupied') update.current_admission_id = null;

    const { error } = await sb().from('hmis_beds').update(update).eq('id', bedId);
    if (error) return { success: false, error: error.message };

    load();
    return { success: true };
  }, [beds, load]);

  // Transfer patient between beds
  const transferBed = useCallback(async (
    admissionId: string, fromBedId: string, toBedId: string, reason: string, staffId: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };

    const fromBed = beds.find(b => b.id === fromBedId);
    const toBed = beds.find(b => b.id === toBedId);

    if (!fromBed) return { success: false, error: 'Source bed not found' };
    if (!toBed) return { success: false, error: 'Destination bed not found' };
    if (fromBed.status !== 'occupied') return { success: false, error: 'Source bed is not occupied' };
    if (toBed.status !== 'available') return { success: false, error: `Destination bed ${toBed.wardName} / ${toBed.roomNumber} / ${toBed.bedNumber} is ${toBed.status}, not available` };
    if (!reason.trim()) return { success: false, error: 'Transfer reason is required' };

    // 1. Create transfer record
    const { error: txErr } = await sb().from('hmis_bed_transfers').insert({
      admission_id: admissionId, from_bed_id: fromBedId, to_bed_id: toBedId,
      reason: reason.trim(), transferred_by: staffId,
    });
    if (txErr) return { success: false, error: 'Transfer record failed: ' + txErr.message };

    // 2. Free old bed (→ housekeeping)
    await sb().from('hmis_beds').update({ status: 'housekeeping', current_admission_id: null }).eq('id', fromBedId);

    // 3. Assign new bed
    await sb().from('hmis_beds').update({ status: 'occupied', current_admission_id: admissionId }).eq('id', toBedId);

    // 4. Update admission record
    await sb().from('hmis_admissions').update({ bed_id: toBedId, updated_at: new Date().toISOString() }).eq('id', admissionId);

    load();
    return { success: true };
  }, [beds, load]);

  // Mark housekeeping complete → available
  const markClean = useCallback(async (bedId: string): Promise<{ success: boolean; error?: string }> => {
    if (!sb()) return { success: false, error: 'Not ready' };
    const bed = beds.find(b => b.id === bedId);
    if (!bed) return { success: false, error: 'Bed not found' };
    if (bed.status !== 'housekeeping') return { success: false, error: 'Bed is not in housekeeping status' };

    const { error } = await sb().from('hmis_beds').update({ status: 'available', current_admission_id: null }).eq('id', bedId);
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [beds, load]);

  return { beds, wards, totals, loading, error, load, updateBedStatus, transferBed, markClean };
}
