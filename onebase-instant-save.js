/* ONEBASE instant library sync.
 * The core app already saves every library mutation to localStorage and emits
 * "animetracker:saved". This bridge sends that exact state to the account
 * persistence engine immediately instead of waiting for its 500ms debounce.
 */
(function () {
  'use strict';

  let syncing = false;
  let queued = false;

  async function syncNow() {
    const cloud = window.AnimeTrackerCloud;
    if (!cloud || typeof cloud.sync !== 'function') return;

    // Do not open the login dialog when the user is working locally.
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
        void syncNow();
      }
    }
  }

  // save() dispatches this after localStorage has been written, so the cloud
  // always receives the newest version rather than a pre-mutation snapshot.
  window.addEventListener('animetracker:saved', () => { void syncNow(); });

  // Profile/library restore can expose the cloud bridge after this script loads.
  window.addEventListener('animetracker:restored', () => { void syncNow(); });
  window.addEventListener('onebase:txt-restored', () => { void syncNow(); });

  // If the account bridge initializes after our listeners, give it a few chances
  // to perform the first synchronization without making the page wait.
  [500, 1500, 3000].forEach(delay => setTimeout(() => void syncNow(), delay));
})();
