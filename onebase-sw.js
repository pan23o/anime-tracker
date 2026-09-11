function sourceUrls(title, episode) {
  const q = encodeURIComponent(`${title} ${String(episode).padStart(2, '0')}`);
  return [
    `https://nyaa.si/?f=0&c=0_0&q=${q}`,
    `https://subplease.org/?s=${q}`,
    `https://ext.to/browse/?q=${q}`
  ];
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const data = event.notification.data || {};
  const anime = String(data.anime || '').trim();
  const episode = Number(data.episode);

  event.waitUntil((async () => {
    const urls = anime && Number.isInteger(episode) && episode > 0 ? sourceUrls(anime, episode) : [];
    const appUrl = new URL('/', self.location.origin);
    if (anime) appUrl.searchParams.set('episodeUpdate', anime);
    if (episode > 0) appUrl.searchParams.set('episode', String(episode));

    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => 'focus' in client);
    if (existing) {
      try { await existing.navigate(appUrl.href); await existing.focus(); } catch (_) {}
    } else {
      try { await clients.openWindow(appUrl.href); } catch (_) {}
    }

    for (const url of urls) {
      try { await clients.openWindow(url); } catch (_) {}
    }
  })());
});

self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (_) {}
  event.waitUntil(self.registration.showNotification(data.title || 'OneBase', {
    body: data.body || 'Tienes una actualización nueva.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: data.tag || 'onebase-update',
    renotify: true,
    data: data.data || {}
  }));
});
