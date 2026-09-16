/* ONEBASE instant library sync.
 * Safe version: never starts a cloud synchronization during page startup.
 * Startup network work can make the UI look frozen when the account bridge is
 * still initializing. Synchronization is triggered only by real save/restore events.
 */
(function () {
  'use strict';

  let syncing = false;
  let queued = false;

  async function syncNow() {
    const cloud = window.AnimeTrackerCloud;
    if (!cloud || typeof cloud.sync !== 'function') return;
    if (document.documentElement.dataset.atSession !== '1') return;

    if (syncing) {
      queued = true;
      return;
    }

    syncing = true;
    try {
      await cloud.sync();
    } catch (error) {
      console.warn('[ONEBASE] Instant cloud save failed:', error);
    } finally {
      syncing = false;
      if (queued) {
        queued = false;
        setTimeout(() => void syncNow(), 0);
      }
    }
  }

  window.addEventListener('animetracker:saved', () => { void syncNow(); });
  window.addEventListener('animetracker:restored', () => { void syncNow(); });
  window.addEventListener('onebase:txt-restored', () => { void syncNow(); });

  window.OneBaseInstantSave = { syncNow };
})();
