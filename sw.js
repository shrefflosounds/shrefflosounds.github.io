// Sidehop Cache Purger & Service Worker Uninstaller
// Immediately unregisters service workers and purges all cached assets

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(clients => {
        for (const client of clients) {
          if (client.navigate) client.navigate(client.url);
        }
      })
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Always fetch live directly from network, never cache
  e.respondWith(fetch(e.request));
});
