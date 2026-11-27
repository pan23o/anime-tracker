/* Local account boundaries: an account never imports another account's cached collection. */
(function (root) {
  'use strict';
  const prefix = 'onebase_account_cache_v1:';
  function switchScope(storage, previous, next, current) {
    previous = previous || 'guest';
    next = next || 'guest';
    if (previous === next) return null;
    // Preserve unsynced changes under their original owner before clearing the active view.
    storage.setItem(prefix + previous, JSON.stringify(current));
    let saved = null;
    try { saved = JSON.parse(storage.getItem(prefix + next) || 'null'); } catch (_) {}
    return {
      anime: Array.isArray(saved?.anime) ? saved.anime : [],
      screen: Array.isArray(saved?.screen) ? saved.screen : [],
      profile: saved?.profile && typeof saved.profile === 'object' ? saved.profile : {},
      extra: saved?.extra && typeof saved.extra === 'object' ? saved.extra : {}
    };
  }
  const api = { switchScope };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OneBaseAccountScope = api;
})(typeof window === 'undefined' ? globalThis : window);
