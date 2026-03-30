// lib/lab/qc-hooks.ts
// Quality Control module — Westgard rules, Levey-Jennings, lot management

import { useState, useEffect, useCallback } from 'react';
import { sb } from '@/lib/supabase/browser';

// ============================================================
// WESTGARD RULE ENGINE
// ============================================================
export interface WestgardResult {
  violation: string | null;
  isWarning: boolean;
  isRejection: boolean;
  sdFromMean: number;
}

export function evaluateWestgard(
  value: number, mean: number, sd: number, previousValues: number[]
): WestgardResult {
  const sdFromMean = sd > 0 ? (value - mean) / sd : 0;
  const allValues = [...previousValues, value];

  // 1-3s: Single control exceeds ±3SD → REJECT
  if (Math.abs(sdFromMean) >= 3) {
    return { violation: '1_3s', isWarning: false, isRejection: true, sdFromMean };
  }

  // 1-2s: Single control exceeds ±2SD → WARNING
  if (Math.abs(sdFromMean) >= 2) {
    // Check 2-2s: Two consecutive on same side beyond 2SD
    if (previousValues.length >= 1) {
      const prevSD = sd > 0 ? (previousValues[previousValues.length - 1] - mean) / sd : 0;
      if (Math.abs(prevSD) >= 2 && Math.sign(prevSD) === Math.sign(sdFromMean)) {
        return { violation: '2_2s', isWarning: false, isRejection: true, sdFromMean };
      }
    }

    // Check R-4s: One +2SD and one -2SD (range >4SD)
    if (previousValues.length >= 1) {
      const prevSD = sd > 0 ? (previousValues[previousValues.length - 1] - mean) / sd : 0;
      if (Math.abs(prevSD) >= 2 && Math.sign(prevSD) !== Math.sign(sdFromMean)) {
        return { violation: 'R_4s', isWarning: false, isRejection: true, sdFromMean };
      }
    }

    return { violation: '1_2s', isWarning: true, isRejection: false, sdFromMean };
  }

  // 4-1s: Four consecutive beyond ±1SD on same side
  if (allValues.length >= 4) {
    const last4 = allValues.slice(-4);
    const sds = last4.map(v => sd > 0 ? (v - mean) / sd : 0);
    const allSameSide = sds.every(s => s > 1) || sds.every(s => s < -1);
    if (allSameSide) {
      return { violation: '4_1s', isWarning: false, isRejection: true, sdFromMean };
    }
  }

  // 10x: Ten consecutive on same side of mean
  if (allValues.length >= 10) {
    const last10 = allValues.slice(-10);
    const allAbove = last10.every(v => v > mean);
    const allBelow = last10.every(v => v < mean);
    if (allAbove || allBelow) {
      return { violation: '10x', isWarning: false, isRejection: true, sdFromMean };
    }
  }

  // 7T: Seven consecutive trending same direction
  if (allValues.length >= 7) {
    const last7 = allValues.slice(-7);
    let allUp = true, allDown = true;
    for (let i = 1; i < 7; i++) {
      if (last7[i] <= last7[i - 1]) allUp = false;
      if (last7[i] >= last7[i - 1]) allDown = false;
    }
    if (allUp || allDown) {
      return { violation: '7T', isWarning: true, isRejection: false, sdFromMean };
    }
  }

  return { violation: null, isWarning: false, isRejection: false, sdFromMean };
}

// ============================================================
// QC LOTS
// ============================================================
export function useQCLots(centreId: string | null) {
  const [lots, setLots] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_lab_qc_lots')
      .select('*, test:hmis_lab_test_master(test_code, test_name), parameter:hmis_lab_test_parameters(parameter_name)')
      .eq('centre_id', centreId).eq('is_active', true)
      .order('test_id').order('level');
    setLots(data || []);
    setLoading(false);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const addLot = useCallback(async (lot: {
    lotNumber: string; materialName: string; manufacturer?: string;
    testId: string; parameterId?: string; level: string;
    targetMean: number; targetSd: number; unit?: string; expiryDate: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_lab_qc_lots').insert({
      lot_number: lot.lotNumber, material_name: lot.materialName,
      manufacturer: lot.manufacturer, test_id: lot.testId,
      parameter_id: lot.parameterId || null, level: lot.level,
      target_mean: lot.targetMean, target_sd: lot.targetSd,
      unit: lot.unit, expiry_date: lot.expiryDate, centre_id: centreId,
    });
    load();
  }, [centreId, load]);

  return { lots, loading, load, addLot };
}

// ============================================================
// QC RESULTS + LEVEY-JENNINGS
// ============================================================
export function useQCResults(lotId: string | null) {
  const [results, setResults] = useState<any[]>([]);
  const [lot, setLot] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (days: number = 30) => {
    if (!lotId || !sb()) return;
    setLoading(true);
    const since = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
    const [{ data: lotData }, { data: res }] = await Promise.all([
      sb().from('hmis_lab_qc_lots').select('*').eq('id', lotId).single(),
      sb().from('hmis_lab_qc_results')
        .select('*, performer:hmis_staff!hmis_lab_qc_results_performed_by_fkey(full_name)')
        .eq('lot_id', lotId).gte('run_date', since)
        .order('run_date').order('run_number'),
    ]);
    setLot(lotData);
    setResults(res || []);
    setLoading(false);
  }, [lotId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const addResult = useCallback(async (measuredValue: number, staffId: string) => {
    if (!lotId || !lot || !sb()) return null;

    // Get previous values for Westgard
    const previousValues = results.map(r => parseFloat(r.measured_value));
    const westgard = evaluateWestgard(measuredValue, parseFloat(lot.target_mean), parseFloat(lot.target_sd), previousValues);

    const sdFromMean = westgard.sdFromMean;
    const isAccepted = !westgard.isRejection;
    const runNum = results.filter(r => r.run_date === new Date().toISOString().split('T')[0]).length + 1;

    const { data, error } = await sb().from('hmis_lab_qc_results').insert({
      lot_id: lotId, measured_value: measuredValue,
      z_score: sdFromMean, sd_from_mean: sdFromMean,
      westgard_violation: westgard.violation,
      is_accepted: isAccepted,
      rejection_reason: westgard.violation && westgard.isRejection ? `Westgard ${westgard.violation} violation` : null,
      performed_by: staffId, run_number: runNum,
    }).select().single();

    if (!error) load();
    return { data, westgard };
  }, [lotId, lot, results, load]);

  // Levey-Jennings chart data
  const getLJData = useCallback(() => {
    if (!lot) return null;
    const mean = parseFloat(lot.target_mean);
    const sd = parseFloat(lot.target_sd);
    return {
      mean, sd,
      plus1: mean + sd, plus2: mean + 2 * sd, plus3: mean + 3 * sd,
      minus1: mean - sd, minus2: mean - 2 * sd, minus3: mean - 3 * sd,
      points: results.map(r => ({
        date: r.run_date, run: r.run_number,
        value: parseFloat(r.measured_value),
        sd: parseFloat(r.sd_from_mean),
        violation: r.westgard_violation,
        accepted: r.is_accepted,
      })),
    };
  }, [lot, results]);

  return { results, lot, loading, load, addResult, getLJData };
}
