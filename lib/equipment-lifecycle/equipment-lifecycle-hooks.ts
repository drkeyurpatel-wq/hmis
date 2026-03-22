// lib/equipment-lifecycle/equipment-lifecycle-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface Equipment {
  id: string; centre_id: string; name: string; category: string;
  brand: string | null; model: string | null; serial_number: string | null;
  location: string | null; department: string | null;
  purchase_date: string | null; purchase_cost: number | null;
  warranty_expiry: string | null;
  amc_vendor: string | null; amc_expiry: string | null; amc_cost: number | null;
  amc_contract_number: string | null; amc_start_date: string | null; amc_sla_hours: number;
  status: string; criticality: string;
  last_pm_date: string | null; next_pm_date: string | null;
  last_calibration_date: string | null; next_calibration_date: string | null;
  calibration_frequency_days: number;
  total_repair_cost: number; total_downtime_hours: number; uptime_pct: number;
  is_active: boolean; notes: string | null; created_at: string;
}

export interface MaintenanceLog {
  id: string; equipment_id: string; centre_id: string; type: string;
  reported_by: string | null; reported_at: string;
  issue_description: string | null; priority: string; severity: string;
  assigned_to: string | null; started_at: string | null; completed_at: string | null;
  resolution: string | null; parts_used: any[]; cost: number;
  downtime_hours: number; status: string;
  amc_ticket_number: string | null; sla_target_hours: number | null; sla_met: boolean | null;
  patients_impacted: number; patients_rescheduled: number;
  vendor_notified_at: string | null; vendor_response_at: string | null;
  created_at: string;
  reporter?: { full_name: string } | null;
  equipment?: { name: string; category: string; location: string } | null;
}

export interface Calibration {
  id: string; equipment_id: string; centre_id: string;
  calibration_date: string; next_due_date: string;
  performed_by: string | null; vendor: string | null;
  certificate_number: string | null; result: string;
  deviation_notes: string | null; cost: number;
}

