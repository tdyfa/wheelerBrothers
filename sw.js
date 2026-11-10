const CACHE_NAME = 'outils-atelier-v55.1-r1';
const ASSETS = [
  './',
  './index.html',
  './atelier.html?v=55.1',
  './rapport.html?v=54',
  './inventaire.html?v=54',
  './planning.html?v=55.1',
  './planning.js?v=55.1',
  './manifest.json?v=54',
  './firebase-config.js?v=54',
  './apple-touch-icon.png?v=54',
  './icon-192.png',
  './icon-512.png',
  './report-cover-logo.png',
  './report-ai.css?v=54',
  './report-ai-config.js?v=54',
  './report-ai-core.js?v=54',
  './report-ai.js?v=54',
  './report-images.js?v=54',
  './vehicle-info.js?v=54',
  './vehicle-input.js?v=55.1&build=2',
  './html2pdf.bundle.min.js?v=54',
  './wb-carnet-pro.css?v=54',
  './wb-carnet-pro.js?v=54'
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

// Notifications push Planning (Firebase Cloud Messaging)
self.addEventListener('push', event => {
 let payload={};try{payload=event.data?.json()||{}}catch{}
 // FCM notifications are handled by the Firebase messaging service worker integration below.
 if(payload.notification)return;
 const data=payload.data||{};
 event.waitUntil(self.registration.showNotification(data.title||'WheelerBrothers Planning',{body:data.body||'Intervention mise à jour',icon:'./icon-192.png',data:{url:'./planning.html?v=55.1'}}));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(self.clients.openWindow('./planning.html?v=55.1'))});
