/* OneBase — keep one canonical level display.
 * The dashboard level is the canonical progression indicator. The legacy
 * profile/settings modal used to render a second, independently-mounted
 * level card, which could drift from the dashboard. Remove only that duplicate.
 */
(function () {
  'use strict';

  function cleanDuplicateLevel() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    // Only inspect the profile/settings modal. Never touch the dashboard.
    const candidates = modal.querySelectorAll('.settingsSection, section, .card, .panel, .profileSection');
    for (const el of candidates) {
      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (!text) continue;

      // This is the dedicated progression block visible above "Perfil local".
      if (/Tu nivel resume el tiempo que llevas usando OneBase/i.test(text) && /Nivel\s+\d+/i.test(text)) {
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
        el.querySelectorAll('button,input,select,textarea,a').forEach(control => {
          control.setAttribute('tabindex', '-1');
        });
        break;
      }
    }
  }

  function boot() {
    cleanDuplicateLevel();
    const observer = new MutationObserver(() => cleanDuplicateLevel());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
