// lib/duty-roster/duty-roster-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface ShiftDef {
  id: string; centre_id: string; shift_name: string; shift_code: string;
  start_time: string; end_time: string; is_night_shift: boolean; color: string; is_active: boolean;
}

export interface StaffingReq {
  id: string; centre_id: string; ward_id: string; shift_id: string;
  staff_type: string; min_count: number; is_active: boolean;
  ward?: { name: string } | null;
  shift?: { shift_name: string; shift_code: string } | null;
}

export interface RosterEntry {
  id: string; centre_id: string; staff_id: string; ward_id: string;
  shift_id: string | null; roster_date: string; shift_type: string;
  actual_start: string | null; actual_end: string | null;
  overtime_minutes: number; notes: string | null;
  created_by: string | null; created_at: string;
  staff?: { full_name: string; staff_type: string; designation: string } | null;
  ward?: { name: string } | null;
  shift?: { shift_name: string; shift_code: string; color: string } | null;
}

export interface SwapRequest {
  id: string; centre_id: string; requester_id: string; target_id: string;
  roster_id_requester: string; roster_id_target: string;
  swap_date: string; reason: string | null; status: string;
  approved_by: string | null; approved_at: string | null;
  requester?: { full_name: string } | null;
  target?: { full_name: string } | null;
  approver?: { full_name: string } | null;
}

