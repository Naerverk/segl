// segl. no longer uses a service worker. Browsers that installed the old offline version still
// check this URL for updates; this replacement removes itself: it deletes the old caches,
// unregisters and reloads open tabs so they load the current app straight from the network.
// It intercepts no requests. New visitors never register it.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
