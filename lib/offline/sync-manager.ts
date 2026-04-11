// lib/offline/sync-manager.ts
// Stores EMR encounters in IndexedDB when offline, syncs when back online

const DB_NAME = 'h1_hmis_offline';
const DB_VERSION = 1;
const STORE_ENCOUNTERS = 'pending_encounters';
const STORE_VITALS = 'pending_vitals';
const STORE_CHARGES = 'pending_charges';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ENCOUNTERS)) db.createObjectStore(STORE_ENCOUNTERS, { keyPath: 'localId' });
      if (!db.objectStoreNames.contains(STORE_VITALS)) db.createObjectStore(STORE_VITALS, { keyPath: 'localId' });
      if (!db.objectStoreNames.contains(STORE_CHARGES)) db.createObjectStore(STORE_CHARGES, { keyPath: 'localId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---- SAVE OFFLINE ----
export async function saveOfflineEncounter(encounter: any): Promise<string> {
  const db = await openDB();
  const localId = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = db.transaction(STORE_ENCOUNTERS, 'readwrite');
  tx.objectStore(STORE_ENCOUNTERS).put({ ...encounter, localId, savedAt: new Date().toISOString(), synced: false });
  return localId;
}

export async function saveOfflineVitals(vitals: any): Promise<string> {
  const db = await openDB();
  const localId = `vit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = db.transaction(STORE_VITALS, 'readwrite');
  tx.objectStore(STORE_VITALS).put({ ...vitals, localId, savedAt: new Date().toISOString(), synced: false });
  return localId;
}

export async function saveOfflineCharge(charge: any): Promise<string> {
  const db = await openDB();
  const localId = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tx = db.transaction(STORE_CHARGES, 'readwrite');
  tx.objectStore(STORE_CHARGES).put({ ...charge, localId, savedAt: new Date().toISOString(), synced: false });
  return localId;
}

// ---- READ PENDING ----
export async function getPendingEncounters(): Promise<any[]> {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_ENCOUNTERS, 'readonly');
    const req = tx.objectStore(STORE_ENCOUNTERS).getAll();
    req.onsuccess = () => resolve((req.result || []).filter((e: any) => !e.synced));
    req.onerror = () => resolve([]);
  });
}

export async function getPendingCount(): Promise<number> {
  const encounters = await getPendingEncounters();
  return encounters.length;
}

// ---- MARK SYNCED ----
export async function markSynced(localId: string, store: string = STORE_ENCOUNTERS): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  const obj = tx.objectStore(store);
  const req = obj.get(localId);
  req.onsuccess = () => {
    if (req.result) {
      obj.put({ ...req.result, synced: true, syncedAt: new Date().toISOString() });
    }
  };
}

// ---- SYNC ALL ----
export async function syncAll(supabaseClient: any): Promise<{ synced: number; failed: number }> {
  let synced = 0, failed = 0;

  // Sync encounters
  const encounters = await getPendingEncounters();
  for (const enc of encounters) {
    try {
      const { localId, savedAt, synced: _, syncedAt, ...data } = enc;
      const { error } = await supabaseClient.from('hmis_emr_encounters').insert(data);
      if (!error) { await markSynced(localId); synced++; } else { failed++; }
    } catch { failed++; }
  }

  // Sync vitals
  const db = await openDB();
  const vitals: any[] = await new Promise((resolve) => {
    const tx = db.transaction(STORE_VITALS, 'readonly');
    const req = tx.objectStore(STORE_VITALS).getAll();
    req.onsuccess = () => resolve((req.result || []).filter((v: any) => !v.synced));
    req.onerror = () => resolve([]);
  });
  for (const vit of vitals) {
    try {
      const { localId, savedAt, synced: _, syncedAt, ...data } = vit;
      const { error } = await supabaseClient.from('hmis_vitals').insert(data);
      if (!error) { await markSynced(localId, STORE_VITALS); synced++; } else { failed++; }
    } catch { failed++; }
  }

  return { synced, failed };
}

// ---- ONLINE STATUS HOOK ----
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}
