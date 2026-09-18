/* OneBase — settings: restore the original compact layout and add only a visible scrollbar. */
(function () {
  'use strict';
  const CSS = `
    #onebaseSettingsOverlay { overflow: hidden !important; padding: 22px !important; box-sizing: border-box !important; }
    #onebaseSettingsOverlay .ob-settings-window {
      width: min(780px, 94vw) !important;
      max-height: min(820px, 90vh) !important;
      height: auto !important;
      min-height: 0 !important;
      overflow: hidden !important;
      display: flex !important;
      flex-direction: column !important;
      box-sizing: border-box !important;
    }
    #onebaseSettingsOverlay .ob-settings-head { flex: 0 0 auto !important; }
    #onebaseSettingsOverlay .ob-settings-body {
      padding: 18px !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) !important;
      gap: 14px !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      flex: 0 1 auto !important;
      min-height: 0 !important;
      max-height: calc(min(820px, 90vh) - 78px) !important;
      align-items: start !important;
      box-sizing: border-box !important;
      scrollbar-gutter: stable !important;
    }
    #onebaseSettingsOverlay .ob-settings-section {
      width: auto !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: hidden !important;
      align-self: start !important;
    }
    #onebaseSettingsOverlay .ob-setting-row { height: auto !important; min-height: 0 !important; overflow: visible !important; }
    #onebaseSettingsOverlay .ob-setting-copy { overflow: visible !important; }
    #onebaseSettingsOverlay .ob-setting-copy span { white-space: normal !important; overflow: visible !important; text-overflow: clip !important; }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar { width: 9px !important; }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar-track { background: rgba(255,255,255,.055) !important; border-radius: 999px !important; }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar-thumb { background: rgba(214,168,79,.78) !important; border-radius: 999px !important; border: 2px solid transparent !important; background-clip: padding-box !important; }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar-thumb:hover { background: rgba(214,168,79,.98) !important; background-clip: padding-box !important; }
    @media(max-width:600px){
      #onebaseSettingsOverlay { padding: 10px !important; }
      #onebaseSettingsOverlay .ob-settings-window { width: 94vw !important; max-height: 94vh !important; }
      #onebaseSettingsOverlay .ob-settings-body { max-height: calc(94vh - 70px) !important; padding: 10px !important; }
    }
  `;
  function install() {
    if (document.getElementById('onebase-settings-scrollbar-css')) return;
    const style = document.createElement('style');
    style.id = 'onebase-settings-scrollbar-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }
  function repair() {
    install();
    const overlay = document.getElementById('onebaseSettingsOverlay');
    const windowEl = overlay?.querySelector('.ob-settings-window');
    const body = overlay?.querySelector('.ob-settings-body');
    if (!windowEl || !body) return;
    windowEl.style.setProperty('height', 'auto', 'important');
    windowEl.style.setProperty('max-height', 'min(820px, 90vh)', 'important');
    windowEl.style.setProperty('overflow', 'hidden', 'important');
    body.style.setProperty('display', 'grid', 'important');
    body.style.setProperty('grid-template-columns', 'minmax(0, 1fr)', 'important');
    body.style.setProperty('overflow-y', 'auto', 'important');
    body.style.setProperty('overflow-x', 'hidden', 'important');
    body.style.setProperty('flex', '0 1 auto', 'important');
    body.style.setProperty('max-height', 'calc(min(820px, 90vh) - 78px)', 'important');
    overlay.querySelectorAll('.ob-settings-section').forEach(section => {
      section.style.setProperty('height', 'auto', 'important');
      section.style.setProperty('max-height', 'none', 'important');
      section.style.setProperty('overflow', 'hidden', 'important');
    });
  }
  function start() {
    install();
    repair();
    new MutationObserver(repair).observe(document.documentElement, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
