// lib/emr/use-emr.ts
// Orchestration hook: combines Supabase hooks + offline storage + SW registration

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePatient, usePatientSearch, useEncounters, useTodayQueue, type EMRPatient, type EncounterData, type EncounterSummary } from './hooks';
import { cachePatient, getCachedPatient, saveDraft, getDraft, getAllUnsyncedDrafts, deleteDraft, isOnline, onConnectivityChange, cacheEncounterBatch, getCachedEncounters, addToSyncQueue, type EncounterDraft } from './offline';
import { useAuthStore } from '@/lib/store/auth';

export interface EMRState {
  // Patient
  patient: EMRPatient | null;
  patientLoading: boolean;
  selectPatient: (id: string) => void;

  // Search
  searchResults: any[];
  searchPatient: (q: string) => void;

  // Encounters
  pastEncounters: EncounterSummary[];
  encountersLoading: boolean;
  loadEncounter: (id: string) => Promise<EncounterData | null>;
  cloneEncounter: (id: string) => Promise<EncounterData | null>;

  // Save
  saveEncounter: (data: EncounterData) => Promise<{ success: boolean; id?: string; offline?: boolean }>;
  signEncounter: () => Promise<boolean>;
  autoSaveDraft: (data: EncounterData) => void;

  // Queue
  todayQueue: any[];

  // Connectivity
  online: boolean;
  pendingSyncs: number;
  syncNow: () => Promise<void>;

  // Centre
  centreId: string;
  doctorId: string;
}

export function useEMR(): EMRState {
  // Auth context
  const { staff, activeCentreId } = useAuthStore();
  const doctorId = staff?.id || '';
  const centreId = activeCentreId || '';

  // Patient selection
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const { patient, loading: patientLoading, addAllergy, removeAllergy, setPatient: setPatientState } = usePatient(selectedPatientId);
  const { results: searchResults, search: searchPatient } = usePatientSearch();

  // Encounters
  const { encounters: pastEncounters, loading: encountersLoading, activeEncounterId, setActiveEncounterId, loadEncounter: loadFromDB, saveEncounter: saveToDb, signEncounter: signInDb } = useEncounters(selectedPatientId);

  // Queue
  const { queue: todayQueue } = useTodayQueue(doctorId, centreId);

  // Connectivity
  const [online, setOnline] = useState(true);
  const [pendingSyncs, setPendingSyncs] = useState(0);

  // Track online/offline
  useEffect(() => {
    setOnline(isOnline());
    return onConnectivityChange(setOnline);
  }, []);

  // Check pending syncs on mount
  useEffect(() => {
    getAllUnsyncedDrafts().then(d => setPendingSyncs(d.length));
  }, []);

  // Register service worker
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/emr-sw.js', { scope: '/emr-v2' }).catch(() => {
      // SW registration may fail in dev — that's OK
    });
  }, []);

  // Cache patient when loaded
  useEffect(() => {
    if (patient) {
      cachePatient(patient).catch(() => {});
    }
  }, [patient]);

  // Cache encounter summaries
  useEffect(() => {
    if (pastEncounters.length > 0 && selectedPatientId) {
      cacheEncounterBatch(pastEncounters.map(e => ({ ...e, patientId: selectedPatientId }))).catch(() => {});
    }
  }, [pastEncounters, selectedPatientId]);

  // Select patient — try online first, fallback to cache
  const selectPatient = useCallback(async (id: string) => {
    setSelectedPatientId(id);
    if (!isOnline()) {
      const cached = await getCachedPatient(id);
      if (cached && setPatientState) {
        setPatientState(cached);
      }
    }
  }, [setPatientState]);

  // Load encounter — try online, fallback to cache
  const loadEncounter = useCallback(async (id: string): Promise<EncounterData | null> => {
    // First try local draft
    const draft = await getDraft(id);
    if (draft) return draft.data;

    // Then try Supabase
    if (isOnline()) {
      return loadFromDB(id);
    }

    return null;
  }, [loadFromDB]);

  // Clone encounter — load then return without setting as active
  const cloneEncounter = useCallback(async (id: string): Promise<EncounterData | null> => {
    return loadFromDB(id);
  }, [loadFromDB]);

  // Save encounter — online: Supabase, offline: IndexedDB + sync queue
  const saveEncounter = useCallback(async (data: EncounterData): Promise<{ success: boolean; id?: string; offline?: boolean }> => {
    if (isOnline()) {
      try {
        const result = await saveToDb(data, { centreId, doctorId });
        if (result.error) throw result.error;

        // Clear draft if exists
        if (activeEncounterId) {
          deleteDraft(activeEncounterId).catch(() => {});
        }

        return { success: true, id: result.data?.id };
      } catch (err) {
        // Fall through to offline save
      }
    }

    // Offline save
    const draftId = activeEncounterId || crypto.randomUUID();
    await saveDraft({
      id: draftId,
      patientId: selectedPatientId || '',
      centreId,
      doctorId,
      data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      synced: false,
    });

    setPendingSyncs(prev => prev + 1);

    // Request background sync
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      const reg = await navigator.serviceWorker.ready;
      await (reg as any).sync?.register('sync-encounters').catch(() => {});
    }

    return { success: true, id: draftId, offline: true };
  }, [saveToDb, centreId, doctorId, activeEncounterId, selectedPatientId]);

  // Sign encounter
  const signEncounterFn = useCallback(async (): Promise<boolean> => {
    if (!activeEncounterId || !doctorId) return false;
    const result = await signInDb(activeEncounterId, doctorId);
    return !result.error;
  }, [activeEncounterId, doctorId, signInDb]);

  // Auto-save draft (debounced) — called periodically from the page
  const autoSaveTimer = useRef<NodeJS.Timeout>();
  const autoSaveDraft = useCallback((data: EncounterData) => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      const draftId = activeEncounterId || (selectedPatientId ? `draft-${selectedPatientId}-${Date.now()}` : `draft-${Date.now()}`);
      saveDraft({
        id: draftId,
        patientId: selectedPatientId || '',
        centreId,
        doctorId,
        data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        synced: false,
      }).catch(() => {});
    }, 5000); // Auto-save every 5s of inactivity
  }, [activeEncounterId, selectedPatientId, centreId, doctorId]);

  // Manual sync
  const syncNow = useCallback(async () => {
    if (!isOnline()) return;
    const unsaved = await getAllUnsyncedDrafts();
    for (const draft of unsaved) {
      try {
        const result = await saveToDb(draft.data, {
          centreId: draft.centreId,
          doctorId: draft.doctorId,
        });
        if (!result.error) {
          await deleteDraft(draft.id);
        }
      } catch { /* will retry */ }
    }
    const remaining = await getAllUnsyncedDrafts();
    setPendingSyncs(remaining.length);
  }, [saveToDb]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (online && pendingSyncs > 0) {
      syncNow();
    }
  }, [online, pendingSyncs, syncNow]);

  return {
    patient,
    patientLoading,
    selectPatient,
    searchResults,
    searchPatient,
    pastEncounters,
    encountersLoading,
    loadEncounter,
    cloneEncounter,
    saveEncounter,
    signEncounter: signEncounterFn,
    autoSaveDraft,
    todayQueue,
    online,
    pendingSyncs,
    syncNow,
    centreId,
    doctorId,
  };
}
