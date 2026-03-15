// public/emr-sw.js
// Health1 EMR Service Worker — offline-first PWA
// Caches: app shell, CDSS data, API responses
// Background sync: queued encounter saves

const CACHE_NAME = 'h1-emr-v3';
const CDSS_CACHE = 'h1-cdss-v3';

// App shell — pages and static assets to pre-cache
const APP_SHELL = [
  '/emr-v2',
  '/offline.html',
];

// Install: pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Some URLs may not be available during install — that's OK
        console.log('[EMR SW] Some app shell URLs unavailable during install');
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== CDSS_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy: Network-first for API, Cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and cross-origin
  if (event.request.method !== 'GET') return;
  if (url.origin !== self.location.origin && !url.hostname.includes('supabase')) return;

  // Supabase API calls: network-first with cache fallback
  if (url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache successful GET responses
          if (response.ok) {
            const clone = response.clone();
            caches.open(CDSS_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline: serve from cache
          return caches.match(event.request).then((cached) => {
            return cached || new Response(JSON.stringify({ error: 'offline', data: null }), {
              headers: { 'Content-Type': 'application/json' },
            });
          });
        })
    );
    return;
  }

  // Next.js pages and assets: stale-while-revalidate
  if (url.pathname.startsWith('/emr-v2') || url.pathname.startsWith('/_next/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          // If both cache and network fail, serve offline page
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
          return new Response('', { status: 503 });
        });

        return cached || networkFetch;
      })
    );
    return;
  }
});

// Background sync: retry failed encounter saves
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-encounters') {
    event.waitUntil(syncEncounters());
  }
});

async function syncEncounters() {
  // Open IndexedDB to get sync queue
  try {
    const db = await openDB();
    const tx = db.transaction('syncQueue', 'readwrite');
    const store = tx.objectStore('syncQueue');

    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = async () => {
        const items = req.result || [];
        for (const item of items) {
          try {
            const response = await fetch(item.payload.url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...item.payload.headers },
              body: JSON.stringify(item.payload.body),
            });
            if (response.ok) {
              store.delete(item.id);
            }
          } catch {
            // Will retry on next sync
          }
        }
        resolve();
      };
    });
  } catch {
    // IndexedDB not available in SW context sometimes
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('h1_emr_offline', 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// Push notification support (for future: lab results ready, etc.)
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Health1 EMR', {
      body: data.body || '',
      icon: '/logos/h1-icon-192.png',
      badge: '/logos/h1-badge-72.png',
      tag: data.tag || 'emr-notification',
    })
  );
});