export function useDutyRoster(centreId: string | null) {
  const [shifts, setShifts] = useState<ShiftDef[]>([]);
  const [requirements, setRequirements] = useState<StaffingReq[]>([]);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [loading, setLoading] = useState(false);

  // Load shift definitions
  const loadShifts = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_shift_definitions')
      .select('*').eq('centre_id', centreId).eq('is_active', true).order('start_time');
    setShifts(data || []);
  }, [centreId]);

  // Load staffing requirements
  const loadRequirements = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_staffing_requirements')
      .select('*, ward:hmis_wards!hmis_staffing_requirements_ward_id_fkey(name), shift:hmis_shift_definitions!hmis_staffing_requirements_shift_id_fkey(shift_name, shift_code)')
      .eq('centre_id', centreId).eq('is_active', true);
    setRequirements((data || []) as StaffingReq[]);
  }, [centreId]);

  // Load roster for a date range
  const loadRoster = useCallback(async (dateFrom: string, dateTo: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_duty_roster')
      .select('*, staff:hmis_staff!hmis_duty_roster_staff_id_fkey(full_name, staff_type, designation), ward:hmis_wards!hmis_duty_roster_ward_id_fkey(name), shift:hmis_shift_definitions!hmis_duty_roster_shift_id_fkey(shift_name, shift_code, color)')
      .eq('centre_id', centreId)
      .gte('roster_date', dateFrom)
      .lte('roster_date', dateTo)
      .order('roster_date')
      .order('shift_type');
    setRoster((data || []) as RosterEntry[]);
    setLoading(false);
  }, [centreId]);

  // Load swap requests
  const loadSwaps = useCallback(async () => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_duty_swap_requests')
      .select('*, requester:hmis_staff!hmis_duty_swap_requests_requester_id_fkey(full_name), target:hmis_staff!hmis_duty_swap_requests_target_id_fkey(full_name), approver:hmis_staff!hmis_duty_swap_requests_approved_by_fkey(full_name)')
      .eq('centre_id', centreId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setSwaps((data || []) as SwapRequest[]);
  }, [centreId]);

  // Assign shift to staff
  const assignShift = useCallback(async (input: {
    staff_id: string; ward_id: string; shift_id?: string;
    roster_date: string; shift_type: string; created_by: string; notes?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_duty_roster').upsert({
      centre_id: centreId,
      staff_id: input.staff_id,
      ward_id: input.ward_id,
      shift_id: input.shift_id || null,
      roster_date: input.roster_date,
      shift_type: input.shift_type,
      created_by: input.created_by,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'staff_id,roster_date' });
  }, [centreId]);

  // Bulk generate roster for a month (auto-fill rotation)
  const generateMonthRoster = useCallback(async (
    wardId: string, year: number, month: number,
    staffIds: string[], shiftRotation: string[], createdBy: string
  ) => {
    if (!centreId || !sb()) return;
    const daysInMonth = new Date(year, month, 0).getDate();
    const rows: any[] = [];
    // Check leaves
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-${daysInMonth}`;
    const { data: leaves } = await sb().from('hmis_doctor_leaves')
      .select('doctor_id, leave_date')
      .gte('leave_date', startDate)
      .lte('leave_date', endDate);
    const leaveSet = new Set((leaves || []).map(l => `${l.doctor_id}_${l.leave_date}`));

    // Find shift IDs for rotation codes
    const shiftMap: Record<string, string | null> = {};
    for (const s of shifts) { shiftMap[s.shift_code] = s.id; }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      staffIds.forEach((staffId, staffIdx) => {
        const rotIdx = (staffIdx + day - 1) % shiftRotation.length;
        const shiftCode = shiftRotation[rotIdx];
        const isLeave = leaveSet.has(`${staffId}_${dateStr}`);
        const shiftType = isLeave ? 'leave' : shiftCode.toLowerCase() === 'o' ? 'off' :
          shiftCode.toLowerCase() === 'm' ? 'morning' : shiftCode.toLowerCase() === 'a' ? 'afternoon' :
          shiftCode.toLowerCase() === 'n' ? 'night' : shiftCode.toLowerCase() === 'g' ? 'general' : 'custom';
        rows.push({
          centre_id: centreId, staff_id: staffId, ward_id: wardId,
          shift_id: isLeave ? null : (shiftMap[shiftCode.toUpperCase()] || null),
          roster_date: dateStr, shift_type: shiftType, created_by: createdBy,
        });
      });
    }
    // Upsert in batches of 100
    for (let i = 0; i < rows.length; i += 100) {
      await sb().from('hmis_duty_roster').upsert(rows.slice(i, i + 100), { onConflict: 'staff_id,roster_date' });
    }
  }, [centreId, shifts]);

  // Coverage gap detection
  const coverageGaps = useMemo(() => {
    const gaps: { ward: string; wardId: string; shift: string; shiftId: string; staffType: string; required: number; assigned: number; date: string }[] = [];
    // Group roster by date+ward+shift
    const dateWardShift: Record<string, { staffType: string }[]> = {};
    roster.forEach(r => {
      if (r.shift_type === 'off' || r.shift_type === 'leave') return;
      const key = `${r.roster_date}_${r.ward_id}_${r.shift_id || r.shift_type}`;
      if (!dateWardShift[key]) dateWardShift[key] = [];
      dateWardShift[key].push({ staffType: (r.staff as any)?.staff_type || 'unknown' });
    });
    // Check against requirements
    requirements.forEach(req => {
      const dates = [...new Set(roster.map(r => r.roster_date))];
      dates.forEach(date => {
        const key = `${date}_${req.ward_id}_${req.shift_id}`;
        const assigned = (dateWardShift[key] || []).filter(s => s.staffType === req.staff_type).length;
        if (assigned < req.min_count) {
          gaps.push({
            ward: (req.ward as any)?.name || 'Unknown', wardId: req.ward_id,
            shift: (req.shift as any)?.shift_name || 'Unknown', shiftId: req.shift_id,
            staffType: req.staff_type, required: req.min_count, assigned, date,
          });
        }
      });
    });
    return gaps;
  }, [roster, requirements]);

  // Staff weekly/monthly summary
  const staffSummary = useMemo(() => {
    const summary: Record<string, { name: string; shifts: Record<string, number>; totalDays: number; offDays: number; leaveDays: number; overtimeMin: number }> = {};
    roster.forEach(r => {
      if (!summary[r.staff_id]) {
        summary[r.staff_id] = { name: (r.staff as any)?.full_name || '?', shifts: {}, totalDays: 0, offDays: 0, leaveDays: 0, overtimeMin: 0 };
      }
      const s = summary[r.staff_id];
      s.shifts[r.shift_type] = (s.shifts[r.shift_type] || 0) + 1;
      if (r.shift_type === 'off') s.offDays++;
      else if (r.shift_type === 'leave') s.leaveDays++;
      else s.totalDays++;
      s.overtimeMin += r.overtime_minutes || 0;
    });
    return summary;
  }, [roster]);

  // Swap request actions
  const requestSwap = useCallback(async (input: {
    requester_id: string; target_id: string;
    roster_id_requester: string; roster_id_target: string;
    swap_date: string; reason?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_duty_swap_requests').insert({ centre_id: centreId, ...input });
  }, [centreId]);

  const approveSwap = useCallback(async (swapId: string, approverId: string) => {
    if (!sb()) return;
    const { data: swap } = await sb().from('hmis_duty_swap_requests').select('*').eq('id', swapId).single();
    if (!swap) return;
    // Swap the shift assignments
    const { data: r1 } = await sb().from('hmis_duty_roster').select('ward_id, shift_id, shift_type').eq('id', swap.roster_id_requester).single();
    const { data: r2 } = await sb().from('hmis_duty_roster').select('ward_id, shift_id, shift_type').eq('id', swap.roster_id_target).single();
    if (r1 && r2) {
      await sb().from('hmis_duty_roster').update({ ward_id: r2.ward_id, shift_id: r2.shift_id, shift_type: r2.shift_type, updated_at: new Date().toISOString() }).eq('id', swap.roster_id_requester);
      await sb().from('hmis_duty_roster').update({ ward_id: r1.ward_id, shift_id: r1.shift_id, shift_type: r1.shift_type, updated_at: new Date().toISOString() }).eq('id', swap.roster_id_target);
    }
    await sb().from('hmis_duty_swap_requests').update({ status: 'approved', approved_by: approverId, approved_at: new Date().toISOString() }).eq('id', swapId);
  }, []);

  const rejectSwap = useCallback(async (swapId: string, approverId: string) => {
    if (!sb()) return;
    await sb().from('hmis_duty_swap_requests').update({ status: 'rejected', approved_by: approverId, approved_at: new Date().toISOString() }).eq('id', swapId);
  }, []);

  // Save staffing requirement
  const saveRequirement = useCallback(async (input: { ward_id: string; shift_id: string; staff_type: string; min_count: number }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_staffing_requirements').upsert({
      centre_id: centreId, ...input, is_active: true,
    }, { onConflict: 'ward_id,shift_id,staff_type' });
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadShifts(); loadRequirements(); loadSwaps(); }, [loadShifts, loadRequirements, loadSwaps]);

  return {
    shifts, requirements, roster, swaps, loading, coverageGaps, staffSummary,
    loadShifts, loadRequirements, loadRoster, loadSwaps,
    assignShift, generateMonthRoster, saveRequirement,
    requestSwap, approveSwap, rejectSwap,
  };
}
