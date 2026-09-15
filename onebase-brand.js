/* ONEBASE branding layer. Does not touch persistence keys or application data. */
(function () {
  'use strict';

  const BRAND = 'ONEBASE';

  const LIGHT_THEME_CSS = `
    body.onebase-light-theme,
    body.onebase-light-theme * { --ob-gold:#050505 !important; --ob-gold-light:#000000 !important; --ob-gold-dark:#111111 !important; --ob-line:#050505 !important; --ob-line-soft:#1a1a1a !important; --ob-text:#050505 !important; --ob-muted:#171717 !important; --ob-dim:#333333 !important; }
    body.onebase-light-theme { background:#ffffff !important; color:#050505 !important; font-weight:600 !important; }
    body.onebase-light-theme .brand h1 { color:#000000 !important; -webkit-text-fill-color:#000000 !important; background:none !important; text-shadow:none !important; font-weight:400 !important; letter-spacing:2.4px !important; }
    body.onebase-light-theme .brand h1::after { background:#000000 !important; opacity:1 !important; }
    body.onebase-light-theme .brand::before { border:3px solid #000000 !important; box-shadow:0 0 0 1px #fff inset !important; }
    body.onebase-light-theme .brand .tag { color:#222222 !important; font-weight:800 !important; }
    body.onebase-light-theme .brand .tag::after { color:#222222 !important; }
    body.onebase-light-theme .btn, body.onebase-light-theme .select, body.onebase-light-theme .profileTopBtn, body.onebase-light-theme .cloud-account-btn, body.onebase-light-theme .stat, body.onebase-light-theme .toolbar, body.onebase-light-theme .table, body.onebase-light-theme .searchBox, body.onebase-light-theme .toolbar select, body.onebase-light-theme .modalCard, body.onebase-light-theme .themeColorField, body.onebase-light-theme .themePreview, body.onebase-light-theme .settingsSection, body.onebase-light-theme .trashItem, body.onebase-light-theme .backupItem, body.onebase-light-theme .accountCard, body.onebase-light-theme .accountSection, body.onebase-light-theme .modeCard, body.onebase-light-theme .modeOption, body.onebase-light-theme .sourceChoices button, body.onebase-light-theme .field select, body.onebase-light-theme .field input[type=number], body.onebase-light-theme .nextAiring, body.onebase-light-theme .badge, body.onebase-light-theme .chip { border-width:2px !important; border-style:solid !important; border-color:#050505 !important; }
    body.onebase-light-theme .stat, body.onebase-light-theme .toolbar, body.onebase-light-theme .table, body.onebase-light-theme .modalCard, body.onebase-light-theme .settingsSection, body.onebase-light-theme .accountCard, body.onebase-light-theme .accountSection { background:#ffffff !important; color:#050505 !important; box-shadow:0 10px 0 rgba(0,0,0,.08) !important; backdrop-filter:none !important; }
    body.onebase-light-theme .head { background:#050505 !important; color:#ffffff !important; border-bottom:3px solid #000000 !important; font-weight:900 !important; }
    body.onebase-light-theme .row { background:#ffffff !important; border-bottom:2px solid #050505 !important; color:#050505 !important; }
    body.onebase-light-theme .row:not(.head):hover { background:#f2f2f2 !important; }
    body.onebase-light-theme .btn, body.onebase-light-theme .select, body.onebase-light-theme .toolbar select, body.onebase-light-theme .searchBox, body.onebase-light-theme .animeInput, body.onebase-light-theme .watched, body.onebase-light-theme .animeLink, body.onebase-light-theme .chip, body.onebase-light-theme .badge, body.onebase-light-theme .field label, body.onebase-light-theme .stat .label, body.onebase-light-theme .stat .value, body.onebase-light-theme .stat .sub, body.onebase-light-theme .mutedText, body.onebase-light-theme .hint, body.onebase-light-theme .footerNote, body.onebase-light-theme .infoLine, body.onebase-light-theme .infoLine b, body.onebase-light-theme .duration strong, body.onebase-light-theme .modalCard, body.onebase-light-theme .modalCard p, body.onebase-light-theme .close, body.onebase-light-theme .profileMeta strong, body.onebase-light-theme .accountSection p, body.onebase-light-theme .accountField label, body.onebase-light-theme .accountEmailLine, body.onebase-light-theme .accountVerify { color:#050505 !important; font-weight:700 !important; text-shadow:none !important; }
    body.onebase-light-theme .stat .value, body.onebase-light-theme .animeInput, body.onebase-light-theme .watched, body.onebase-light-theme .animeLink { font-weight:900 !important; }
    body.onebase-light-theme .btn:hover, body.onebase-light-theme .select:hover, body.onebase-light-theme .toolbar select:hover, body.onebase-light-theme .profileTopBtn:hover, body.onebase-light-theme .cloud-account-btn:hover, body.onebase-light-theme .sourceChoices button:hover, body.onebase-light-theme .modeOption:hover { background:#000000 !important; color:#ffffff !important; border-color:#000000 !important; box-shadow:0 5px 0 #555 !important; transform:translateY(-1px); }
    body.onebase-light-theme .searchBox, body.onebase-light-theme .animeInput:focus, body.onebase-light-theme .watched:focus, body.onebase-light-theme .settingsField input, body.onebase-light-theme .accountField input { background:#ffffff !important; color:#050505 !important; border:2px solid #050505 !important; box-shadow:none !important; outline:none !important; }
    body.onebase-light-theme .searchBox::placeholder, body.onebase-light-theme .animeInput::placeholder, body.onebase-light-theme .watched::placeholder { color:#555555 !important; font-weight:600 !important; }
    body.onebase-light-theme .progressBar { background:#d8d8d8 !important; border:2px solid #050505 !important; height:7px !important; }
    body.onebase-light-theme .progressBar span { background:#000000 !important; box-shadow:none !important; }
    body.onebase-light-theme .modalActions button:first-child, body.onebase-light-theme .themeActions .btn:not(.ghost) { background:#000000 !important; color:#ffffff !important; border:2px solid #000000 !important; }
    body.onebase-light-theme .modalActions button:first-child:hover, body.onebase-light-theme .themeActions .btn:not(.ghost):hover { background:#222222 !important; color:#ffffff !important; box-shadow:0 5px 0 #777 !important; }
    body.onebase-light-theme .row.onebase-status-pending, body.onebase-light-theme .row.onebase-status-completed, body.onebase-light-theme .row.onebase-status-watching, body.onebase-light-theme .row.onebase-status-paused, body.onebase-light-theme .row.onebase-status-abandoned { border-left:3px solid #000000 !important; box-shadow:inset 6px 0 0 rgba(0,0,0,.06) !important; }
    body.onebase-light-theme .row.onebase-status-watching::before { background:#000000 !important; box-shadow:none !important; }
    body.onebase-light-theme .row.onebase-status-pending .chip, body.onebase-light-theme .row.onebase-status-completed .chip, body.onebase-light-theme .row.onebase-status-watching .chip, body.onebase-light-theme .row.onebase-status-paused .chip, body.onebase-light-theme .row.onebase-status-abandoned .chip { color:#050505 !important; border-color:#050505 !important; background:#ffffff !important; }
    body.onebase-light-theme .animeLink.name-favorite, body.onebase-light-theme .animeLink.name-poop, body.onebase-light-theme .animeLink.name-diamond { color:#000000 !important; -webkit-text-fill-color:#000000 !important; background:#ffffff !important; text-shadow:none !important; animation:none !important; }
  `;

  const POLISH_CSS = `
    /* ONEBASE UI polish: stronger brand, separated dashboard shadows, usable settings scroll. */
    .brand{gap:18px!important;align-items:center!important}
    .brand::before{width:62px!important;height:62px!important;flex-basis:62px!important;border-radius:15px!important;background-size:78%!important;border-width:1.5px!important;box-shadow:0 0 0 1px rgba(255,255,255,.035) inset,0 10px 28px rgba(0,0,0,.5),0 0 28px rgba(214,168,79,.12)!important}
    .brand h1{font-size:70px!important;line-height:.78!important;letter-spacing:3.4px!important;font-weight:400!important;text-shadow:0 3px 0 rgba(0,0,0,.4),0 0 26px rgba(214,168,79,.18)!important;transform:skewX(-3deg)!important;transform-origin:left center!important}
    .brand h1::after{height:3px!important;width:48%!important;margin:9px auto 0!important;box-shadow:0 0 10px rgba(240,201,106,.22)!important}
    .brand .tag{margin-top:11px!important;letter-spacing:2.2px!important}

    .dashboard{gap:12px!important;margin-bottom:16px!important}
    .dashboard .stat{position:relative!important;z-index:1!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.025),0 7px 16px rgba(0,0,0,.20)!important}
    .dashboard .stat:hover{z-index:4!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.04),0 12px 24px rgba(0,0,0,.30),0 0 12px rgba(214,168,79,.035)!important}
    .dashboard .stat .value{position:relative;z-index:2}
    .dashboard .stat.wide{min-height:82px!important}

    .onebase-level-card{grid-column:span 4!important;min-height:82px!important;display:grid!important;grid-template-columns:auto 1fr auto;grid-template-rows:auto auto;column-gap:16px;align-items:center;background:linear-gradient(135deg,rgba(214,168,79,.12),var(--ob-panel))!important;border-color:rgba(214,168,79,.34)!important;overflow:hidden!important}
    .onebase-level-card::before{content:"";position:absolute;inset:0;background:linear-gradient(110deg,rgba(214,168,79,.07),transparent 55%);pointer-events:none}
    .onebase-level-card .label{grid-column:1/-1;position:relative;z-index:1}
    .onebase-level-card .value{grid-column:1;grid-row:2;margin-top:0!important;color:var(--ob-gold-light)!important;font-size:30px!important;letter-spacing:-1px!important;white-space:nowrap}
    .onebase-level-card .sub{grid-column:2;grid-row:2;margin-top:0!important;font-size:10px!important;position:relative;z-index:1}
    .onebase-level-card .levelProgress{grid-column:3;grid-row:2;width:min(240px,20vw);height:7px;border-radius:99px;background:#20252b;overflow:hidden;position:relative;z-index:1;border:1px solid rgba(214,168,79,.14)}
    .onebase-level-card .levelProgress span{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--ob-gold-dark),var(--ob-gold),var(--ob-gold-light));box-shadow:0 0 12px rgba(214,168,79,.34);transition:width .45s cubic-bezier(.2,.8,.2,1)}

    .settingsCard{width:min(820px,calc(100vw - 40px))!important;max-height:min(88vh,900px)!important;overflow:hidden!important;display:flex!important;flex-direction:column!important}
    #settingsModal .settingsCard>h2,#settingsModal .settingsCard>p{flex:0 0 auto}
    #settingsModal .settingsGrid{display:grid!important;overflow-y:auto!important;overflow-x:hidden!important;min-height:0!important;max-height:none!important;padding:2px 10px 8px 0!important;scrollbar-gutter:stable!important;overscroll-behavior:contain!important}
    #settingsModal .settingsGrid::-webkit-scrollbar{width:10px}
    #settingsModal .settingsGrid::-webkit-scrollbar-track{background:#090c0f;border-radius:99px}
    #settingsModal .settingsGrid::-webkit-scrollbar-thumb{background:#3a4148;border:2px solid #090c0f;border-radius:99px}
    #settingsModal .settingsGrid::-webkit-scrollbar-thumb:hover{background:var(--ob-gold-dark)}
    #settingsModal .settingsSection{min-width:0}
    #settingsModal .settingsSection p{max-width:100%}

    @media(max-width:900px){.brand h1{font-size:58px!important}.brand::before{width:54px!important;height:54px!important;flex-basis:54px!important}.onebase-level-card{grid-column:span 3!important}.onebase-level-card .levelProgress{width:min(190px,18vw)}}
    @media(max-width:750px){.brand{gap:12px!important}.brand h1{font-size:48px!important}.brand::before{width:46px!important;height:46px!important;flex-basis:46px!important}.onebase-level-card{grid-column:span 2!important;grid-template-columns:1fr auto}.onebase-level-card .sub{grid-column:1}.onebase-level-card .levelProgress{grid-column:2;width:120px}.settingsCard{width:min(96vw,760px)!important;max-height:90vh!important}}
    @media(max-width:520px){.brand h1{font-size:40px!important;letter-spacing:2px!important}.brand::before{width:40px!important;height:40px!important;flex-basis:40px!important}.onebase-level-card{grid-column:span 2!important;display:block!important}.onebase-level-card .label,.onebase-level-card .value,.onebase-level-card .sub{display:block!important}.onebase-level-card .value{margin-top:5px!important}.onebase-level-card .sub{margin-top:3px!important}.onebase-level-card .levelProgress{width:100%!important;margin-top:8px!important}}
    @media(prefers-reduced-motion:reduce){.brand h1{transform:none!important}}
  `;

  function installStyles(id, css) {
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
  }
  function installLightThemeStyles() { installStyles('onebase-light-theme-style', LIGHT_THEME_CSS); }
  function installPolishStyles() { installStyles('onebase-polish-style', POLISH_CSS); }

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
    for (const text of nodes) text.nodeValue = text.nodeValue.replace(/AnimeTracker/gi, BRAND);
  }

  function installDashboardLevel() {
    const dashboard = document.querySelector('.dashboard');
    if (!dashboard) return;
    let levelCard = document.getElementById('onebaseLevelCard');
    if (!levelCard) {
      levelCard = document.createElement('div');
      levelCard.id = 'onebaseLevelCard';
      levelCard.className = 'stat onebase-level-card';
      levelCard.innerHTML = '<div class="label">Nivel del usuario</div><div class="value" id="onebaseLevelValue">NIVEL 1</div><div class="sub" id="onebaseLevelSub">0 XP · 0% al siguiente nivel</div><div class="levelProgress"><span id="onebaseLevelBar"></span></div>';
      dashboard.appendChild(levelCard);
    }
    const chapterEl = document.getElementById('statChapters');
    const completedEl = document.getElementById('statCompleted');
    const animeEl = document.getElementById('statAnime');
    const watched = Math.max(0, Number((chapterEl?.textContent || '0').replace(/\D/g,'')) || 0);
    const completed = Math.max(0, Number((completedEl?.textContent || '0').replace(/\D/g,'')) || 0);
    const anime = Math.max(0, Number((animeEl?.textContent || '0').replace(/\D/g,'')) || 0);
    const xp = watched * 10 + completed * 50 + anime * 5;
    const level = Math.max(1, Math.floor(xp / 250) + 1);
    const currentBase = (level - 1) * 250;
    const progress = Math.max(0, Math.min(100, ((xp - currentBase) / 250) * 100));
    const value = document.getElementById('onebaseLevelValue');
    const sub = document.getElementById('onebaseLevelSub');
    const bar = document.getElementById('onebaseLevelBar');
    if (value) value.textContent = `NIVEL ${level}`;
    if (sub) sub.textContent = `${xp.toLocaleString('es-ES')} XP · ${Math.round(progress)}% al siguiente nivel`;
    if (bar) bar.style.width = `${progress}%`;
  }

  function applyBrand() {
    document.title = BRAND;
    document.documentElement.dataset.brand = 'onebase';
    installLightThemeStyles();
    installPolishStyles();
    replaceVisibleText();
    syncLightTheme();
    installDashboardLevel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  else applyBrand();

  let refreshTimer = 0;
  const observer = new MutationObserver(() => {
    replaceVisibleText();
    syncLightTheme();
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(installDashboardLevel, 40);
  });
  const startObserver = () => observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-theme'] });
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();
