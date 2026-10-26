/* OneBase in-app notifications. Retires the legacy browser push worker. */
(function () {
  'use strict';
  const PREF_KEY = 'onebase_inapp_notifications_v1';
  let host = null;
  const enabled = () => { try { const value = localStorage.getItem(PREF_KEY); return value === null ? true : value === '1'; } catch (_) { return true; } };
  async function retireLegacyWorker() {
    if (!('serviceWorker' in navigator)) return;
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        const urls = [registration.active, registration.waiting, registration.installing].filter(Boolean).map(worker => worker.scriptURL || '');
        if (!urls.some(url => /\/onebase-sw\.js(?:[?#]|$)/i.test(url))) continue;
        const subscription = await registration.pushManager?.getSubscription?.().catch?.(() => null);
        try { await subscription?.unsubscribe?.(); } catch (_) {}
        try { await registration.unregister(); } catch (_) {}
      }
    } catch (_) {}
  }
  function ensureHost() {
    if (host?.isConnected) return host;
    host = document.createElement('div');
    host.id = 'onebaseNoticeStack';
    host.className = 'ob-notice-stack';
    host.setAttribute('aria-live', 'polite');
    host.setAttribute('aria-relevant', 'additions');
    host.setAttribute('aria-label', 'Notificaciones de OneBase');
    document.body.appendChild(host);
    if (!document.getElementById('onebaseNoticeStyles')) {
      const style = document.createElement('style');
      style.id = 'onebaseNoticeStyles';
      style.textContent = `
        .ob-notice-stack{position:fixed;z-index:30000;right:20px;bottom:20px;width:min(390px,calc(100vw - 28px));display:grid;gap:10px;pointer-events:none}
        .ob-notice{position:relative;display:grid;grid-template-columns:42px minmax(0,1fr) 30px;align-items:center;gap:12px;min-height:88px;padding:14px;border:1px solid rgba(214,168,79,.48);border-radius:18px;background:radial-gradient(ellipse at 0 0,rgba(214,168,79,.17),transparent 60%),linear-gradient(145deg,#1a1916,#0c0c0c);color:#f5f2eb;box-shadow:0 20px 65px rgba(0,0,0,.58),0 0 26px rgba(214,168,79,.1);pointer-events:auto;overflow:hidden;animation:obNoticeIn .32s cubic-bezier(.2,.8,.2,1) both}
        .ob-notice::before{content:"";position:absolute;left:0;top:15px;bottom:15px;width:3px;border-radius:0 4px 4px 0;background:linear-gradient(#f0cf83,#a9772b);box-shadow:0 0 14px rgba(214,168,79,.45)}
        .ob-notice-icon{width:42px;height:42px;display:grid;place-items:center;border:1px solid rgba(214,168,79,.4);border-radius:14px;background:rgba(214,168,79,.11);color:#f0cf83;font-size:19px}
        .ob-notice-copy{min-width:0}.ob-notice-kicker{display:block;margin-bottom:5px;color:#d7b96f;font:800 8px/1.2 Inter,system-ui,sans-serif;letter-spacing:1.5px;text-transform:uppercase}.ob-notice-title{display:block;color:#fff;font:850 12px/1.3 Inter,system-ui,sans-serif}.ob-notice-body{display:block;margin-top:4px;color:#aaa;font:500 10px/1.45 Inter,system-ui,sans-serif}
        .ob-notice-close{width:28px;height:28px;border:1px solid #333;border-radius:9px;background:#171717;color:#999;font-size:16px;cursor:pointer;transition:.16s}.ob-notice-close:hover{border-color:#b5914a;color:#fff}
        .ob-notice.is-leaving{animation:obNoticeOut .22s ease both}
        @keyframes obNoticeIn{from{opacity:0;transform:translate(18px,12px) scale(.97)}to{opacity:1;transform:none}}
        @keyframes obNoticeOut{to{opacity:0;transform:translate(10px,8px) scale(.98)}}
        @media(max-width:600px){.ob-notice-stack{right:10px;bottom:12px;width:calc(100vw - 20px)}.ob-notice{min-height:80px;padding:12px;border-radius:15px}}
        @media(prefers-reduced-motion:reduce){.ob-notice,.ob-notice.is-leaving{animation:none}}
      `;
      document.head.appendChild(style);
    }
    return host;
  }
  function show(title, body, detail = {}) {
    if (!enabled()) return false;
    const stack = ensureHost(), notice = document.createElement('article');
    notice.className = 'ob-notice'; notice.setAttribute('role', 'status');
    const icon = document.createElement('span'); icon.className = 'ob-notice-icon'; icon.setAttribute('aria-hidden', 'true'); icon.textContent = detail.icon || '◷';
    const copy = document.createElement('span'); copy.className = 'ob-notice-copy';
    const kicker = document.createElement('small'); kicker.className = 'ob-notice-kicker'; kicker.textContent = detail.kicker || 'OneBase · Aviso';
    const heading = document.createElement('strong'); heading.className = 'ob-notice-title'; heading.textContent = String(title || 'Tienes una novedad');
    const message = document.createElement('span'); message.className = 'ob-notice-body'; message.textContent = String(body || '');
    copy.append(kicker, heading, message);
    const close = document.createElement('button'); close.type = 'button'; close.className = 'ob-notice-close'; close.setAttribute('aria-label', 'Cerrar notificación'); close.textContent = '×';
    const dismiss = () => { if (!notice.isConnected) return; notice.classList.add('is-leaving'); setTimeout(() => notice.remove(), 240); };
    close.addEventListener('click', dismiss); notice.append(icon, copy, close); stack.appendChild(notice);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    setTimeout(dismiss, 7200); return true;
  }
  window.OneBaseNotifications = window.OneBaseNotifications || {};
  Object.assign(window.OneBaseNotifications, { retireLegacyWorker, show, enabled, setEnabled(value) { try { localStorage.setItem(PREF_KEY, value ? '1' : '0'); } catch (_) {} return Boolean(value); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void retireLegacyWorker(), { once: true });
  else void retireLegacyWorker();
})();