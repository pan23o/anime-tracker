/* ONEBASE eye v2 — real eyelid opening, not rotation. Visual only. */
(function () {
  'use strict';

  const CSS = `
    .eye {
      --eye-height: 5%;
      transform: none !important;
      transform-origin: center center !important;
      clip-path: ellipse(50% var(--eye-height) at 50% 50%) !important;
      transition:
        clip-path .58s cubic-bezier(.22,.78,.18,1),
        filter .25s ease,
        border-color .3s ease,
        box-shadow .3s ease !important;
      will-change: clip-path;
    }

    .eye::before {
      transform: scale(var(--eye-pupil-scale, .72)) !important;
      transform-origin: center !important;
      transition: transform .48s cubic-bezier(.22,.78,.18,1), opacity .25s ease !important;
    }

    .eye::after {
      opacity: var(--eye-line-opacity, 1) !important;
      transform: translateY(-50%) scaleX(var(--eye-line-scale, .72)) !important;
      transition: opacity .24s ease, transform .48s cubic-bezier(.22,.78,.18,1) !important;
    }

    .eye:hover {
      transform: scale(1.04) !important;
      clip-path: ellipse(50% var(--eye-hover-height, 7%) at 50% 50%) !important;
    }

    @media (prefers-reduced-motion: reduce) {
      .eye, .eye::before, .eye::after { transition: none !important; animation: none !important; }
    }
  `;

  function install() {
    if (document.getElementById('onebase-eye-v2-style')) return;
    const style = document.createElement('style');
    style.id = 'onebase-eye-v2-style';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function setVarIfChanged(el, name, value) {
    if (el.style.getPropertyValue(name) !== value) el.style.setProperty(name, value);
  }

  function syncEye(eye) {
    const raw = getComputedStyle(eye).getPropertyValue('--open').trim();
    let open = Number.parseFloat(raw);
    if (!Number.isFinite(open)) open = 0;
    open = Math.max(0, Math.min(1, open));

    // The eye opens by changing the visible vertical aperture: no rotation.
    setVarIfChanged(eye, '--eye-height', `${5 + open * 41}%`);
    setVarIfChanged(eye, '--eye-hover-height', `${7 + open * 39}%`);
    setVarIfChanged(eye, '--eye-pupil-scale', `${0.72 + open * 0.28}`);
    setVarIfChanged(eye, '--eye-line-opacity', `${1 - open}`);
    setVarIfChanged(eye, '--eye-line-scale', `${0.72 + open * 0.28}`);
  }

  function syncAll() {
    document.querySelectorAll('.eye').forEach(syncEye);
  }

  function boot() {
    install();
    syncAll();
    const observer = new MutationObserver(() => syncAll());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