export function useEquipmentLifecycle(centreId: string | null) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>([]);
  const [calibrations, setCalibrations] = useState<Calibration[]>([]);
  const [loading, setLoading] = useState(false);

  const loadEquipment = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb()!.from('hmis_equipment')
      .select('*').eq('centre_id', centreId).eq('is_active', true).order('name');
    setEquipment((data || []) as Equipment[]);
    setLoading(false);
  }, [centreId]);

  const loadMaintenance = useCallback(async (equipmentId?: string) => {
    if (!centreId || !sb()) return;
    let q = sb()!.from('hmis_equipment_maintenance')
      .select('*, reporter:hmis_staff!hmis_equipment_maintenance_reported_by_fkey(full_name), equipment:hmis_equipment!hmis_equipment_maintenance_equipment_id_fkey(name, category, location)')
      .eq('centre_id', centreId)
      .order('reported_at', { ascending: false }).limit(200);
    if (equipmentId) q = q.eq('equipment_id', equipmentId);
    const { data } = await q;
    setMaintenance((data || []) as MaintenanceLog[]);
  }, [centreId]);

  const loadCalibrations = useCallback(async (equipmentId?: string) => {
    if (!centreId || !sb()) return;
    let q = sb()!.from('hmis_equipment_calibration')
      .select('*').eq('centre_id', centreId).order('calibration_date', { ascending: false }).limit(100);
    if (equipmentId) q = q.eq('equipment_id', equipmentId);
    const { data } = await q;
    setCalibrations((data || []) as Calibration[]);
  }, [centreId]);

  // Log breakdown
  const logBreakdown = useCallback(async (input: {
    equipment_id: string; issue_description: string; severity: string;
    reported_by: string; patients_impacted?: number; patients_rescheduled?: number;
  }) => {
    if (!centreId || !sb()) return null;
    // Get equipment AMC info
    const { data: eq } = await sb()!.from('hmis_equipment')
      .select('amc_vendor, amc_sla_hours').eq('id', input.equipment_id).single();

    const { data, error } = await sb()!.from('hmis_equipment_maintenance').insert({
      equipment_id: input.equipment_id, centre_id: centreId, type: 'breakdown',
      reported_by: input.reported_by, issue_description: input.issue_description,
      priority: input.severity === 'critical' ? 'critical' : input.severity === 'high' ? 'high' : 'medium',
      severity: input.severity,
      sla_target_hours: eq?.amc_sla_hours || 24,
      patients_impacted: input.patients_impacted || 0,
      patients_rescheduled: input.patients_rescheduled || 0,
      vendor_notified_at: eq?.amc_vendor ? new Date().toISOString() : null,
    }).select().single();

    // Set equipment status to out_of_order
    if (!error) {
      await sb()!.from('hmis_equipment').update({ status: 'maintenance' }).eq('id', input.equipment_id);
    }
    return data;
  }, [centreId]);

  // Resolve maintenance
  const resolveMaintenance = useCallback(async (maintenanceId: string, input: {
    resolution: string; cost?: number; parts_used?: any[];
  }) => {
    if (!sb()) return;
    const now = new Date().toISOString();
    const { data: m } = await sb()!.from('hmis_equipment_maintenance')
      .select('equipment_id, reported_at, sla_target_hours').eq('id', maintenanceId).single();
    if (!m) return;

    const hoursElapsed = (Date.now() - new Date(m.reported_at).getTime()) / 3600000;
    const slaMet = m.sla_target_hours ? hoursElapsed <= m.sla_target_hours : true;

    await sb()!.from('hmis_equipment_maintenance').update({
      completed_at: now, resolution: input.resolution, status: 'completed',
      cost: input.cost || 0, parts_used: input.parts_used || [],
      downtime_hours: Math.round(hoursElapsed * 100) / 100, sla_met: slaMet,
    }).eq('id', maintenanceId);

    // Update equipment: restore status, accumulate costs/downtime
    const { data: eq } = await sb()!.from('hmis_equipment')
      .select('total_repair_cost, total_downtime_hours').eq('id', m.equipment_id).single();
    if (eq) {
      const newCost = (eq.total_repair_cost || 0) + (input.cost || 0);
      const newDowntime = (eq.total_downtime_hours || 0) + hoursElapsed;
      await sb()!.from('hmis_equipment').update({
        status: 'active', total_repair_cost: Math.round(newCost * 100) / 100,
        total_downtime_hours: Math.round(newDowntime * 100) / 100,
      }).eq('id', m.equipment_id);
    }
  }, []);

  // Log calibration
  const logCalibration = useCallback(async (input: {
    equipment_id: string; calibration_date: string; performed_by?: string;
    vendor?: string; certificate_number?: string; result: string;
    deviation_notes?: string; cost?: number;
  }) => {
    if (!centreId || !sb()) return;
    const { data: eq } = await sb()!.from('hmis_equipment')
      .select('calibration_frequency_days').eq('id', input.equipment_id).single();
    const freqDays = eq?.calibration_frequency_days || 365;
    const nextDue = new Date(input.calibration_date);
    nextDue.setDate(nextDue.getDate() + freqDays);

    await sb()!.from('hmis_equipment_calibration').insert({
      equipment_id: input.equipment_id, centre_id: centreId,
      calibration_date: input.calibration_date,
      next_due_date: nextDue.toISOString().split('T')[0],
      performed_by: input.performed_by || null, vendor: input.vendor || null,
      certificate_number: input.certificate_number || null, result: input.result,
      deviation_notes: input.deviation_notes || null, cost: input.cost || 0,
    });

    // Update equipment
    await sb()!.from('hmis_equipment').update({
      last_calibration_date: input.calibration_date,
      next_calibration_date: nextDue.toISOString().split('T')[0],
    }).eq('id', input.equipment_id);
  }, [centreId]);

  // Alerts
  const alerts = useMemo(() => {
    const now = new Date();
    const d30 = new Date(); d30.setDate(d30.getDate() + 30);
    const d60 = new Date(); d60.setDate(d60.getDate() + 60);
    const d90 = new Date(); d90.setDate(d90.getDate() + 90);

    const amcExpiring = equipment.filter(e => e.amc_expiry && new Date(e.amc_expiry) <= d90 && new Date(e.amc_expiry) >= now);
    const calibDue = equipment.filter(e => e.next_calibration_date && new Date(e.next_calibration_date) <= d30);
    const pmDue = equipment.filter(e => e.next_pm_date && new Date(e.next_pm_date) <= d30);
    const openBreakdowns = maintenance.filter(m => m.type === 'breakdown' && m.status !== 'completed');
    const slaBreach = openBreakdowns.filter(m => {
      if (!m.sla_target_hours) return false;
      const hours = (Date.now() - new Date(m.reported_at).getTime()) / 3600000;
      return hours > m.sla_target_hours;
    });

    return { amcExpiring, calibDue, pmDue, openBreakdowns, slaBreach };
  }, [equipment, maintenance]);

  // Cost of ownership per equipment
  const costOfOwnership = useCallback((eq: Equipment) => {
    const purchase = eq.purchase_cost || 0;
    const amcYears = eq.amc_start_date && eq.amc_expiry
      ? Math.max(1, Math.ceil((new Date(eq.amc_expiry).getTime() - new Date(eq.amc_start_date).getTime()) / (365.25 * 86400000)))
      : 0;
    const totalAmc = (eq.amc_cost || 0) * amcYears;
    const repairs = eq.total_repair_cost || 0;
    return { purchase, totalAmc, repairs, total: purchase + totalAmc + repairs };
  }, []);

  useEffect(() => { loadEquipment(); loadMaintenance(); loadCalibrations(); }, [loadEquipment, loadMaintenance, loadCalibrations]);

  return {
    equipment, maintenance, calibrations, loading, alerts,
    loadEquipment, loadMaintenance, loadCalibrations,
    logBreakdown, resolveMaintenance, logCalibration, costOfOwnership,
  };
}
