self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = new URL('/', self.location.origin);
  if (data.anime) url.searchParams.set('episodeUpdate', data.anime);
  if (data.episode) url.searchParams.set('episode', String(data.episode));
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => 'focus' in client);
    if (existing) {
      existing.navigate(url.href);
      return existing.focus();
    }
    return clients.openWindow(url.href);
  }));
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  const title = data.title || 'OneBase';
  const options = {
    body: data.body || 'Tienes una actualización nueva.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'onebase-update',
    data: data.data || {}
  };
  event.waitUntil(self.registration.showNotification(title, options));
});
