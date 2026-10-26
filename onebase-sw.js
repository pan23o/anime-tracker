/* Legacy OneBase push worker: no notifications are displayed. */
self.addEventListener('install', event => { event.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', event => { event.waitUntil(self.clients.claim()); });
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    const registrations = await self.registration.pushManager.getSubscription();
    if (registrations) await registrations.unsubscribe();
  })());
});
