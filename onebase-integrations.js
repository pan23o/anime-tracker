/* Local UI events only. Authentication fragments and account data are never analytics. */
(function () {
  'use strict';
  // Retire the old persistent analytics queue, which could include the URL fragment.
  try {
    localStorage.removeItem('onebase_telemetry_queue_v1');
    localStorage.removeItem('onebase_telemetry_session_v1');
  } catch (_) {}
  function track(eventName) {
    const name = String(eventName || '').replace(/[^a-z0-9_]/gi, '').slice(0, 80);
    if (name) window.dispatchEvent(new CustomEvent('onebase:telemetry', { detail: { event_name: name } }));
  }
  window.OneBaseIntegrations = {
    track,
    flush: async () => {},
    status: () => ({ supabase: false, queued: 0, disabled: true })
  };
  const boot = () => track('app_loaded');
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
