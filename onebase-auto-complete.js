/* ONEBASE automatic completion.
 * Keeps the status in sync with progress: when watched >= total,
 * the anime is automatically marked as "terminado" and persisted.
 * This is intentionally isolated from the main tracker logic.
 */
(function () {
  'use strict';

  const COMPLETED = 'terminado';
  let syncing = false;
  let observer = null;

  function getData() {
    try {
      return (typeof data !== 'undefined' && Array.isArray(data)) ? data : null;
    } catch (_) {
      return null;
    }
  }

  function syncCompletedStatuses({ render = true } = {}) {
    if (syncing) return false;
    const list = getData();
    if (!list) return false;

    let changed = false;

    for (const item of list) {
      if (!item || !String(item.anime || '').trim()) continue;

      const total = Number(item.total);
      const watched = Number(item.watched);

      // A completion can only be inferred when the maximum episode count is known.
      if (!Number.isFinite(total) || total <= 0) continue;
      if (!Number.isFinite(watched) || watched < total) continue;

      if (item.watched !== String(total)) {
        item.watched = String(total);
        changed = true;
      }

      if (item.state !== COMPLETED) {
        item.state = COMPLETED;
        item.updatedAt = Date.now();
        changed = true;
      }

      // Once complete, there cannot be pending "new episodes" below the limit.
      if (Number(item.newEpisodes) > 0) {
        item.newEpisodes = 0;
        changed = true;
      }
    }

    if (!changed) return false;

    syncing = true;
    try {
      if (typeof save === 'function') save({ skipBackup: true });
      if (render && typeof window.render === 'function') window.render();
    } catch (error) {
      console.warn('[ONEBASE] Automatic completion sync failed:', error);
    } finally {
      syncing = false;
    }

    return true;
  }

  function start() {
    // Fix existing entries immediately, including entries restored from cloud storage.
    syncCompletedStatuses({ render: true });

    const rows = document.getElementById('rows');
    if (!rows) return;

    // The original tracker handles the input first; this delegated listener then sees
    // the new watched value and can promote the item to completed immediately.
    rows.addEventListener('input', (event) => {
      if (event.target && event.target.classList.contains('watched')) {
        syncCompletedStatuses({ render: true });
      }
    }, true);

    // Lookup/refresh operations can change the total episode count without an input
    // event on the watched field. Observe DOM changes and run a guarded reconciliation.
    observer = new MutationObserver(() => {
      if (!syncing) syncCompletedStatuses({ render: false });
    });
    observer.observe(rows, { childList: true, subtree: true, characterData: true });

    // Give async metadata/persistence restoration a chance to populate the final data.
    setTimeout(() => syncCompletedStatuses({ render: true }), 700);
    setTimeout(() => syncCompletedStatuses({ render: true }), 1800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
