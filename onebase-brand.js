/* ONEBASE branding layer. Does not touch persistence keys or application data. */
(function () {
  'use strict';

  const BRAND = 'ONEBASE';

  /* Light themes: white paper + intense black ink. This layer intentionally
     overrides the gold branding only when the active theme has a light canvas. */
  const LIGHT_THEME_CSS = `
    body.onebase-light-theme,
    body.onebase-light-theme * {
      --ob-gold:#050505 !important;
      --ob-gold-light:#000000 !important;
      --ob-gold-dark:#111111 !important;
      --ob-line:#050505 !important;
      --ob-line-soft:#1a1a1a !important;
      --ob-text:#050505 !important;
      --ob-muted:#171717 !important;
      --ob-dim:#333333 !important;
    }

    body.onebase-light-theme {
      background:#ffffff !important;
      color:#050505 !important;
      font-weight:600 !important;
    }

    body.onebase-light-theme .brand h1 {
      color:#000000 !important;
      -webkit-text-fill-color:#000000 !important;
      background:none !important;
      text-shadow:none !important;
      font-weight:400 !important;
      letter-spacing:2.4px !important;
    }
    body.onebase-light-theme .brand h1::after {
      background:#000000 !important;
      opacity:1 !important;
    }
    body.onebase-light-theme .brand::before {
      border:3px solid #000000 !important;
      box-shadow:0 0 0 1px #fff inset !important;
    }
    body.onebase-light-theme .brand .tag {
      color:#222222 !important;
      font-weight:800 !important;
    }
    body.onebase-light-theme .brand .tag::after { color:#222222 !important; }

    /* Thick black borders throughout the white themes. */
    body.onebase-light-theme .btn,
    body.onebase-light-theme .select,
    body.onebase-light-theme .profileTopBtn,
    body.onebase-light-theme .cloud-account-btn,
    body.onebase-light-theme .stat,
    body.onebase-light-theme .toolbar,
    body.onebase-light-theme .table,
    body.onebase-light-theme .searchBox,
    body.onebase-light-theme .toolbar select,
    body.onebase-light-theme .modalCard,
    body.onebase-light-theme .themeColorField,
    body.onebase-light-theme .themePreview,
    body.onebase-light-theme .settingsSection,
    body.onebase-light-theme .trashItem,
    body.onebase-light-theme .backupItem,
    body.onebase-light-theme .accountCard,
    body.onebase-light-theme .accountSection,
    body.onebase-light-theme .modeCard,
    body.onebase-light-theme .modeOption,
    body.onebase-light-theme .sourceChoices button,
    body.onebase-light-theme .field select,
    body.onebase-light-theme .field input[type=number],
    body.onebase-light-theme .nextAiring,
    body.onebase-light-theme .badge,
    body.onebase-light-theme .chip {
      border-width:2px !important;
      border-style:solid !important;
      border-color:#050505 !important;
    }

    body.onebase-light-theme .stat,
    body.onebase-light-theme .toolbar,
    body.onebase-light-theme .table,
    body.onebase-light-theme .modalCard,
    body.onebase-light-theme .settingsSection,
    body.onebase-light-theme .accountCard,
    body.onebase-light-theme .accountSection {
      background:#ffffff !important;
      color:#050505 !important;
      box-shadow:0 10px 0 rgba(0,0,0,.08) !important;
      backdrop-filter:none !important;
    }

    body.onebase-light-theme .head {
      background:#050505 !important;
      color:#ffffff !important;
      border-bottom:3px solid #000000 !important;
      font-weight:900 !important;
    }
    body.onebase-light-theme .row {
      background:#ffffff !important;
      border-bottom:2px solid #050505 !important;
      color:#050505 !important;
    }
    body.onebase-light-theme .row:not(.head):hover {
      background:#f2f2f2 !important;
    }

    body.onebase-light-theme .btn,
    body.onebase-light-theme .select,
    body.onebase-light-theme .toolbar select,
    body.onebase-light-theme .searchBox,
    body.onebase-light-theme .animeInput,
    body.onebase-light-theme .watched,
    body.onebase-light-theme .animeLink,
    body.onebase-light-theme .chip,
    body.onebase-light-theme .badge,
    body.onebase-light-theme .field label,
    body.onebase-light-theme .stat .label,
    body.onebase-light-theme .stat .value,
    body.onebase-light-theme .stat .sub,
    body.onebase-light-theme .mutedText,
    body.onebase-light-theme .hint,
    body.onebase-light-theme .footerNote,
    body.onebase-light-theme .infoLine,
    body.onebase-light-theme .infoLine b,
    body.onebase-light-theme .duration strong,
    body.onebase-light-theme .modalCard,
    body.onebase-light-theme .modalCard p,
    body.onebase-light-theme .close,
    body.onebase-light-theme .profileMeta strong,
    body.onebase-light-theme .accountSection p,
    body.onebase-light-theme .accountField label,
    body.onebase-light-theme .accountEmailLine,
    body.onebase-light-theme .accountVerify {
      color:#050505 !important;
      font-weight:700 !important;
      text-shadow:none !important;
    }

    body.onebase-light-theme .stat .value,
    body.onebase-light-theme .animeInput,
    body.onebase-light-theme .watched,
    body.onebase-light-theme .animeLink {
      font-weight:900 !important;
    }

    body.onebase-light-theme .btn:hover,
    body.onebase-light-theme .select:hover,
    body.onebase-light-theme .toolbar select:hover,
    body.onebase-light-theme .profileTopBtn:hover,
    body.onebase-light-theme .cloud-account-btn:hover,
    body.onebase-light-theme .sourceChoices button:hover,
    body.onebase-light-theme .modeOption:hover {
      background:#000000 !important;
      color:#ffffff !important;
      border-color:#000000 !important;
      box-shadow:0 5px 0 #555 !important;
      transform:translateY(-1px);
    }

    body.onebase-light-theme .searchBox,
    body.onebase-light-theme .animeInput:focus,
    body.onebase-light-theme .watched:focus,
    body.onebase-light-theme .settingsField input,
    body.onebase-light-theme .accountField input {
      background:#ffffff !important;
      color:#050505 !important;
      border:2px solid #050505 !important;
      box-shadow:none !important;
      outline:none !important;
    }
    body.onebase-light-theme .searchBox::placeholder,
    body.onebase-light-theme .animeInput::placeholder,
    body.onebase-light-theme .watched::placeholder {
      color:#555555 !important;
      font-weight:600 !important;
    }

    /* Gold progress/CTA treatment becomes pure black ink. */
    body.onebase-light-theme .progressBar {
      background:#d8d8d8 !important;
      border:2px solid #050505 !important;
      height:7px !important;
    }
    body.onebase-light-theme .progressBar span {
      background:#000000 !important;
      box-shadow:none !important;
    }
    body.onebase-light-theme .modalActions button:first-child,
    body.onebase-light-theme .themeActions .btn:not(.ghost) {
      background:#000000 !important;
      color:#ffffff !important;
      border:2px solid #000000 !important;
    }
    body.onebase-light-theme .modalActions button:first-child:hover,
    body.onebase-light-theme .themeActions .btn:not(.ghost):hover {
      background:#222222 !important;
      color:#ffffff !important;
      box-shadow:0 5px 0 #777 !important;
    }

    /* Remove every remaining OneBase gold accent from the light themes. */
    body.onebase-light-theme .row.onebase-status-pending,
    body.onebase-light-theme .row.onebase-status-completed,
    body.onebase-light-theme .row.onebase-status-watching,
    body.onebase-light-theme .row.onebase-status-paused,
    body.onebase-light-theme .row.onebase-status-abandoned {
      border-left:3px solid #000000 !important;
      box-shadow:inset 6px 0 0 rgba(0,0,0,.06) !important;
    }
    body.onebase-light-theme .row.onebase-status-watching::before {
      background:#000000 !important;
      box-shadow:none !important;
    }
    body.onebase-light-theme .row.onebase-status-pending .chip,
    body.onebase-light-theme .row.onebase-status-completed .chip,
    body.onebase-light-theme .row.onebase-status-watching .chip,
    body.onebase-light-theme .row.onebase-status-paused .chip,
    body.onebase-light-theme .row.onebase-status-abandoned .chip {
      color:#050505 !important;
      border-color:#050505 !important;
      background:#ffffff !important;
    }

    body.onebase-light-theme .animeLink.name-favorite,
    body.onebase-light-theme .animeLink.name-poop,
    body.onebase-light-theme .animeLink.name-diamond {
      color:#000000 !important;
      -webkit-text-fill-color:#000000 !important;
      background:#ffffff !important;
      text-shadow:none !important;
      animation:none !important;
    }
  `;

  function installLightThemeStyles() {
    if (document.getElementById('onebase-light-theme-style')) return;
    const style = document.createElement('style');
    style.id = 'onebase-light-theme-style';
    style.textContent = LIGHT_THEME_CSS;
    document.head.appendChild(style);
  }

  function isLightTheme() {
    const theme = document.body?.dataset?.theme || '';
    if (theme === 'high-white' || theme === 'manga') return true;
    if (theme !== 'custom') return false;
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
    const hex = bg.replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return false;
    const r = parseInt(hex.slice(0,2),16), g = parseInt(hex.slice(2,4),16), b = parseInt(hex.slice(4,6),16);
    return (r * 299 + g * 587 + b * 114) / 1000 >= 210;
  }

  function syncLightTheme() {
    installLightThemeStyles();
    document.body.classList.toggle('onebase-light-theme', isLightTheme());
  }

  function replaceVisibleText() {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/i.test(parent.tagName)) continue;
      if (/AnimeTracker/i.test(node.nodeValue || '')) nodes.push(node);
    }
    for (const text of nodes) {
      text.nodeValue = text.nodeValue.replace(/AnimeTracker/gi, BRAND);
    }
  }

  function applyBrand() {
    document.title = BRAND;
    document.documentElement.dataset.brand = 'onebase';
    installLightThemeStyles();
    replaceVisibleText();
    syncLightTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  } else {
    applyBrand();
  }

  const observer = new MutationObserver(() => {
    replaceVisibleText();
    syncLightTheme();
  });
  const startObserver = () => observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();
