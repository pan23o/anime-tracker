/* OneBase notification infrastructure: service worker registration. */
(function () {
  'use strict';
  async function register() {
    if (!('serviceWorker' in navigator)) return null;
    try {
      const registration = await navigator.serviceWorker.register('/onebase-sw.js', { scope: '/' });
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.warn('[ONEBASE] Service worker registration failed:', error);
      return null;
    }
  }
  window.OneBaseNotifications = window.OneBaseNotifications || {};
  window.OneBaseNotifications.register = register;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void register(), { once: true });
  else void register();
})();
