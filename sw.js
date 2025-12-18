const CACHE_NAME = 'equip-control-v2';
const ASSETS = [
  './',
  './index.html',
  './index.tsx',
  './manifest.json',
  './App.tsx',
  './db.ts',
  './types.ts',
  './constants.ts',
  './components/icons.tsx',
  './components/SideMenu.tsx'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Solve 404s on navigation by serving index.html for navigation requests
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request).then((networkResponse) => {
        // Optionally cache new resources here
        return networkResponse;
      });
    }).catch(() => {
        // Fallback for images or specific assets if needed
    })
  );
});