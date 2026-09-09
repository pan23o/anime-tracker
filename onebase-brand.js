/* ONEBASE branding + settings layer. */
(function () {
  'use strict';

  const BRAND = 'ONEBASE';
  const LANG_KEY = 'onebase_language';
  const THEME_KEY = 'anime_tracker_theme';
  const LANGS = { es: 'Español', en: 'English', fr: 'Français' };

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

  function removeWhiteTheme() {
    const select = document.getElementById('themeSelect');
    if (select) {
      const whiteOption = select.querySelector('option[value="high-white"]');
      if (whiteOption) whiteOption.remove();
    }
    try {
      if (localStorage.getItem(THEME_KEY) === 'high-white') localStorage.setItem(THEME_KEY, 'ink');
    } catch (e) {}
  }

  function getLanguage() {
    try {
      const value = localStorage.getItem(LANG_KEY);
      return LANGS[value] ? value : 'es';
    } catch (e) { return 'es'; }
  }

  function setLanguage(lang) {
    if (!LANGS[lang]) lang = 'es';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.documentElement.lang = lang;
    const select = document.getElementById('onebaseLanguageSelect');
    if (select) select.value = lang;
    document.dispatchEvent(new CustomEvent('onebase:languagechange', { detail: { language: lang } }));
  }

  function buildSettings() {
    if (document.getElementById('onebaseSettingsModal')) return;

    const style = document.createElement('style');
    style.id = 'onebaseSettingsStyles';
    style.textContent = `
      #onebaseSettingsModal{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.72);backdrop-filter:blur(7px)}
      #onebaseSettingsModal.hidden{display:none}
      .onebaseSettingsCard{width:min(620px,100%);max-height:min(82vh,720px);overflow:auto;background:var(--panel,#111);color:var(--text,#fff);border:1px solid var(--line2,#444);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.65);padding:22px}
      .onebaseSettingsHead{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:18px}
      .onebaseSettingsHead h2{margin:0;font-size:20px;letter-spacing:-.4px}
      .onebaseSettingsClose{border:1px solid var(--line2,#444);background:var(--panel2,#171717);color:var(--text,#fff);width:34px;height:34px;border-radius:10px;font-weight:900;cursor:pointer}
      .onebaseSettingsSection{border:1px solid var(--line,#292929);background:var(--panel2,#171717);border-radius:14px;padding:16px;margin-top:12px}
      .onebaseSettingsSection h3{margin:0 0 5px;font-size:12px}
      .onebaseSettingsSection p{margin:0 0 13px;color:var(--muted,#999);font-size:10px;line-height:1.5}
      .onebaseSettingsField{display:grid;gap:7px}
      .onebaseSettingsField label{font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--muted,#999);font-weight:800}
      .onebaseSettingsField select{width:100%;padding:11px 12px;border:1px solid var(--line2,#444);border-radius:10px;background:var(--panel,#111);color:var(--text,#fff);font-weight:700;outline:none}
      .onebaseSettingsFooter{margin-top:16px;color:var(--dim,#777);font-size:9px;text-align:right}
    `;
    document.head.appendChild(style);

    const modal = document.createElement('div');
    modal.id = 'onebaseSettingsModal';
    modal.className = 'hidden';
    modal.innerHTML = `
      <div class="onebaseSettingsCard" role="dialog" aria-modal="true" aria-labelledby="onebaseSettingsTitle">
        <div class="onebaseSettingsHead">
          <h2 id="onebaseSettingsTitle">Ajustes</h2>
          <button class="onebaseSettingsClose" type="button" aria-label="Cerrar">×</button>
        </div>
        <section class="onebaseSettingsSection">
          <h3>Idioma</h3>
          <p>Elige el idioma de la interfaz de ONEBASE.</p>
          <div class="onebaseSettingsField">
            <label for="onebaseLanguageSelect">Idioma de la interfaz</label>
            <select id="onebaseLanguageSelect">
              <option value="es">Español</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
            </select>
          </div>
        </section>
        <div class="onebaseSettingsFooter">ONEBASE · Configuración</div>
      </div>`;
    document.body.appendChild(modal);

    const close = () => modal.classList.add('hidden');
    modal.querySelector('.onebaseSettingsClose').addEventListener('click', close);
    modal.addEventListener('click', e => { if (e.target === modal) close(); });
    modal.querySelector('#onebaseLanguageSelect').addEventListener('change', e => setLanguage(e.target.value));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) close(); });
  }

  function wireSettingsButton() {
    const old = document.getElementById('settingsBtn');
    if (!old || old.dataset.onebaseSettingsWired === '1') return;
    const replacement = old.cloneNode(true);
    replacement.dataset.onebaseSettingsWired = '1';
    replacement.textContent = 'Ajustes';
    old.replaceWith(replacement);
    replacement.addEventListener('click', () => {
      buildSettings();
      const modal = document.getElementById('onebaseSettingsModal');
      const select = document.getElementById('onebaseLanguageSelect');
      if (select) select.value = getLanguage();
      modal.classList.remove('hidden');
    });
  }

  function applyBrand() {
    document.title = BRAND;
    document.documentElement.dataset.brand = 'onebase';
    replaceVisibleText();
    removeWhiteTheme();
    wireSettingsButton();
    setLanguage(getLanguage());
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  else applyBrand();

  const observer = new MutationObserver(() => {
    replaceVisibleText();
    removeWhiteTheme();
    wireSettingsButton();
  });
  const startObserver = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();
