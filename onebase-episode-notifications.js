(function () {
  'use strict';

  const CHECK_KEY = 'onebase_episode_check_at_v2';
  const NOTIFIED_KEY = 'onebase_episode_notified_v2';
  const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
  const SUPABASE_URL = 'https://djfjqecahztogacliavh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
  let vapidPublicKey = '';

  function getData() {
    try { return Array.isArray(window.data) ? window.data : []; } catch (_) { return []; }
  }
  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback)); } catch (_) { return fallback; }
  }
  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (_) {}
  }
  function notifyOneBase(title, body, anime, episode) {
    window.OneBaseNotifications?.show?.(title, body, { kicker: 'Nuevos episodios', icon: '◷', anime, episode });
  }
  async function getClient() {
    if (window.OneBaseSupabase) return window.OneBaseSupabase;
    if (!window.supabase?.createClient) return null;
    window.OneBaseSupabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    return window.OneBaseSupabase;
  }
  async function registerServiceWorker() {
    if (window.OneBaseNotifications?.register) return window.OneBaseNotifications.register();
    if (!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.register('/onebase-sw.js', { scope: '/' }); }
    catch (error) { console.warn('[ONEBASE] Service worker registration failed:', error); return null; }
  }
  function urlBase64ToUint8Array(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, char => char.charCodeAt(0));
  }
  async function askPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'default') return Notification.requestPermission();
    return Notification.permission;
  }
  async function getVapidPublicKey() {
    if (vapidPublicKey) return vapidPublicKey;
    const response = await fetch(`${SUPABASE_URL}/functions/v1/onebase-episode-cron?config=vapid`, { headers: { apikey: SUPABASE_KEY } });
    if (!response.ok) throw new Error('No se pudo inicializar el sistema de notificaciones.');
    const data = await response.json();
    if (!data?.publicKey) throw new Error(data?.error || 'No hay clave pública de notificaciones disponible.');
    vapidPublicKey = data.publicKey;
    return vapidPublicKey;
  }
  async function enablePush() {
    window.OneBaseNotifications?.setEnabled?.(true);
    updateNotificationButtons(true);
    return true;
  }
  async function retireBrowserPush() {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
      for (const registration of registrations) {
        const urls = [registration.active, registration.waiting, registration.installing].filter(Boolean).map(worker => worker.scriptURL || '');
        if (!urls.some(url => /\/onebase-sw\.js(?:[?#]|$)/i.test(url))) continue;
        const subscription = await registration.pushManager?.getSubscription?.().catch?.(() => null);
        if (subscription) {
          try {
            const client = await getClient().catch(() => null);
            const session = client ? (await client.auth.getSession()).data?.session : null;
            if (session?.access_token) await fetch(`${SUPABASE_URL}/functions/v1/onebase-notifications`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
          } catch (_) {}
          try { await subscription.unsubscribe(); } catch (_) {}
        }
        try { await registration.unregister(); } catch (_) {}
      }
    } catch (_) {}
  }
  async function disablePush() {
    window.OneBaseNotifications?.setEnabled?.(false);
    await retireBrowserPush();
    try { localStorage.removeItem('onebase_push_enabled_v1'); } catch (_) {}
    updateNotificationButtons(false);
    return true;
  }
  function updateNotificationButtons(enabled) {
    document.querySelectorAll('[data-onebase-notifications]').forEach(button => {
      button.textContent = enabled ? '✓ AVISOS DE ONEBASE ACTIVADOS' : '○ AVISOS DE ONEBASE DESACTIVADOS';
      button.classList.toggle('active', enabled);
      button.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    });
  }
  function ensureNotificationButton() {
    if (document.querySelector('[data-onebase-notifications]')) return;
    const menu = document.querySelector('#cloudUserMenu, .cloud-user-menu');
    if (!menu) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.onebaseNotifications = '1';
    button.className = 'onebase-notification-toggle';
    button.textContent = '🔔 ACTIVAR NOTIFICACIONES';
    button.title = 'Mostrar avisos dentro de OneBase sin notificaciones del navegador';
    button.addEventListener('click', async () => {
      const active = window.OneBaseNotifications?.enabled?.() !== false;
      if (active) await disablePush(); else await enablePush();
      if (window.toast) window.toast(active ? 'Avisos de OneBase desactivados.' : 'Avisos de OneBase activados.');
    });
    const style = document.createElement('style');
    style.textContent = '.onebase-notification-toggle{width:100%;margin-top:8px;padding:10px 12px;border:1px solid rgba(214,168,79,.28);border-radius:10px;background:rgba(214,168,79,.08);color:inherit;font:800 10px/1.1 inherit;letter-spacing:.06em;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.onebase-notification-toggle:hover{transform:translateY(-1px);border-color:rgba(214,168,79,.58);background:rgba(214,168,79,.14)}.onebase-notification-toggle.active{border-color:rgba(214,168,79,.58);background:rgba(214,168,79,.12);color:#f0cf83}';
    document.head.appendChild(style);
    menu.appendChild(button);
  }
  async function checkUpdates() {
    const list = getData();
    if (!list.length) return;
    const now = Date.now();
    const last = Number(localStorage.getItem(CHECK_KEY) || 0);
    if (now - last < CHECK_INTERVAL) return;
    localStorage.setItem(CHECK_KEY, String(now));
    try {
      const response = await fetch('/api/check-updates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: list.map((item, index) => ({ id: item.id ?? index, anime: item.anime, total: item.total, watched: item.watched })) }) });
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
        if (watched >= previousTotal && item.state === 'terminado') item.state = 'viendo';
        item.newEpisodes = Math.max(0, nextTotal - watched);
        item.updatedAt = Date.now();
        changed = true;
        const key = `${item.id || item.anime}:${nextTotal}`;
        if (!notified[key]) {
          notified[key] = Date.now();
          notifyOneBase('Nuevo episodio disponible', `${item.anime}: hay ${nextTotal - previousTotal} episodio${nextTotal - previousTotal === 1 ? '' : 's'} nuevo${nextTotal - previousTotal === 1 ? '' : 's'}.`, item.anime, nextTotal);
        }
      }
      if (changed) {
        saveJson(NOTIFIED_KEY, notified);
        try { if (typeof save === 'function') save({ skipBackup: true }); if (typeof window.render === 'function') window.render(); } catch (_) {}
      }
    } catch (error) { console.warn('[ONEBASE] Episode update check failed:', error); }
  }
  async function hydrateNotificationState() {
    await retireBrowserPush();
    updateNotificationButtons(window.OneBaseNotifications?.enabled?.() !== false);
  }

  window.OneBaseEpisodeNotifications = { checkUpdates, enablePush, disablePush, retireBrowserPush };
  window.addEventListener('animetracker:restored', () => setTimeout(checkUpdates, 1200));
  window.addEventListener('onebase:txt-restored', () => setTimeout(checkUpdates, 1200));
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { ensureNotificationButton(); hydrateNotificationState(); checkUpdates(); }, 1800), { once: true });
  if (document.readyState !== 'loading') setTimeout(() => { ensureNotificationButton(); hydrateNotificationState(); checkUpdates(); }, 1800);
})();
