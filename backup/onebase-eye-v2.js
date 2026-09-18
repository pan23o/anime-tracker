/* ONEBASE eye v3 — anime eye design + real eyelid opening. */
(function () {
  'use strict';

  const CSS = `
    .eye {
      --eye-height: 5%;
      --eye-pupil-scale: .72;
      --eye-line-opacity: 1;
      --eye-line-scale: .72;
      position: relative !important;
      isolation: isolate !important;
      overflow: hidden !important;
      transform: none !important;
      transform-origin: center center !important;
      clip-path: ellipse(50% var(--eye-height) at 50% 50%) !important;
      border: 1.5px solid #9aa7b8 !important;
      border-radius: 50% !important;
      background:
        radial-gradient(circle at 50% 50%, #0b1018 0 14%, #172434 15% 25%, #5c86a9 26% 43%, #dce8f1 44% 57%, #27313d 58% 100%) !important;
      box-shadow:
        inset 0 0 0 1px rgba(255,255,255,.14),
        inset 0 -5px 9px rgba(0,0,0,.45),
        0 3px 12px rgba(0,0,0,.35) !important;
      transition:
        clip-path .58s cubic-bezier(.18,.82,.18,1),
        border-color .3s ease,
        filter .3s ease,
        box-shadow .3s ease !important;
      will-change: clip-path;
    }

    /* Anime iris/pupil + two characteristic catchlights. */
    .eye::before {
      content: "" !important;
      position: absolute !important;
      z-index: 3 !important;
      left: 50% !important;
      top: 50% !important;
      width: 18px !important;
      height: 18px !important;
      margin: -9px 0 0 -9px !important;
      border-radius: 50% !important;
      background:
        radial-gradient(circle at 38% 31%, #ffffff 0 8%, transparent 9%),
        radial-gradient(circle at 64% 67%, rgba(255,255,255,.72) 0 4%, transparent 5%),
        radial-gradient(circle, #05080d 0 25%, #17283a 26% 42%, #7bb6df 43% 67%, #234766 68% 100%) !important;
      box-shadow:
        0 0 0 2px rgba(210,235,255,.65),
        0 0 9px rgba(95,183,255,.38),
        inset 0 0 5px rgba(0,0,0,.65) !important;
      transform: scale(var(--eye-pupil-scale)) !important;
      transform-origin: center !important;
      transition: transform .48s cubic-bezier(.18,.82,.18,1), opacity .2s ease !important;
    }

    /* Upper anime eyelash / lower eyelid accent. */
    .eye::after {
      content: "" !important;
      position: absolute !important;
      z-index: 5 !important;
      left: -5px !important;
      right: -5px !important;
      top: 48% !important;
      height: 4px !important;
      border-radius: 50% !important;
      background: #111923 !important;
      box-shadow:
        0 -2px 0 #dce8f1,
        0 4px 0 rgba(24,32,42,.9) !important;
      opacity: var(--eye-line-opacity) !important;
      transform: translateY(-50%) scaleX(var(--eye-line-scale)) !important;
      transform-origin: center !important;
      transition: opacity .24s ease, transform .48s cubic-bezier(.18,.82,.18,1) !important;
    }

    .eye:hover {
      filter: brightness(1.12) saturate(1.08) !important;
      transform: scale(1.045) !important;
      clip-path: ellipse(50% var(--eye-hover-height, 7%) at 50% 50%) !important;
    }

    /* Keep special states, but give them the same anime eye construction. */
    .eye.eye-favorite {
      border-color: #e1b83f !important;
      background: radial-gradient(circle at 50% 50%, #fff7bd 0 15%, #dba82c 16% 42%, #69490c 43% 70%, #1c1609 100%) !important;
      box-shadow: inset 0 0 0 1px rgba(255,244,181,.3), 0 0 15px rgba(235,183,43,.3) !important;
    }
    .eye.eye-favorite::before {
      content: "★" !important;
      display: grid !important;
      place-items: center !important;
      color: #fff9c9 !important;
      font: 900 15px/1 Arial,sans-serif !important;
      text-shadow: 0 0 5px rgba(255,220,90,.9) !important;
      background: radial-gradient(circle, #fff8bf 0 35%, #d49d18 36% 70%, #6f4708 71% 100%) !important;
      animation: onebaseAnimeStar 2.4s ease-in-out infinite !important;
    }
    .eye.eye-poop { border-color: #7b5434 !important; background: radial-gradient(circle, #d5b49a 0 30%, #8b684f 31% 60%, #39271d 61% 100%) !important; }
    .eye.eye-poop::before { content: "💩" !important; background: transparent !important; box-shadow: none !important; font: 18px/1 Arial,sans-serif !important; animation: onebasePoopBob 3.2s ease-in-out infinite !important; }
    .eye.eye-diamond { border-color: #75d2ff !important; background: radial-gradient(circle, #fff 0 20%, #b9ecff 21% 42%, #238ff0 43% 68%, #0c285a 69% 100%) !important; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35), 0 0 18px rgba(77,180,255,.55) !important; }
    .eye.eye-diamond::before { content: "◆" !important; color: #fff !important; display:grid !important; place-items:center !important; font:900 13px/1 Arial,sans-serif !important; background:linear-gradient(135deg,#197ce8,#83d9ff,#fff,#74ccff,#1266d2) !important; box-shadow:0 0 0 2px rgba(224,249,255,.55),0 0 12px rgba(130,214,255,.85) !important; transform:scale(var(--eye-pupil-scale)) rotate(45deg) !important; animation:onebaseDiamondSpin 3.8s linear infinite !important; }

    @keyframes onebaseAnimeStar { 50% { transform: scale(1.14); filter: brightness(1.16); } }
    @keyframes onebasePoopBob { 50% { transform: translateY(-2px) rotate(-3deg); } }
    @keyframes onebaseDiamondSpin { to { rotate: 405deg; } }

    @media (prefers-reduced-motion: reduce) {
      .eye, .eye::before, .eye::after { transition: none !important; animation: none !important; }
    }
  `;

  function install() {
    const old = document.getElementById('onebase-eye-v2-style');
    if (old) old.remove();
    if (document.getElementById('onebase-eye-v3-style')) return;
    const style = document.createElement('style');
    style.id = 'onebase-eye-v3-style';
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
    setVarIfChanged(eye, '--eye-height', `${5 + open * 41}%`);
    setVarIfChanged(eye, '--eye-hover-height', `${7 + open * 39}%`);
    setVarIfChanged(eye, '--eye-pupil-scale', `${0.72 + open * 0.28}`);
    setVarIfChanged(eye, '--eye-line-opacity', `${1 - open}`);
    setVarIfChanged(eye, '--eye-line-scale', `${0.72 + open * 0.28}`);
  }

  function syncAll() { document.querySelectorAll('.eye').forEach(syncEye); }

  function boot() {
    install();
    syncAll();
    const observer = new MutationObserver(syncAll);
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
