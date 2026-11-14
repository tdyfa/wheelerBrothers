const CACHE_NAME = 'outils-atelier-v56.5.3-r1';
const ASSETS = [
  './',
  './wb-workflow.js?v=56.5.3',
  './wb-workflow.css?v=56.5.3',
  './report-workflow.js?v=56.5.3',
  './index.html',
  './atelier.html?v=56.5.3',
  './rapport.html?v=56.5.3',
  './inventaire.html?v=56.5.3',
  './planning.html?v=56.5.3',
  './planning.js?v=56.5.3',
  './manifest.json?v=56.5.3',
  './firebase-config.js?v=56.5.3',
  './apple-touch-icon.png?v=56.5.3',
  './icon-192.png',
  './icon-512.png',
  './report-cover-logo.png',
  './report-ai.css?v=56.5.3',
  './report-ai-config.js?v=56.5.3',
  './report-ai-core.js?v=56.5.3',
  './report-ai.js?v=56.5.3',
  './report-images.js?v=56.5.3',
  './vehicle-info.js?v=56.5.3',
  './vehicle-input.js?v=56.5.3&build=2',
  './wb-phone.js?v=56.5.3',
  './html2pdf.bundle.min.js?v=56.5.3',
  './wb-carnet-pro.css?v=56.5.3',
  './wb-carnet-pro.js?v=56.5.3'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      const results = await Promise.allSettled(ASSETS.map(url =>
        cache.add(new Request(new URL(url, self.location.href), {cache:'reload'}))
      ));
      results.forEach((result,index) => {
        if(result.status === 'rejected')console.warn('Cache Atelier : ressource non disponible', ASSETS[index]);
      });
    } catch (_) {
      console.warn('Cache Atelier indisponible : fonctionnement réseau conservé.');
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith('outils-atelier-') && key !== CACHE_NAME)
        .map(key => caches.delete(key)));
    } catch (_) { /* A cache issue must not prevent the worker from taking control. */ }
    await self.clients.claim();
  })());
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
        try {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, response.clone()).catch(() => {});
        } catch (_) { /* Return the successful network response anyway. */ }
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

// Notifications push Planning (Firebase Cloud Messaging)
self.addEventListener('push', event => {
 let payload={};try{payload=event.data?.json()||{}}catch{}
 // Existing v55/v56 server sends data-only messages; also accept a notification payload.

 const data={...(payload.notification||{}),...(payload.data||{})};
 event.waitUntil(self.registration.showNotification(data.title||'WheelerBrothers Planning',{body:data.body||'Intervention mise à jour',icon:'./icon-192.png',data:{url:'./planning.html?v=56.5.3'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow('./planning.html?v=56.5.3'))});
