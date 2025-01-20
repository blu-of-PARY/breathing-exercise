const CACHE_NAME = 'breathing-app-v1';
const urlsToCache = [
  '/breathing-exercise/',
  '/breathing-exercise/index.html',
  '/breathing-exercise/styles.css',
  '/breathing-exercise/script.js',
  '/breathing-exercise/manifest.json',
  '/breathing-exercise/icons/icon-192x192.png',
  '/breathing-exercise/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
}); 