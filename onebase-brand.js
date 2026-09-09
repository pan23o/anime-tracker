/* ONEBASE branding layer. Does not touch persistence keys or application data. */
(function () {
  'use strict';

  const BRAND = 'ONEBASE';

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

  function removeWhiteTheme() {
    const select = document.getElementById('themeSelect');
    if (!select) return;

    const whiteOption = select.querySelector('option[value="high-white"]');
    if (whiteOption) whiteOption.remove();

    // Si alguien tenía guardado el antiguo tema blanco, pasamos a Tinta.
    try {
      if (localStorage.getItem('anime_tracker_theme') === 'high-white') {
        localStorage.setItem('anime_tracker_theme', 'ink');
      }
    } catch (e) {}
  }

  function applyBrand() {
    document.title = BRAND;
    document.documentElement.dataset.brand = 'onebase';
    replaceVisibleText();
    removeWhiteTheme();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyBrand, { once: true });
  } else {
    applyBrand();
  }

  const observer = new MutationObserver(() => {
    replaceVisibleText();
    removeWhiteTheme();
  });
  const startObserver = () => observer.observe(document.body, { childList: true, subtree: true });
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver, { once: true });
})();
