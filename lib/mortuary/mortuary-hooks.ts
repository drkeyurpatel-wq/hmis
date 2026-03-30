// lib/mortuary/mortuary-hooks.ts
import { useState, useEffect, useCallback, useMemo } from 'react';
import { sb } from '@/lib/supabase/browser';

export interface MortuaryRecord {
  id: string; centre_id: string;
  patient_id: string | null; admission_id: string | null;
  death_certificate_number: string | null; cause_of_death: string | null;
  time_of_death: string | null; declared_by: string | null;
  body_received_at: string; storage_unit: string | null;
  embalming_done: boolean; post_mortem_required: boolean;
  post_mortem_done: boolean; police_intimation: boolean;
  released_to: string | null; released_at: string | null;
  release_authorized_by: string | null;
  id_proof_collected: boolean; noc_from_police: boolean;
  status: 'received' | 'stored' | 'post_mortem' | 'released';
  notes: string | null; created_at: string;
  patient?: { first_name: string; last_name: string; uhid: string; age_years: number; gender: string };
  declarer?: { full_name: string };
  authorizer?: { full_name: string };
}

export function useMortuary(centreId: string | null) {
  const [records, setRecords] = useState<MortuaryRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (showReleased?: boolean) => {
    if (!centreId || !sb()) return;
    setLoading(true);
    let q = sb().from('hmis_mortuary')
      .select(`*, patient:hmis_patients(first_name, last_name, uhid, age_years, gender),
        declarer:hmis_staff!hmis_mortuary_declared_by_fkey(full_name),
        authorizer:hmis_staff!hmis_mortuary_release_authorized_by_fkey(full_name)`)
      .eq('centre_id', centreId)
      .order('body_received_at', { ascending: false }).limit(100);
    if (!showReleased) q = q.neq('status', 'released');
    const { data } = await q;
    setRecords(data || []);
    setLoading(false);
  }, [centreId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    total: records.length,
    received: records.filter(r => r.status === 'received').length,
    stored: records.filter(r => r.status === 'stored').length,
    postMortem: records.filter(r => r.status === 'post_mortem').length,
    released: records.filter(r => r.status === 'released').length,
    currentOccupancy: records.filter(r => r.status !== 'released').length,
    pendingPM: records.filter(r => r.post_mortem_required && !r.post_mortem_done).length,
    pendingRelease: records.filter(r => r.status !== 'released' && !r.post_mortem_required).length
      + records.filter(r => r.post_mortem_required && r.post_mortem_done && r.status !== 'released').length,
  }), [records]);

  const addRecord = useCallback(async (data: {
    patientId?: string; admissionId?: string; causeOfDeath?: string;
    timeOfDeath?: string; declaredBy?: string; storageUnit?: string;
    postMortemRequired?: boolean; policeIntimation?: boolean; notes?: string;
  }) => {
    if (!centreId || !sb()) return;
    await sb().from('hmis_mortuary').insert({
      centre_id: centreId, patient_id: data.patientId || null,
      admission_id: data.admissionId || null,
      cause_of_death: data.causeOfDeath || null,
      time_of_death: data.timeOfDeath || null,
      declared_by: data.declaredBy || null,
      storage_unit: data.storageUnit || null,
      post_mortem_required: data.postMortemRequired || false,
      police_intimation: data.policeIntimation || false,
      notes: data.notes || null, status: 'received',
    });
    load();
  }, [centreId, load]);

  const updateRecord = useCallback(async (id: string, updates: Partial<MortuaryRecord>) => {
    if (!sb()) return;
    await sb().from('hmis_mortuary').update(updates).eq('id', id);
    load();
  }, [load]);

  const releaseBody = useCallback(async (id: string, data: {
    releasedTo: string; authorizedBy: string;
    deathCertNumber?: string; idProofCollected: boolean; nocFromPolice: boolean;
  }) => {
    if (!sb()) return;
    const record = records.find(r => r.id === id);
    // Block release if post-mortem required but not done
    if (record?.post_mortem_required && !record?.post_mortem_done) {
      return { error: 'Post-mortem required but not completed' };
    }
    // Block release if police case and NOC not collected
    if (record?.police_intimation && !data.nocFromPolice) {
      return { error: 'Police NOC required before release' };
    }
    await sb().from('hmis_mortuary').update({
      status: 'released', released_to: data.releasedTo,
      released_at: new Date().toISOString(),
      release_authorized_by: data.authorizedBy,
      death_certificate_number: data.deathCertNumber || record?.death_certificate_number || null,
      id_proof_collected: data.idProofCollected,
      noc_from_police: data.nocFromPolice,
    }).eq('id', id);
    load();
    return { error: null };
  }, [records, load]);

  return { records, loading, stats, load, addRecord, updateRecord, releaseBody };
}
