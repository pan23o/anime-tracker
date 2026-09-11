/* ONEBASE episode update notifications.
 * Uses the account's current library, checks the server-side Wikipedia checker,
 * updates local state, and offers one-click source searches.
 */
(function () {
  'use strict';

  const CHECK_KEY = 'onebase_episode_check_at_v1';
  const NOTIFIED_KEY = 'onebase_episode_notified_v1';
  const CHECK_INTERVAL = 6 * 60 * 60 * 1000;

  function getData() {
    try { return Array.isArray(window.data) ? window.data : []; } catch (_) { return []; }
  }

  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }

  function notifyBrowser(title, body, anime, episode) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = {
      body,
      tag: `onebase-episode-${encodeURIComponent(anime)}-${episode}`,
      data: { anime, episode },
      icon: '/favicon.png',
      badge: '/favicon.png'
    };
    try {
      if (navigator.serviceWorker?.controller) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options)).catch(() => {});
      } else {
        new Notification(title, options);
      }
    } catch (_) {}
  }

  async function askPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  }

  async function checkUpdates() {
    const list = getData();
    if (!list.length) return;
    const now = Date.now();
    const last = Number(localStorage.getItem(CHECK_KEY) || 0);
    if (now - last < CHECK_INTERVAL) return;
    localStorage.setItem(CHECK_KEY, String(now));

    try {
      const response = await fetch('/api/check-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: list.map((item, index) => ({
          id: item.id ?? index,
          anime: item.anime,
          total: item.total,
          watched: item.watched
        })) })
      });
      if (!response.ok) return;
      const result = await response.json();
      if (!Array.isArray(result.updates) || !result.updates.length) return;

      const notified = loadJson(NOTIFIED_KEY, {});
      let changed = false;

      for (const update of result.updates) {
        const item = list.find(x => (x.id != null && String(x.id) === String(update.id)) || String(x.anime || '').toLowerCase() === String(update.anime || '').toLowerCase());
        if (!item) continue;

        const previousTotal = Number(item.total) || Number(update.previousTotal) || 0;
        const watched = Number(item.watched) || 0;
        const nextTotal = Number(update.total);
        if (!Number.isFinite(nextTotal) || nextTotal <= previousTotal) continue;

        item.total = String(nextTotal);
        if (watched >= previousTotal && watched < nextTotal && item.state === 'terminado') item.state = 'viendo';
        item.newEpisodes = Math.max(0, nextTotal - watched);
        item.updatedAt = Date.now();
        changed = true;

        const key = `${item.id || item.anime}:${nextTotal}`;
        if (!notified[key]) {
          notified[key] = Date.now();
          notifyBrowser('Nuevo episodio en OneBase', `${item.anime}: el episodio ${nextTotal} ya está disponible.`, item.anime, nextTotal);
        }
      }

      if (changed) {
        saveJson(NOTIFIED_KEY, notified);
        try {
          if (typeof save === 'function') save({ skipBackup: true });
          if (typeof window.render === 'function') window.render();
        } catch (_) {}
      }
    } catch (error) {
      console.warn('[ONEBASE] Episode update check failed:', error);
    }
  }

  window.OneBaseEpisodeNotifications = { checkUpdates, askPermission };

  window.addEventListener('animetracker:restored', () => setTimeout(checkUpdates, 1200));
  window.addEventListener('onebase:txt-restored', () => setTimeout(checkUpdates, 1200));

  document.addEventListener('click', event => {
    const button = event.target.closest?.('[data-onebase-notifications]');
    if (!button) return;
    askPermission().then(permission => {
      if (permission === 'granted') {
        button.textContent = 'NOTIFICACIONES ACTIVADAS';
        button.classList.add('active');
      }
    });
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(checkUpdates, 2200), { once: true });
  } else {
    setTimeout(checkUpdates, 2200);
  }
})();
