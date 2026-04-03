// lib/ot/ot-command-hooks.ts — OT Command Centre data hooks
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// LIVE OT STATUS (today's real-time room states)
// ============================================================
export function useOTLiveStatus(centreId: string | null) {
  const [rooms, setRooms] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable today string — only changes when the date actually changes
  const [today, setToday] = useState(() => new Date().toISOString().split('T')[0]);
  useEffect(() => {
    const check = setInterval(() => {
      const now = new Date().toISOString().split('T')[0];
      if (now !== today) setToday(now);
    }, 60000);
    return () => clearInterval(check);
  }, [today]);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);

    const [roomRes, bookingRes] = await Promise.all([
      sb().from('hmis_ot_rooms').select('*').eq('centre_id', centreId).eq('is_active', true).order('name'),
      sb().from('hmis_ot_bookings')
        .select(`*, surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name),
          anaesthetist:hmis_staff!hmis_ot_bookings_anaesthetist_id_fkey(full_name),
          patient:hmis_admissions!inner(ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid))`)
        .eq('scheduled_date', today)
        .order('scheduled_start', { ascending: true }),
    ]);

    setRooms(roomRes.data || []);
    setBookings((bookingRes.data || []).filter((b: any) => {
      const room = (roomRes.data || []).find((r: any) => r.id === b.ot_room_id);
      return room && room.centre_id === centreId;
    }));
    setLoading(false);
  }, [centreId, today]);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  // Real-time subscription
  useEffect(() => {
    if (!centreId || !sb()) return;
    const channel = sb().channel(`ot-live-status-${centreId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hmis_ot_bookings' }, () => { load(); })
      .subscribe();
    return () => { sb().removeChannel(channel); };
  }, [centreId, load]);

  // Compute room status
  const roomStatus = useMemo(() => {
    return rooms.map(room => {
      const roomBookings = bookings.filter(b => b.ot_room_id === room.id);
      const inProgress = roomBookings.find(b => b.status === 'in_progress');
      const completed = roomBookings.filter(b => b.status === 'completed');
      const scheduled = roomBookings.filter(b => b.status === 'scheduled');
      const cancelled = roomBookings.filter(b => b.status === 'cancelled');
      const nextCase = scheduled[0];

      let status: 'in_use' | 'ready' | 'cleaning' | 'not_scheduled' = 'not_scheduled';
      if (inProgress) status = 'in_use';
      else if (scheduled.length > 0) status = 'ready';
      else if (completed.length > 0 && scheduled.length === 0) status = 'not_scheduled';

      // Check if last completed case has room_ready_time — if not and no next case started, it's cleaning
      const lastCompleted = completed[completed.length - 1];
      if (lastCompleted && !lastCompleted.room_ready_time && !inProgress && scheduled.length > 0) {
        status = 'cleaning';
      }

      const totalScheduled = roomBookings.filter(b => b.status !== 'cancelled').length;
      const totalDone = completed.length;
      const utilizedMin = completed.reduce((sum: number, b: any) => {
        if (b.actual_start && b.actual_end) {
          return sum + (new Date(b.actual_end).getTime() - new Date(b.actual_start).getTime()) / 60000;
        }
        return sum + (b.estimated_duration_min || 60);
      }, 0);
      const utilizationPct = Math.min(100, Math.round((utilizedMin / 600) * 100));

      // Estimated completion for in-progress case
      let estCompletion: string | null = null;
      if (inProgress?.actual_start && inProgress?.estimated_duration_min) {
        const est = new Date(new Date(inProgress.actual_start).getTime() + inProgress.estimated_duration_min * 60000);
        estCompletion = est.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      }

      return {
        ...room,
        status,
        inProgress,
        nextCase,
        completed: totalDone,
        totalScheduled,
        cancelled: cancelled.length,
        utilizationPct,
        estCompletion,
        bookings: roomBookings,
      };
    });
  }, [rooms, bookings]);

  // Today's aggregate KPIs
  const todayKPIs = useMemo(() => {
    const all = bookings.filter(b => b.status !== 'cancelled');
    const completedList = bookings.filter(b => b.status === 'completed');
    const scheduledList = bookings.filter(b => b.status === 'scheduled');
    const cancelledList = bookings.filter(b => b.status === 'cancelled');
    const delayedList = bookings.filter(b => (b.delay_minutes || 0) > 0 && b.status !== 'cancelled');

    const totalDelayMin = delayedList.reduce((s: number, b: any) => s + (b.delay_minutes || 0), 0);
    const avgDelay = delayedList.length > 0 ? Math.round(totalDelayMin / delayedList.length) : 0;

    // Turnaround: for each room, compute gaps between consecutive completed cases
    let totalTurnaround = 0;
    let turnaroundCount = 0;
    const roomIds = [...new Set(completedList.map(b => b.ot_room_id))];
    for (const roomId of roomIds) {
      const roomCompleted = completedList
        .filter(b => b.ot_room_id === roomId)
        .sort((a: any, b: any) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''));
      for (let i = 1; i < roomCompleted.length; i++) {
        const prevOut = roomCompleted[i - 1].patient_out_time || roomCompleted[i - 1].actual_end;
        const currIn = roomCompleted[i].patient_in_time || roomCompleted[i].actual_start;
        if (prevOut && currIn) {
          const gap = (new Date(currIn).getTime() - new Date(prevOut).getTime()) / 60000;
          if (gap > 0 && gap < 300) { totalTurnaround += gap; turnaroundCount++; }
        }
      }
    }

    // First case on time per room
    const firstCaseResults: boolean[] = [];
    for (const roomId of roomIds) {
      const first = completedList
        .filter(b => b.ot_room_id === roomId)
        .sort((a: any, b: any) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''))[0];
      if (first?.actual_start && first?.scheduled_start) {
        const scheduledTs = new Date(`${today}T${first.scheduled_start}`).getTime();
        const actualTs = new Date(first.actual_start).getTime();
        firstCaseResults.push((actualTs - scheduledTs) / 60000 <= 15);
      }
    }

    // Cancellation reasons
    const cancelReasons: Record<string, number> = {};
    cancelledList.forEach((b: any) => {
      const reason = b.cancellation_reason || b.delay_reason || 'unknown';
      cancelReasons[reason] = (cancelReasons[reason] || 0) + 1;
    });

    // Delay reasons
    const delayReasons: Record<string, number> = {};
    delayedList.forEach((b: any) => {
      const reason = b.delay_reason || 'other';
      delayReasons[reason] = (delayReasons[reason] || 0) + 1;
    });

    return {
      totalScheduled: all.length + cancelledList.length,
      completed: completedList.length,
      remaining: scheduledList.length,
      inProgress: bookings.filter(b => b.status === 'in_progress').length,
      cancelled: cancelledList.length,
      delays: delayedList.length,
      avgDelayMin: avgDelay,
      avgTurnaroundMin: turnaroundCount > 0 ? Math.round(totalTurnaround / turnaroundCount) : 0,
      firstCaseOnTime: firstCaseResults,
      cancelReasons,
      delayReasons,
    };
  }, [bookings, today]);

  return { rooms, bookings, roomStatus, todayKPIs, loading, reload: load };
}

// ============================================================
// OT COMMAND DASHBOARD (period analytics from daily stats)
// ============================================================
export function useOTCommandDashboard(centreId: string | null) {
  const [dashData, setDashData] = useState<any[]>([]);
  const [dailyStats, setDailyStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const loadDashboard = useCallback(async (from: string, to: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    const [rpcRes, statsRes] = await Promise.all([
      sb().rpc('get_ot_command_dashboard', { p_centre_id: centreId, p_from: from, p_to: to }),
      sb().from('hmis_ot_daily_stats')
        .select('*')
        .eq('centre_id', centreId)
        .gte('stat_date', from)
        .lte('stat_date', to)
        .order('stat_date', { ascending: true }),
    ]);

    setDashData(rpcRes.data || []);
    setDailyStats(statsRes.data || []);
    setLoading(false);
  }, [centreId]);

  // Heatmap data: { roomId, roomName, date, utilization }
  const heatmapData = useMemo(() => {
    return dailyStats.map(s => ({
      roomId: s.ot_room_id,
      date: s.stat_date,
      utilization: Number(s.utilization_pct) || 0,
      cases: s.total_cases,
      utilized: s.utilized_minutes,
    }));
  }, [dailyStats]);

  // Trend data: daily utilization by room
  const trendData = useMemo(() => {
    const dateMap = new Map<string, any>();
    dailyStats.forEach(s => {
      if (!dateMap.has(s.stat_date)) dateMap.set(s.stat_date, { date: s.stat_date });
      const entry = dateMap.get(s.stat_date)!;
      // Find room name from dashData
      const room = dashData.find(d => d.ot_room_id === s.ot_room_id);
      const roomName = room?.ot_room_name || s.ot_room_id?.slice(0, 8);
      entry[roomName] = Number(s.utilization_pct) || 0;
    });
    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [dailyStats, dashData]);

  // Cancellation & delay from bookings in range
  const [periodBookings, setPeriodBookings] = useState<any[]>([]);

  const loadPeriodBookings = useCallback(async (from: string, to: string) => {
    if (!centreId || !sb()) return;
    const { data } = await sb().from('hmis_ot_bookings')
      .select('id, status, delay_minutes, delay_reason, cancellation_reason, ot_room_id, scheduled_date')
      .gte('scheduled_date', from)
      .lte('scheduled_date', to);
    // Filter by centre rooms
    const { data: rooms } = await sb().from('hmis_ot_rooms').select('id').eq('centre_id', centreId);
    const roomIds = new Set((rooms || []).map((r: any) => r.id));
    setPeriodBookings((data || []).filter((b: any) => roomIds.has(b.ot_room_id)));
  }, [centreId]);

  const cancelAnalysis = useMemo(() => {
    const cancelled = periodBookings.filter(b => b.status === 'cancelled');
    const reasons: Record<string, number> = {};
    cancelled.forEach(b => {
      const r = b.cancellation_reason || b.delay_reason || 'unknown';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    // Trend by date
    const trend = new Map<string, { date: string; total: number; cancelled: number }>();
    periodBookings.forEach(b => {
      if (!trend.has(b.scheduled_date)) trend.set(b.scheduled_date, { date: b.scheduled_date, total: 0, cancelled: 0 });
      const entry = trend.get(b.scheduled_date)!;
      entry.total++;
      if (b.status === 'cancelled') entry.cancelled++;
    });
    return {
      reasons: Object.entries(reasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
      trend: Array.from(trend.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }, [periodBookings]);

  const delayAnalysis = useMemo(() => {
    const delayed = periodBookings.filter(b => (b.delay_minutes || 0) > 0 && b.status !== 'cancelled');
    const reasons: Record<string, number> = {};
    delayed.forEach(b => {
      const r = b.delay_reason || 'other';
      reasons[r] = (reasons[r] || 0) + 1;
    });
    return Object.entries(reasons).map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count);
  }, [periodBookings]);

  const loadAll = useCallback(async (from: string, to: string) => {
    await Promise.all([loadDashboard(from, to), loadPeriodBookings(from, to)]);
  }, [loadDashboard, loadPeriodBookings]);

  return { dashData, dailyStats, heatmapData, trendData, cancelAnalysis, delayAnalysis, loading, loadAll };
}

// ============================================================
// SURGEON PERFORMANCE
// ============================================================
export function useSurgeonPerformance(centreId: string | null) {
  const [surgeons, setSurgeons] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (from: string, to: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().rpc('get_surgeon_performance', { p_centre_id: centreId, p_from: from, p_to: to });
    setSurgeons(data || []);
    setLoading(false);
  }, [centreId]);

  return { surgeons, loading, load };
}

// ============================================================
// TOMORROW'S GAPS
// ============================================================
export function useOTGaps(centreId: string | null) {
  const [gaps, setGaps] = useState<any[]>([]);
  const [scheduleBookings, setScheduleBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (date?: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const targetDate = date || new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const [gapRes, bookRes] = await Promise.all([
      sb().rpc('get_ot_gaps_tomorrow', { p_centre_id: centreId, p_date: targetDate }),
      sb().from('hmis_ot_bookings')
        .select(`*, surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name),
          patient:hmis_admissions!inner(ipd_number, patient:hmis_patients!inner(first_name, last_name, uhid))`)
        .eq('scheduled_date', targetDate)
        .neq('status', 'cancelled')
        .order('scheduled_start', { ascending: true }),
    ]);

    setGaps(gapRes.data || []);
    // Filter by centre rooms
    const { data: rooms } = await sb().from('hmis_ot_rooms').select('id').eq('centre_id', centreId);
    const roomIds = new Set((rooms || []).map((r: any) => r.id));
    setScheduleBookings((bookRes.data || []).filter((b: any) => roomIds.has(b.ot_room_id)));
    setLoading(false);
  }, [centreId]);

  return { gaps, scheduleBookings, loading, load };
}

// ============================================================
// TURNAROUND TIME ANALYSIS
// ============================================================
export function useTurnaroundAnalysis(centreId: string | null) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (from: string, to: string) => {
    if (!centreId || !sb()) return;
    setLoading(true);

    const [bookRes, roomRes] = await Promise.all([
      sb().from('hmis_ot_bookings')
        .select(`id, ot_room_id, scheduled_date, scheduled_start, estimated_duration_min,
          actual_start, actual_end, status, surgeon_id,
          patient_in_time, anaesthesia_start, incision_time, closure_time, patient_out_time, room_ready_time,
          delay_minutes, delay_reason,
          surgeon:hmis_staff!hmis_ot_bookings_surgeon_id_fkey(full_name),
          ot_room:hmis_ot_rooms(name, centre_id)`)
        .gte('scheduled_date', from)
        .lte('scheduled_date', to)
        .eq('status', 'completed')
        .order('scheduled_date', { ascending: true })
        .order('scheduled_start', { ascending: true }),
      sb().from('hmis_ot_rooms').select('id, name').eq('centre_id', centreId).eq('is_active', true),
    ]);

    const roomIds = new Set((roomRes.data || []).map((r: any) => r.id));
    setBookings((bookRes.data || []).filter((b: any) => roomIds.has(b.ot_room_id)));
    setRooms(roomRes.data || []);
    setLoading(false);
  }, [centreId]);

  // Compute turnaround phases for each consecutive pair
  const turnaroundPhases = useMemo(() => {
    const result: any[] = [];
    const byRoom = new Map<string, any[]>();
    bookings.forEach(b => {
      if (!byRoom.has(b.ot_room_id)) byRoom.set(b.ot_room_id, []);
      byRoom.get(b.ot_room_id)!.push(b);
    });

    byRoom.forEach((roomBookings, roomId) => {
      // Group by date
      const byDate = new Map<string, any[]>();
      roomBookings.forEach(b => {
        if (!byDate.has(b.scheduled_date)) byDate.set(b.scheduled_date, []);
        byDate.get(b.scheduled_date)!.push(b);
      });

      byDate.forEach((dateBookings, date) => {
        const sorted = dateBookings.sort((a: any, b: any) => (a.scheduled_start || '').localeCompare(b.scheduled_start || ''));
        for (let i = 1; i < sorted.length; i++) {
          const prev = sorted[i - 1];
          const curr = sorted[i];

          const prevOut = prev.patient_out_time || prev.actual_end;
          const roomReady = prev.room_ready_time;
          const currIn = curr.patient_in_time || curr.actual_start;
          const anaesStart = curr.anaesthesia_start;
          const incision = curr.incision_time;

          if (!prevOut || !currIn) continue;

          const diffMin = (ts1: string, ts2: string) => {
            const d = (new Date(ts2).getTime() - new Date(ts1).getTime()) / 60000;
            return d > 0 && d < 300 ? Math.round(d) : 0;
          };

          const total = diffMin(prevOut, currIn);
          const cleaning = roomReady ? diffMin(prevOut, roomReady) : 0;
          const waiting = roomReady && currIn ? diffMin(roomReady, currIn) : 0;
          const anaesSetup = anaesStart && currIn ? diffMin(currIn, anaesStart) : 0;
          const toIncision = incision && (anaesStart || currIn) ? diffMin(anaesStart || currIn, incision) : 0;

          const roomName = rooms.find(r => r.id === roomId)?.name || 'Unknown';
          const surgeonName = curr.surgeon?.full_name || 'Unknown';

          result.push({
            date,
            roomId,
            roomName,
            surgeonName,
            surgeonId: curr.surgeon_id,
            total,
            cleaning,
            waiting,
            anaesSetup,
            toIncision,
            dayOfWeek: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
          });
        }
      });
    });

    return result;
  }, [bookings, rooms]);

  // Averages by room
  const avgByRoom = useMemo(() => {
    const map = new Map<string, { name: string; totals: number[]; cleaning: number[]; waiting: number[]; anaes: number[]; incision: number[] }>();
    turnaroundPhases.forEach(p => {
      if (!map.has(p.roomId)) map.set(p.roomId, { name: p.roomName, totals: [], cleaning: [], waiting: [], anaes: [], incision: [] });
      const e = map.get(p.roomId)!;
      e.totals.push(p.total);
      e.cleaning.push(p.cleaning);
      e.waiting.push(p.waiting);
      e.anaes.push(p.anaesSetup);
      e.incision.push(p.toIncision);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return Array.from(map.entries()).map(([id, v]) => ({
      roomId: id, roomName: v.name,
      avgTotal: avg(v.totals), avgCleaning: avg(v.cleaning),
      avgWaiting: avg(v.waiting), avgAnaes: avg(v.anaes), avgIncision: avg(v.incision),
      count: v.totals.length,
    }));
  }, [turnaroundPhases]);

  // Averages by day of week
  const avgByDayOfWeek = useMemo(() => {
    const map = new Map<string, number[]>();
    turnaroundPhases.forEach(p => {
      if (!map.has(p.dayOfWeek)) map.set(p.dayOfWeek, []);
      map.get(p.dayOfWeek)!.push(p.total);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.filter(d => map.has(d)).map(d => ({ day: d, avg: avg(map.get(d)!), count: map.get(d)!.length }));
  }, [turnaroundPhases]);

  // Averages by surgeon
  const avgBySurgeon = useMemo(() => {
    const map = new Map<string, { name: string; totals: number[] }>();
    turnaroundPhases.forEach(p => {
      if (!map.has(p.surgeonId)) map.set(p.surgeonId, { name: p.surgeonName, totals: [] });
      map.get(p.surgeonId)!.totals.push(p.total);
    });
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
    return Array.from(map.entries()).map(([id, v]) => ({
      surgeonId: id, surgeonName: v.name, avg: avg(v.totals), count: v.totals.length,
    })).sort((a, b) => a.avg - b.avg);
  }, [turnaroundPhases]);

  return { bookings, turnaroundPhases, avgByRoom, avgByDayOfWeek, avgBySurgeon, loading, load };
}
