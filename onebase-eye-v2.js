/* ONEBASE eye v2 — real eyelid opening, not rotation. Visual only. */
(function () {
  'use strict';

  const CSS = `
    .eye {
      --eye-open: var(--open, 1);
      transform: none !important;
      transform-origin: center center !important;
      clip-path: ellipse(50% calc(5% + (var(--eye-open) * 45%)) at 50% 50%) !important;
      transition:
        clip-path .58s cubic-bezier(.22,.78,.18,1),
        filter .25s ease,
        border-color .3s ease,
        box-shadow .3s ease !important;
      will-change: clip-path;
    }

    .eye::before {
      transform: scale(calc(.72 + (var(--eye-open) * .28))) !important;
      transform-origin: center !important;
      transition: transform .48s cubic-bezier(.22,.78,.18,1), opacity .25s ease !important;
    }

    .eye::after {
      opacity: calc(1 - var(--eye-open)) !important;
      transform: translateY(-50%) scaleX(calc(.72 + (var(--eye-open) * .28))) !important;
      transition:
        opacity .24s ease,
        transform .48s cubic-bezier(.22,.78,.18,1) !important;
    }

    .eye:hover {
      transform: scale(1.04) !important;
      clip-path: ellipse(50% calc(7% + (var(--eye-open) * 43%)) at 50% 50%) !important;
    }

    /* When the eye is commanded closed, make the slit read as an eyelid. */
    .eye[style*="--open: 0"],
    .eye[style*="--open:0"] {
      animation: onebaseEyeClose .12s ease-out both;
    }

    @keyframes onebaseEyeClose {
      from { clip-path: ellipse(50% 46% at 50% 50%); }
      to   { clip-path: ellipse(50% 5% at 50% 50%); }
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

  function normalize() {
    document.querySelectorAll('.eye').forEach((eye) => {
      if (!eye.style.getPropertyValue('--open')) eye.style.setProperty('--open', '1');
    });
  }

  function boot() {
    install();
    normalize();
    const observer = new MutationObserver(normalize);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
