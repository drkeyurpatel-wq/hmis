// lib/emr/offline.ts
// Offline-first storage using IndexedDB for EMR data
// Caches: CDSS data, last 50 patients, draft encounters

const DB_NAME = 'h1_emr_offline';
const DB_VERSION = 1;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      // Patient cache
      if (!db.objectStoreNames.contains('patients')) {
        const ps = db.createObjectStore('patients', { keyPath: 'id' });
        ps.createIndex('uhid', 'uhid', { unique: true });
        ps.createIndex('lastAccessed', 'lastAccessed');
      }
      // Encounter drafts (unsaved)
      if (!db.objectStoreNames.contains('drafts')) {
        const ds = db.createObjectStore('drafts', { keyPath: 'id' });
        ds.createIndex('patientId', 'patientId');
        ds.createIndex('createdAt', 'createdAt');
      }
      // Encounter history cache
      if (!db.objectStoreNames.contains('encounters')) {
        const es = db.createObjectStore('encounters', { keyPath: 'id' });
        es.createIndex('patientId', 'patientId');
      }
      // Sync queue (pending writes)
      if (!db.objectStoreNames.contains('syncQueue')) {
        db.createObjectStore('syncQueue', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(store: string, mode: IDBTransactionMode = 'readonly') {
  const db = await openDB();
  return db.transaction(store, mode).objectStore(store);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ============================================================
// PATIENT CACHE
// ============================================================

export async function cachePatient(patient: any): Promise<void> {
  const store = await tx('patients', 'readwrite');
  await reqToPromise(store.put({ ...patient, lastAccessed: Date.now() }));

  // Evict oldest if > 50 cached
  const countReq = store.count();
  const count = await reqToPromise(countReq);
  if (count > 50) {
    const idx = store.index('lastAccessed');
    const cursor = idx.openCursor();
    let deleted = 0;
    const toDelete = count - 50;
    return new Promise((resolve) => {
      cursor.onsuccess = (e) => {
        const c = (e.target as IDBRequest).result;
        if (c && deleted < toDelete) {
          c.delete();
          deleted++;
          c.continue();
        } else {
          resolve();
        }
      };
    });
  }
}

export async function getCachedPatient(id: string): Promise<any | null> {
  try {
    const store = await tx('patients');
    return await reqToPromise(store.get(id));
  } catch {
    return null;
  }
}

export async function searchCachedPatients(query: string): Promise<any[]> {
  try {
    const store = await tx('patients');
    const all = await reqToPromise(store.getAll());
    const q = query.toLowerCase();
    return all.filter((p: any) =>
      p.uhid?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q) ||
      p.phone?.includes(q)
    ).slice(0, 10);
  } catch {
    return [];
  }
}

// ============================================================
// ENCOUNTER DRAFTS
// ============================================================

export interface EncounterDraft {
  id: string;          // uuid or temp id
  patientId: string;
  centreId: string;
  doctorId: string;
  data: any;           // full EMR state
  createdAt: number;
  updatedAt: number;
  synced: boolean;
}

export async function saveDraft(draft: EncounterDraft): Promise<void> {
  const store = await tx('drafts', 'readwrite');
  await reqToPromise(store.put({ ...draft, updatedAt: Date.now() }));
}

export async function getDraft(id: string): Promise<EncounterDraft | null> {
  try {
    const store = await tx('drafts');
    return await reqToPromise(store.get(id));
  } catch {
    return null;
  }
}

export async function getPatientDrafts(patientId: string): Promise<EncounterDraft[]> {
  try {
    const store = await tx('drafts');
    const idx = store.index('patientId');
    return await reqToPromise(idx.getAll(patientId));
  } catch {
    return [];
  }
}

export async function deleteDraft(id: string): Promise<void> {
  const store = await tx('drafts', 'readwrite');
  await reqToPromise(store.delete(id));
}

export async function getAllUnsyncedDrafts(): Promise<EncounterDraft[]> {
  try {
    const store = await tx('drafts');
    const all = await reqToPromise(store.getAll());
    return all.filter((d: EncounterDraft) => !d.synced);
  } catch {
    return [];
  }
}

// ============================================================
// ENCOUNTER HISTORY CACHE
// ============================================================

export async function cacheEncounterSummary(encounter: any): Promise<void> {
  const store = await tx('encounters', 'readwrite');
  await reqToPromise(store.put(encounter));
}

export async function cacheEncounterBatch(encounters: any[]): Promise<void> {
  const store = await tx('encounters', 'readwrite');
  for (const e of encounters) {
    store.put(e);
  }
}

export async function getCachedEncounters(patientId: string): Promise<any[]> {
  try {
    const store = await tx('encounters');
    const idx = store.index('patientId');
    return await reqToPromise(idx.getAll(patientId));
  } catch {
    return [];
  }
}

// ============================================================
// SYNC QUEUE
// ============================================================

export async function addToSyncQueue(action: { type: string; payload: any }): Promise<void> {
  const store = await tx('syncQueue', 'readwrite');
  await reqToPromise(store.add({ ...action, createdAt: Date.now() }));
}

export async function getSyncQueue(): Promise<any[]> {
  try {
    const store = await tx('syncQueue');
    return await reqToPromise(store.getAll());
  } catch {
    return [];
  }
}

export async function clearSyncQueue(): Promise<void> {
  const store = await tx('syncQueue', 'readwrite');
  await reqToPromise(store.clear());
}

// ============================================================
// CONNECTIVITY CHECK
// ============================================================

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const onOnline = () => callback(true);
  const onOffline = () => callback(false);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}
