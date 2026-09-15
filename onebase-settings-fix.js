/* OneBase — robust settings viewport fix. Loaded after the settings module so it wins over legacy layout rules. */
(function () {
  'use strict';

  const CSS = `
    /* The settings dialog must have a real viewport. The previous grid could
       compress its children and clip the lower controls without exposing a scrollbar. */
    #onebaseSettingsOverlay {
      align-items: center !important;
      justify-content: center !important;
      overflow: hidden !important;
      padding: 14px !important;
      box-sizing: border-box !important;
    }

    #onebaseSettingsOverlay.open {
      display: flex !important;
    }

    #onebaseSettingsOverlay .ob-settings-window {
      width: min(780px, calc(100vw - 28px)) !important;
      height: min(900px, calc(100vh - 28px)) !important;
      max-height: calc(100vh - 28px) !important;
      min-height: 0 !important;
      overflow: hidden !important;
      box-sizing: border-box !important;
      display: flex !important;
      flex-direction: column !important;
    }

    #onebaseSettingsOverlay .ob-settings-head {
      flex: 0 0 auto !important;
    }

    #onebaseSettingsOverlay .ob-settings-body {
      display: flex !important;
      flex: 1 1 auto !important;
      min-height: 0 !important;
      height: auto !important;
      max-height: none !important;
      overflow-y: scroll !important;
      overflow-x: hidden !important;
      overscroll-behavior: contain !important;
      scrollbar-gutter: stable !important;
      align-items: stretch !important;
      box-sizing: border-box !important;
    }

    /* Never let an individual section become the clipping viewport. */
    #onebaseSettingsOverlay .ob-settings-section {
      flex: 0 0 auto !important;
      width: 100% !important;
      height: auto !important;
      min-height: 0 !important;
      max-height: none !important;
      overflow: visible !important;
      box-sizing: border-box !important;
    }

    #onebaseSettingsOverlay .ob-settings-section-head,
    #onebaseSettingsOverlay .ob-theme-box,
    #onebaseSettingsOverlay .ob-setting-row {
      box-sizing: border-box !important;
    }

    #onebaseSettingsOverlay .ob-setting-row {
      min-height: 58px !important;
      height: auto !important;
      overflow: visible !important;
      align-items: center !important;
    }

    #onebaseSettingsOverlay .ob-setting-copy {
      flex: 1 1 auto !important;
      overflow: visible !important;
    }

    #onebaseSettingsOverlay .ob-setting-copy span {
      white-space: normal !important;
      overflow: visible !important;
      text-overflow: clip !important;
    }

    /* Make the scrollbar deliberately visible instead of depending on the OS overlay setting. */
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar {
      width: 10px !important;
    }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar-track {
      background: rgba(255,255,255,.045) !important;
      border-radius: 999px !important;
    }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar-thumb {
      background: rgba(214,168,79,.72) !important;
      border: 2px solid transparent !important;
      background-clip: padding-box !important;
      border-radius: 999px !important;
      min-height: 42px !important;
    }
    #onebaseSettingsOverlay .ob-settings-body::-webkit-scrollbar-thumb:hover {
      background: rgba(214,168,79,.95) !important;
      background-clip: padding-box !important;
    }

    @media (max-width: 600px) {
      #onebaseSettingsOverlay {
        padding: 8px !important;
      }
      #onebaseSettingsOverlay .ob-settings-window {
        width: calc(100vw - 16px) !important;
        height: calc(100vh - 16px) !important;
        max-height: calc(100vh - 16px) !important;
        border-radius: 16px !important;
      }
    }
  `;

  function install() {
    if (document.getElementById('onebase-settings-fix-css')) return;
    const style = document.createElement('style');
    style.id = 'onebase-settings-fix-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function repair() {
    install();
    const overlay = document.getElementById('onebaseSettingsOverlay');
    const body = overlay?.querySelector('.ob-settings-body');
    if (!body) return;

    // Inline fallbacks make the fix resilient against legacy/global modal rules.
    body.style.setProperty('display', 'flex', 'important');
    body.style.setProperty('flex', '1 1 auto', 'important');
    body.style.setProperty('min-height', '0', 'important');
    body.style.setProperty('max-height', 'none', 'important');
    body.style.setProperty('overflow-y', 'scroll', 'important');
    body.style.setProperty('overflow-x', 'hidden', 'important');

    overlay.querySelectorAll('.ob-settings-section').forEach(section => {
      section.style.setProperty('height', 'auto', 'important');
      section.style.setProperty('max-height', 'none', 'important');
      section.style.setProperty('overflow', 'visible', 'important');
      section.style.setProperty('flex', '0 0 auto', 'important');
    });
  }

  function start() {
    install();
    repair();
    const observer = new MutationObserver(() => repair());
    observer.observe(document.documentElement, { childList: true, subtree: true });
    window.OneBaseSettingsViewportFix = { repair };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
})();
