/* ONEBASE persistence repair layer.
 * Ensures the account TXT is applied after the main app has initialized.
 * Read-only on boot: it never overwrites the server from an empty client state.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://djfjqecahztogacliavh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
  const LIB = 'anime_tracker_v6';
  const BUCKET = 'anime-libraries';
  const FILE_NAME = 'library.txt';
  const MAX_WAIT = 12000;

  const parse = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };
  const normalize = item => ({
    ...item,
    anime: String(item?.anime || '').trim(),
    favorite: Boolean(item?.favorite),
    addedAt: Number(item?.addedAt) || Date.now(),
    updatedAt: Number(item?.updatedAt) || Number(item?.addedAt) || Date.now()
  });
  const clean = list => Array.isArray(list)
    ? list.filter(x => x && typeof x === 'object' && String(x.anime || '').trim()).map(normalize)
    : [];
  const keyOf = item => {
    const aniId = item?.aniId ?? item?.id ?? item?.malId;
    return aniId != null && String(aniId).trim() ? `id:${String(aniId).trim()}` : `title:${String(item?.anime || '').trim().toLowerCase().replace(/\\s+/g, ' ')}`;
  };
  const mergeNewest = (a, b) => {
    const map = new Map();
    for (const item of clean(a)) map.set(keyOf(item), item);
    for (const item of clean(b)) {
      const k = keyOf(item), prev = map.get(k);
      if (!prev || Math.max(Number(item.updatedAt) || 0, Number(item.addedAt) || 0) >= Math.max(Number(prev.updatedAt) || 0, Number(prev.addedAt) || 0)) map.set(k, item);
    }
    return [...map.values()];
  };

  function decode(text) {
    if (!text) return [];
    const items = [];
    for (const line of String(text).split(/\\r?\\n/)) {
      const s = line.trim();
      if (!s || s.startsWith('#')) continue;
      try {
        const item = JSON.parse(s);
        if (item && typeof item === 'object' && String(item.anime || '').trim()) items.push(item);
      } catch {}
    }
    return clean(items);
  }

  async function waitForReady(client) {
    const started = Date.now();
    while (Date.now() - started < MAX_WAIT) {
      try {
        if (typeof window.render === 'function' && typeof data !== 'undefined' && Array.isArray(data)) return true;
      } catch {}
      await new Promise(r => setTimeout(r, 150));
    }
    return false;
  }

  async function restore() {
    let client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    if (!client) return false;

    const { data: sessionData } = await client.auth.getSession();
    const uid = sessionData?.session?.user?.id;
    if (!uid) return false;

    const ready = await waitForReady(client);
    if (!ready) return false;

    let serverList = [];
    try {
      const { data: file, error } = await client.storage.from(BUCKET).download(`${uid}/${FILE_NAME}`);
      if (!error && file) serverList = decode(await file.text());
    } catch (e) { console.warn('[ONEBASE] TXT restore failed:', e); }

    if (!serverList.length) return false;

    let localList = [];
    try { localList = clean(parse(localStorage.getItem(LIB) || '[]', [])); } catch {}
    const merged = mergeNewest(serverList, localList);

    try { localStorage.setItem(LIB, JSON.stringify(merged)); } catch {}
    try {
      if (typeof data !== 'undefined' && Array.isArray(data)) data = merged.map(normalize);
    } catch {}

    try { window.render(); } catch (e) { console.warn('[ONEBASE] render after TXT restore failed:', e); }
    window.dispatchEvent(new CustomEvent('onebase:txt-restored', { detail: { count: merged.length, userId: uid } }));

    return true;
  }

  async function boot() {
    // Give the existing persistence engine and the page a chance to initialize first.
    await new Promise(r => setTimeout(r, 250));
    await restore();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    void boot();
  }
})();
