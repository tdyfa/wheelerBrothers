const CACHE_NAME = 'outils-atelier-v53.3-r2';
const ASSETS = [
  './',
  './index.html',
  './atelier.html?v=53.3',
  './rapport.html?v=53.3',
  './inventaire.html?v=53.3',
  './manifest.json?v=53.3',
  './firebase-config.js?v=53.3',
  './apple-touch-icon.png?v=53.3',
  './icon-192.png',
  './icon-512.png',
  './report-cover-logo.png',
  './report-ai.css?v=53.3',
  './report-ai-config.js?v=53.3',
  './report-ai-core.js?v=53.3',
  './report-ai.js?v=53.3',
  './report-images.js?v=53.3',
  './vehicle-info.js?v=53.3',
  './vehicle-input.js?v=53.3&build=2',
  './html2pdf.bundle.min.js?v=53.3',
  './wb-carnet-pro.css?v=53.3',
  './wb-carnet-pro.js?v=53.3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.map(url => new Request(url, { cache: 'reload' })))));
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
