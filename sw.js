const CACHE_NAME = 'outils-atelier-v49.4';
const ASSETS = [
  './',
  './index.html',
  './atelier.html?v=49.4',
  './rapport.html?v=49.4',
  './inventaire.html?v=49.4',
  './manifest.json?v=49.4',
  './firebase-config.js?v=49.4',
  './apple-touch-icon.png?v=49.4',
  './icon-192.png',
  './icon-512.png',
  './report-cover-logo.png',
  './html2pdf.bundle.min.js?v=49.4',
  './wb-carnet-pro.css?v=49.4',
  './wb-carnet-pro.js?v=49.4'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Toujours demander au réseau la version actuelle des fichiers de l'application.
// Le cache ne sert que de secours hors connexion.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(event.request, { cache: 'no-store' });
      if (response && response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, response.clone()).catch(() => {});
      }
      return response;
    } catch (_) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      if (event.request.mode === 'navigate') {
        return (await caches.match('./index.html')) || Response.error();
      }
      return Response.error();
    }
  })());
});
