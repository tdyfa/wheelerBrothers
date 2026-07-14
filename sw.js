const CACHE_NAME = 'outils-atelier-v45';
const ASSETS = [
  './',
  './index.html',
  './atelier.html',
  './rapport.html',
  './inventaire.html',
  './manifest.json',
  './firebase-config.js',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  './report-cover-logo.png',
  './html2pdf.bundle.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Stratégie : réseau d'abord (pour récupérer les mises à jour), repli sur le cache si hors-ligne
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
