// lib/pharmacy/pharmacy-v2-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

let _sb: any = null;
function sb() { if (typeof window === 'undefined') return null as any; if (!_sb) { try { _sb = createClient(); } catch { return null; } } return _sb; }

// ============================================================
// RETURNS & WRITE-OFFS
// ============================================================
export function usePharmacyReturns(centreId: string | null) {
  const [returns, setReturns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_pharmacy_returns')
      .select('*, drug:hmis_drug_master(drug_name, generic_name), staff:hmis_staff!hmis_pharmacy_returns_processed_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(100);
    setReturns(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const processReturn = useCallback(async (data: {
    drugId: string; quantity: number; batchNumber: string; returnType: 'patient_return' | 'supplier_return' | 'expiry_write_off' | 'damage';
    reason: string; patientId?: string; dispensingId?: string; amount: number; staffId: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!centreId || !sb()) return { success: false };

    const { error } = await sb().from('hmis_pharmacy_returns').insert({
      centre_id: centreId, drug_id: data.drugId, quantity: data.quantity,
      batch_number: data.batchNumber, return_type: data.returnType,
      reason: data.reason, patient_id: data.patientId || null,
      dispensing_id: data.dispensingId || null, refund_amount: data.amount,
      processed_by: data.staffId, status: 'processed',
    });
    if (error) return { success: false, error: error.message };

    // Restock (except write-offs and damage)
    if (['patient_return', 'supplier_return'].includes(data.returnType)) {
      const { data: stock } = await sb().from('hmis_pharmacy_stock')
        .select('id, quantity').eq('centre_id', centreId).eq('drug_id', data.drugId)
        .eq('batch_number', data.batchNumber).maybeSingle();
      if (stock) {
        await sb().from('hmis_pharmacy_stock').update({ quantity: parseFloat(stock.quantity) + data.quantity }).eq('id', stock.id);
      }
    }

    load();
    return { success: true };
  }, [centreId, load]);

  const stats = useMemo(() => ({
    total: returns.length,
    patientReturns: returns.filter((r: any) => r.return_type === 'patient_return').length,
    expiryWriteOff: returns.filter((r: any) => r.return_type === 'expiry_write_off').length,
    totalRefund: returns.reduce((s: number, r: any) => s + parseFloat(r.refund_amount || 0), 0),
  }), [returns]);

  return { returns, loading, stats, load, processReturn };
}

// ============================================================
// INTER-CENTRE TRANSFERS
// ============================================================
export function useStockTransfers(centreId: string | null) {
  const [transfers, setTransfers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_pharmacy_transfers')
      .select('*, drug:hmis_drug_master(drug_name), from_centre:hmis_centres!hmis_pharmacy_transfers_from_centre_id_fkey(name, code), to_centre:hmis_centres!hmis_pharmacy_transfers_to_centre_id_fkey(name, code)')
      .or(`from_centre_id.eq.${centreId},to_centre_id.eq.${centreId}`)
      .order('created_at', { ascending: false }).limit(50);
    setTransfers(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const createTransfer = useCallback(async (data: {
    drugId: string; quantity: number; batchNumber: string;
    toCentreId: string; reason: string; staffId: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!centreId || !sb()) return { success: false };

    // Deduct from source
    const { data: stock } = await sb().from('hmis_pharmacy_stock')
      .select('id, quantity').eq('centre_id', centreId).eq('drug_id', data.drugId)
      .eq('batch_number', data.batchNumber).maybeSingle();
    if (!stock || parseFloat(stock.quantity) < data.quantity) return { success: false, error: 'Insufficient stock' };

    const { error } = await sb().from('hmis_pharmacy_transfers').insert({
      from_centre_id: centreId, to_centre_id: data.toCentreId,
      drug_id: data.drugId, quantity: data.quantity, batch_number: data.batchNumber,
      reason: data.reason, status: 'initiated', initiated_by: data.staffId,
    });
    if (error) return { success: false, error: error.message };

    await sb().from('hmis_pharmacy_stock').update({ quantity: parseFloat(stock.quantity) - data.quantity }).eq('id', stock.id);
    load();
    return { success: true };
  }, [centreId, load]);

  const receiveTransfer = useCallback(async (transferId: string, staffId: string) => {
    const transfer = transfers.find((t: any) => t.id === transferId);
    if (!transfer) return;

    // Add stock at receiving centre
    const { data: existingStock } = await sb().from('hmis_pharmacy_stock')
      .select('id, quantity').eq('centre_id', transfer.to_centre_id).eq('drug_id', transfer.drug_id)
      .eq('batch_number', transfer.batch_number).maybeSingle();

    if (existingStock) {
      await sb().from('hmis_pharmacy_stock').update({ quantity: parseFloat(existingStock.quantity) + parseFloat(transfer.quantity) }).eq('id', existingStock.id);
    }

    await sb().from('hmis_pharmacy_transfers').update({ status: 'received', received_by: staffId, received_at: new Date().toISOString() }).eq('id', transferId);
    load();
  }, [transfers, load]);

  return { transfers, loading, load, createTransfer, receiveTransfer };
}

// ============================================================
// CONTROLLED SUBSTANCES
// ============================================================
export function useControlledSubstances(centreId: string | null) {
  const [register, setRegister] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!centreId || !sb()) return;
    setLoading(true);
    const { data } = await sb().from('hmis_controlled_substance_log')
      .select('*, drug:hmis_drug_master(drug_name, generic_name, schedule), staff:hmis_staff!hmis_controlled_substance_log_administered_by_fkey(full_name), witness:hmis_staff!hmis_controlled_substance_log_witnessed_by_fkey(full_name)')
      .eq('centre_id', centreId).order('created_at', { ascending: false }).limit(100);
    setRegister(data || []);
    setLoading(false);
  }, [centreId]);

  useEffect(() => { load(); }, [load]);

  const addEntry = useCallback(async (data: {
    drugId: string; quantity: number; batchNumber: string;
    transactionType: 'received' | 'dispensed' | 'returned' | 'destroyed' | 'wastage';
    patientId?: string; admissionId?: string;
    administeredBy: string; witnessedBy: string; notes?: string;
  }): Promise<{ success: boolean; error?: string }> => {
    if (!centreId || !sb()) return { success: false };
    if (!data.witnessedBy) return { success: false, error: 'Witness required for controlled substances' };

    const { error } = await sb().from('hmis_controlled_substance_log').insert({
      centre_id: centreId, drug_id: data.drugId, quantity: data.quantity,
      batch_number: data.batchNumber, transaction_type: data.transactionType,
      patient_id: data.patientId || null, admission_id: data.admissionId || null,
      administered_by: data.administeredBy, witnessed_by: data.witnessedBy,
      notes: data.notes || '', balance_after: 0, // Calculated
    });
    if (error) return { success: false, error: error.message };
    load();
    return { success: true };
  }, [centreId, load]);

  const stats = useMemo(() => ({
    totalEntries: register.length,
    dispensed: register.filter((r: any) => r.transaction_type === 'dispensed').length,
    wastage: register.filter((r: any) => r.transaction_type === 'wastage').length,
    unwitnessed: register.filter((r: any) => !r.witnessed_by).length,
  }), [register]);

  return { register, loading, stats, load, addEntry };
}
