/* =============================================
   sw.js — Service Worker (PWA)
   Cacher kun app-filer, ALDRI data fra Supabase
   ============================================= */

const CACHE = 'familycal-v13';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/supabase.js',
  '/manifest.json',
  '/katt.jpg',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Aldri cache Supabase-kall, Leaflet eller kartfliser — alltid hent fra nett
  if (url.hostname.includes('supabase.co') ||
      url.hostname.includes('supabase.com') ||
      url.hostname.includes('jsdelivr.net') ||
      url.hostname.includes('unpkg.com') ||
      url.hostname.includes('tile.openstreetmap.org')) {
    e.respondWith(fetch(e.request));
    return;
  }

  // For app-filer: bruk cache, men oppdater i bakgrunnen
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, responseClone));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
