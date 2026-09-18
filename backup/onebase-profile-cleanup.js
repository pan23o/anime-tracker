/* OneBase profile cleanup
 * The independent Settings window owns protection preferences now.
 * Keep the legacy profile data model intact, but remove the duplicated
 * Protection panel from the visible profile window and let the profile
 * section use the freed grid space.
 */
(function () {
  'use strict';

  function cleanProfileLayout() {
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    const grid = modal.querySelector('.settingsGrid');
    if (!grid) return;

    const sections = Array.from(grid.querySelectorAll(':scope > .settingsSection'));
    if (!sections.length) return;

    const protection = sections.find(section => {
      const heading = section.querySelector('h3');
      return /protecci[oó]n/i.test(String(heading?.textContent || '').trim());
    });

    if (protection) {
      protection.style.display = 'none';
      protection.setAttribute('aria-hidden', 'true');
      protection.querySelectorAll('input,button,select,textarea').forEach(el => {
        el.setAttribute('tabindex', '-1');
      });
    }

    const profileSection = sections.find(section => section.querySelector('#profileName, #profileEmail, #profileSave'));
    if (profileSection) {
      profileSection.classList.add('full');
      profileSection.style.gridColumn = '1 / -1';
    }
  }

  function boot() {
    cleanProfileLayout();
    // The profile modal is static today, but this also survives future DOM refreshes.
    const observer = new MutationObserver(() => cleanProfileLayout());
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
