/* Registers the service worker and exposes the notification permission flow. */
(function () {
  'use strict';
  async function register() {
    if (!('serviceWorker' in navigator)) return null;
    try { return await navigator.serviceWorker.register('/onebase-sw.js', { scope: '/' }); }
    catch (error) { console.warn('[ONEBASE] Service worker registration failed:', error); return null; }
  }
  window.OneBaseNotifications = window.OneBaseNotifications || {};
  window.OneBaseNotifications.register = register;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', register, { once: true });
  else register();
})();
