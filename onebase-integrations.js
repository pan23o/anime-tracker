/* ONEBASE integrations bridge v1
 * Central telemetry/event bus for Supabase + optional Amplitude/Datadog hooks.
 * No secrets are stored in the client.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://djfjqecahztogacliavh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
  const EVENT_TABLE = 'onebase_events';
  const SESSION_KEY = 'onebase_telemetry_session_v1';
  const QUEUE_KEY = 'onebase_telemetry_queue_v1';
  const MAX_QUEUE = 40;

  const safeJson = (value) => {
    try { return JSON.parse(JSON.stringify(value)); } catch { return {}; }
  };

  function sessionId() {
    let id = '';
    try { id = localStorage.getItem(SESSION_KEY) || ''; } catch {}
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      try { localStorage.setItem(SESSION_KEY, id); } catch {}
    }
    return id;
  }

  const client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  let pending = [];
  let flushing = false;

  try {
    const raw = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
    if (Array.isArray(raw)) pending = raw.slice(-MAX_QUEUE);
  } catch {}

  function persistQueue() {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(pending.slice(-MAX_QUEUE))); } catch {}
  }

  async function currentUserId() {
    if (!client) return null;
    try {
      const { data } = await client.auth.getUser();
      return data?.user?.id || null;
    } catch { return null; }
  }

  async function sendToSupabase(item) {
    if (!client) throw new Error('Supabase client unavailable');
    const userId = await currentUserId();
    const { error } = await client.from(EVENT_TABLE).insert({
      user_id: userId,
      session_id: item.session_id,
      event_name: item.event_name,
      properties: item.properties
    });
    if (error) throw error;
  }

  async function flush() {
    if (flushing || !pending.length) return;
    flushing = true;
    try {
      while (pending.length) {
        const item = pending[0];
        await sendToSupabase(item);
        pending.shift();
        persistQueue();
      }
    } catch (error) {
      console.debug('[OneBase integrations] telemetry queued', error?.message || error);
    } finally {
      flushing = false;
    }
  }

  function track(eventName, properties = {}) {
    const name = String(eventName || '').trim().slice(0, 80);
    if (!name) return;
    const item = {
      session_id: sessionId(),
      event_name: name,
      properties: safeJson({
        ...properties,
        path: location.pathname + location.hash,
        ts: new Date().toISOString()
      })
    };
    pending.push(item);
    pending = pending.slice(-MAX_QUEUE);
    persistQueue();
    void flush();

    // Future providers can subscribe without coupling the app to their SDKs.
    window.dispatchEvent(new CustomEvent('onebase:telemetry', { detail: item }));
  }

  function installEventHooks() {
    window.addEventListener('animetracker:saved', () => track('library_saved'));
    window.addEventListener('animetracker:progress-changed', () => track('progress_changed'));
    window.addEventListener('animetracker:restored', e => track('library_restored', {
      count: Number(e.detail?.count || 0),
      source: String(e.detail?.source || 'unknown').slice(0, 40)
    }));

    window.addEventListener('hashchange', () => {
      const page = location.hash.replace(/^#/, '') || 'home';
      track('page_view', { page });
    });

    document.addEventListener('click', e => {
      const target = e.target?.closest?.('[data-page], [data-lv2-mode], [data-lv2-open], [data-lv2-save], [data-lv2-skip], [data-lv2-reroll]');
      if (!target) return;

      if (target.matches('[data-lv2-mode]')) track('lootbox_mode_changed', { mode: target.dataset.lv2Mode });
      else if (target.matches('[data-lv2-open]')) track('lootbox_opened', { index: Number(target.dataset.lv2Open) });
      else if (target.matches('[data-lv2-save]')) track('lootbox_saved', { index: Number(target.dataset.lv2Save) });
      else if (target.matches('[data-lv2-skip]')) track('lootbox_discarded', { index: Number(target.dataset.lv2Skip) });
      else if (target.matches('[data-lv2-reroll]')) track('lootbox_rerolled');
      else if (target.dataset.page) track('navigation', { page: target.dataset.page });
    }, { passive: true });

    window.addEventListener('online', () => void flush());
    window.addEventListener('beforeunload', persistQueue);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void flush();
    });
  }

  window.OneBaseIntegrations = {
    track,
    flush,
    status: () => ({
      supabase: !!client,
      queued: pending.length,
      sessionId: sessionId()
    })
  };

  function boot() {
    installEventHooks();
    track('app_loaded', { version: 'integrations-v1' });
    void flush();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
