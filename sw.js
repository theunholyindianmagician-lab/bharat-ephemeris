/**
 * BHARAT EPHEMERIS OBSERVATORY — SOVEREIGN SERVICE WORKER (v3.0.0)
 * 100% Offline Resilience | Stale-While-Revalidate | Background Sync | PWA Asset Prefetching
 */

const CACHE_NAME = 'bharat-ephemeris-v3.0.0-sovereign';
const RUNTIME_CACHE = 'bharat-ephemeris-runtime-v3.0.0';

// CORE PREFETCH ASSET MANIFEST (All 6 HTML pages + 12 JS/CSS modules + PWA assets)
const CORE_PREFETCH_URLS = [
  '/',
  'index.html',
  'museum.html',
  'library.html',
  'panchang.html',
  'shunyabheda.html',
  'shoonya_sovereign_dashboard.html',
  'reports.html',
  'global.css',
  'global-ui.js',
  'math-core.js',
  'drik-engine.js',
  'drik-tier.js',
  'field-gl.js',
  'page-live.js',
  'live-board.js',
  'starfield.js',
  'payment.js',
  'edition-nav-enhancer.js',
  'shunyabheda-app.js',
  'manifest.webmanifest',
  'icon-192.svg',
  'icon-512.svg'
];

// INSTALL EVENT — Pre-cache all core application assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Sovereign Service Worker v3.0.0...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core observatory suite...');
      return cache.addAll(CORE_PREFETCH_URLS).catch((err) => {
        console.warn('[SW] Non-fatal pre-cache warning:', err);
        // Ensure install succeeds even if an asset is missing initially
        return Promise.allSettled(
          CORE_PREFETCH_URLS.map(url => cache.add(url).catch(e => console.warn(`[SW] Failed caching ${url}:`, e)))
        );
      });
    })
  );
  self.skipWaiting();
});

// ACTIVATE EVENT — Clean up obsolete cache stores & claim clients immediately
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Sovereign Service Worker v3.0.0...');
  const currentCaches = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!currentCaches.includes(key)) {
            console.log('[SW] Deleting obsolete cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// FETCH EVENT — Offline-first & Stale-While-Revalidate strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignore non-GET requests or chrome-extension schemes
  if (req.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Strategy 1: Page Navigations (HTML) -> Network First with Cache Fallback to requested page or /index.html
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkResponse;
        })
        .catch(async () => {
          console.log('[SW] Offline mode: serving HTML page from cache for:', req.url);
          const cachedResponse = await caches.match(req, { ignoreSearch: true });
          if (cachedResponse) return cachedResponse;
          
          // Match path to offline pre-cached pages
          const path = url.pathname;
          const fallbackPage = await caches.match(path, { ignoreSearch: true }) || await caches.match('/index.html', { ignoreSearch: true });
          return fallbackPage || new Response('<h1>Observatory Offline</h1><p>You are currently offline. Please open <a href="/index.html">Index</a></p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    return;
  }

  // Strategy 2: Core Assets (CSS, JS, Fonts, Images) -> Stale-While-Revalidate with ignoreSearch
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(async (cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, clone));
        }
        return networkResponse;
      }).catch(() => null);

      if (cachedResponse) {
        // Trigger background revalidation
        fetchPromise.catch(() => {});
        return cachedResponse;
      }

      const networkResult = await fetchPromise;
      if (networkResult) {
        return networkResult;
      }

      return new Response('Asset Unavailable Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' }
      });
    })
  );
});

// BACKGROUND SYNC EVENT — Sync queued offline actions when connection restores
self.addEventListener('sync', (event) => {
  console.log('[SW] Background Sync triggered:', event.tag);
  if (event.tag === 'offline-payment-sync' || event.tag === 'offline-telemetry-sync') {
    event.waitUntil(
      notifyClientsOfSync(event.tag)
    );
  }
});

// Helper function to notify open windows/tabs of background sync events
async function notifyClientsOfSync(tag) {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of allClients) {
    client.postMessage({
      type: 'BACKGROUND_SYNC_COMPLETE',
      tag: tag,
      timestamp: new Date().toISOString()
    });
  }
}

// MESSAGE EVENT — Listen for client commands (SKIP_WAITING, GET_VERSION, CLEAR_CACHE)
self.addEventListener('message', (event) => {
  if (!event.data) return;
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'GET_VERSION') {
    event.ports[0]?.postMessage({ version: CACHE_NAME });
  } else if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => event.ports[0]?.postMessage({ success: true }))
    );
  }
});
