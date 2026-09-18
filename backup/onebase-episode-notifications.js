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
  function notifyBrowser(title, body, anime, episode) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body, tag: `onebase-episode-${encodeURIComponent(anime)}-${episode}`, data: { anime, episode }, icon: '/favicon.png', badge: '/favicon.png' };
    try {
      navigator.serviceWorker?.ready.then(reg => reg.showNotification(title, options)).catch(() => new Notification(title, options));
    } catch (_) {}
  }
  async function getClient() {
    if (!window.supabase?.createClient) return null;
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
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
    const client = await getClient();
    if (!client) throw new Error('Supabase no está disponible.');
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData?.session) throw new Error('Inicia sesión para activar las notificaciones.');
    const permission = await askPermission();
    if (permission !== 'granted') throw new Error('El navegador no ha concedido permiso para las notificaciones.');
    const registration = await registerServiceWorker();
    if (!registration?.pushManager) throw new Error('Este navegador no admite Push Notifications.');
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(await getVapidPublicKey()) });
    const { data, error } = await client.functions.invoke('onebase-notifications', { body: { subscription: subscription.toJSON() } });
    if (error) throw error;
    if (!data?.ok) throw new Error(data?.error || 'No se pudo guardar la suscripción.');
    localStorage.setItem('onebase_push_enabled_v1', '1');
    updateNotificationButtons(true);
    return true;
  }
  async function disablePush() {
    const client = await getClient();
    if (!client) return false;
    const registration = await registerServiceWorker();
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return true;
    try { await fetch(`${SUPABASE_URL}/functions/v1/onebase-notifications`, { method: 'DELETE', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${(await client.auth.getSession()).data?.session?.access_token || ''}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }) }); } catch (_) {}
    try { await subscription.unsubscribe(); } catch (_) {}
    localStorage.removeItem('onebase_push_enabled_v1');
    updateNotificationButtons(false);
    return true;
  }
  function updateNotificationButtons(enabled) {
    document.querySelectorAll('[data-onebase-notifications]').forEach(button => {
      button.textContent = enabled ? '✓ NOTIFICACIONES ACTIVADAS' : '🔔 ACTIVAR NOTIFICACIONES';
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
    button.title = 'Recibir avisos cuando OneBase detecte nuevos episodios';
    button.addEventListener('click', async () => {
      try {
        await enablePush();
        if (window.toast) window.toast('✓ Notificaciones de episodios activadas.');
      } catch (error) {
        if (window.toast) window.toast(`⚠️ ${error?.message || 'No se pudieron activar las notificaciones.'}`);
        else console.warn('[ONEBASE] Notification setup:', error);
      }
    });
    const style = document.createElement('style');
    style.textContent = '.onebase-notification-toggle{width:100%;margin-top:8px;padding:10px 12px;border:1px solid rgba(214,168,79,.28);border-radius:10px;background:rgba(214,168,79,.08);color:inherit;font:800 10px/1.1 inherit;letter-spacing:.06em;cursor:pointer;transition:transform .18s ease,border-color .18s ease,background .18s ease}.onebase-notification-toggle:hover{transform:translateY(-1px);border-color:rgba(214,168,79,.58);background:rgba(214,168,79,.14)}.onebase-notification-toggle.active{border-color:rgba(103,223,138,.55);background:rgba(103,223,138,.08)}';
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
          notifyBrowser('Nuevo episodio en OneBase', `${item.anime}: hay ${nextTotal - previousTotal} episodio${nextTotal - previousTotal === 1 ? '' : 's'} nuevo${nextTotal - previousTotal === 1 ? '' : 's'}.`, item.anime, nextTotal);
        }
      }
      if (changed) {
        saveJson(NOTIFIED_KEY, notified);
        try { if (typeof save === 'function') save({ skipBackup: true }); if (typeof window.render === 'function') window.render(); } catch (_) {}
      }
    } catch (error) { console.warn('[ONEBASE] Episode update check failed:', error); }
  }
  async function hydrateNotificationState() {
    try {
      const registration = await registerServiceWorker();
      const subscription = await registration?.pushManager?.getSubscription();
      const enabled = Boolean(subscription && Notification.permission === 'granted');
      updateNotificationButtons(enabled);
      const client = await getClient();
      const { data: sessionData } = await client.auth.getSession();
      if (enabled && sessionData?.session) await client.functions.invoke('onebase-notifications', { body: { subscription: subscription.toJSON() } });
    } catch (_) {}
  }

  window.OneBaseEpisodeNotifications = { checkUpdates, askPermission, enablePush, disablePush, registerServiceWorker };
  window.addEventListener('animetracker:restored', () => setTimeout(checkUpdates, 1200));
  window.addEventListener('onebase:txt-restored', () => setTimeout(checkUpdates, 1200));
  document.addEventListener('DOMContentLoaded', () => setTimeout(() => { ensureNotificationButton(); hydrateNotificationState(); checkUpdates(); }, 1800), { once: true });
  if (document.readyState !== 'loading') setTimeout(() => { ensureNotificationButton(); hydrateNotificationState(); checkUpdates(); }, 1800);
})();
