/* ONEBASE status effects — visual only, no data mutation. */
(function () {
  'use strict';

  const STATUS = {
    'Viendo': 'onebase-status-watching',
    'Terminado': 'onebase-status-completed',
    'Pendiente': 'onebase-status-pending',
    'En pausa': 'onebase-status-paused',
    'Abandonado': 'onebase-status-abandoned'
  };

  function decorate() {
    const rows = document.querySelectorAll('#rows .row[data-index]');
    rows.forEach((row) => {
      const meta = row.querySelector('.meta');
      const text = meta ? (meta.textContent || '') : '';
      let wanted = '';
      for (const label in STATUS) {
        if (text.includes(label)) {
          wanted = STATUS[label];
          break;
        }
      }
      Object.values(STATUS).forEach((cls) => row.classList.remove(cls));
      if (wanted) row.classList.add(wanted);
    });
  }

  function start() {
    decorate();
    const root = document.getElementById('rows');
    if (!root) return;

    // IMPORTANT: observe only DOM additions/removals/text changes.
    // Never observe attributes because decorate() itself changes row classes.
    const observer = new MutationObserver(decorate);
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
