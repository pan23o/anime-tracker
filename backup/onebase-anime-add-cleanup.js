/* ONEBASE · Añadir anime + ficha Wikipedia
 * - Removes the legacy inline "Escribe un anime..." row now that the AniList button is the canonical add flow.
 * - Makes the AniList add button visually unmistakable.
 * - Makes an already-added anime's cover in its info card open the best matching Spanish Wikipedia article.
 */
(function () {
  'use strict';

  const VERSION = 'anime-add-cleanup-v1';
  let wikiBusy = false;

  const text = (v) => String(v ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const normalize = (v) => text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));

  function injectStyles() {
    if (document.getElementById('onebase-add-cleanup-style')) return;
    const style = document.createElement('style');
    style.id = 'onebase-add-cleanup-style';
    style.textContent = `
      /* The old empty row is no longer an add control. */
      #rows .onebase-legacy-add-row { display: none !important; }
      .hint.onebase-legacy-add-hint { display: none !important; }

      /* Canonical AniList add button: deliberately distinct from utility controls. */
      #onebase-anilist-add-btn {
        order: -20;
        position: relative;
        isolation: isolate;
        min-height: 42px;
        padding: 10px 17px 10px 14px;
        border: 1px solid #d6ff43;
        border-radius: 12px;
        background: linear-gradient(135deg, #d9ff45 0%, #b9ed20 100%);
        color: #070707;
        font-size: 11px;
        font-weight: 950;
        letter-spacing: .35px;
        box-shadow: 0 0 0 1px rgba(218,255,75,.08), 0 0 24px rgba(190,241,35,.18), 0 10px 28px rgba(0,0,0,.32);
        transform: translateZ(0);
        transition: transform .2s ease, box-shadow .2s ease, filter .2s ease;
      }
      #onebase-anilist-add-btn::before {
        content: '＋';
        display: inline-grid;
        place-items: center;
        width: 19px;
        height: 19px;
        margin-right: 7px;
        border-radius: 50%;
        background: rgba(0,0,0,.13);
        font-size: 15px;
        line-height: 1;
        vertical-align: -2px;
      }
      #onebase-anilist-add-btn::after {
        content: '';
        position: absolute;
        inset: -4px;
        z-index: -1;
        border-radius: 15px;
        border: 1px solid rgba(211,255,65,.28);
        opacity: .75;
        animation: onebaseAddPulse 2.2s ease-in-out infinite;
      }
      #onebase-anilist-add-btn:hover {
        filter: brightness(1.06);
        transform: translateY(-2px) scale(1.015);
        box-shadow: 0 0 0 1px rgba(218,255,75,.14), 0 0 34px rgba(190,241,35,.3), 0 14px 35px rgba(0,0,0,.4);
      }
      #onebase-anilist-add-btn:active { transform: translateY(0) scale(.99); }
      @keyframes onebaseAddPulse {
        0%,100% { transform: scale(.98); opacity: .3; }
        50% { transform: scale(1.035); opacity: .8; }
      }

      /* The cover is now an intentional external-link affordance. */
      #infoCoverWrap .cover {
        cursor: pointer;
        transition: transform .2s ease, filter .2s ease, box-shadow .2s ease, border-color .2s ease;
      }
      #infoCoverWrap .cover:hover {
        transform: translateY(-2px) scale(1.018);
        filter: brightness(1.08);
        border-color: #d6ff43;
        box-shadow: 0 0 0 3px rgba(214,255,67,.08), 0 12px 30px rgba(0,0,0,.45);
      }
      #infoCoverWrap .onebase-wiki-hint {
        margin-top: 7px;
        color: #777;
        font-size: 8px;
        letter-spacing: .6px;
        text-transform: uppercase;
        text-align: center;
      }
      #infoCoverWrap .onebase-wiki-hint strong { color: #b9ed20; }
    `;
    document.head.appendChild(style);
  }

  function hideLegacyAddRow() {
    const rows = document.getElementById('rows');
    if (!rows) return;
    rows.querySelectorAll('.row').forEach((row) => {
      const input = row.querySelector('.animeInput');
      if (!input) return;
      const value = String(input.value || '').trim();
      if (value) return;
      row.classList.add('onebase-legacy-add-row');
      row.setAttribute('aria-hidden', 'true');
    });

    document.querySelectorAll('.hint').forEach((hint) => {
      const value = text(hint.textContent);
      if (/Escribe un anime en la última fila/i.test(value)) {
        hint.classList.add('onebase-legacy-add-hint');
      }
    });
  }

  function addWikipediaHint() {
    const wrap = document.getElementById('infoCoverWrap');
    if (!wrap || !wrap.querySelector('.cover') || wrap.querySelector('.onebase-wiki-hint')) return;
    const hint = document.createElement('div');
    hint.className = 'onebase-wiki-hint';
    hint.innerHTML = 'Abrir <strong>Wikipedia</strong>';
    wrap.appendChild(hint);
  }

  function getCurrentInfoIndex() {
    try {
      return typeof infoIndex === 'number' ? infoIndex : null;
    } catch (_) {
      return null;
    }
  }

  async function findWikipediaPage(title) {
    const query = text(title);
    if (!query) return null;

    const endpoint = 'https://es.wikipedia.org/w/api.php';
    const params = new URLSearchParams({
      origin: '*',
      format: 'json',
      formatversion: '2',
      action: 'query',
      list: 'search',
      srsearch: query,
      srnamespace: '0',
      srlimit: '8'
    });

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { accept: 'application/json' },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('WIKIPEDIA_HTTP');

    const payload = await response.json();
    const results = Array.isArray(payload?.query?.search) ? payload.query.search : [];
    if (!results.length) return null;

    const normalized = normalize(query);
    const exact = results.find((result) => normalize(result?.title) === normalized);
    const page = exact || results[0];
    if (!page?.title) return null;

    return `https://es.wikipedia.org/wiki/${encodeURIComponent(String(page.title).replace(/ /g, '_'))}`;
  }

  async function openWikipedia() {
    if (wikiBusy) return;
    const index = getCurrentInfoIndex();
    let item = null;
    try {
      if (index !== null && Array.isArray(data)) item = data[index];
    } catch (_) {}
    if (!item?.anime) return;

    const title = item.apiTitle || item.anime;
    if (item.wikiUrl) {
      window.open(item.wikiUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    wikiBusy = true;
    try {
      const url = await findWikipediaPage(title);
      if (!url) {
        const fallback = `https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`;
        window.open(fallback, '_blank', 'noopener,noreferrer');
        return;
      }
      item.wikiUrl = url;
      item.updatedAt = Date.now();
      try { if (typeof save === 'function') save({ skipBackup: true }); } catch (_) {}
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.warn('[ONEBASE] Wikipedia lookup failed:', error);
      window.open(`https://es.wikipedia.org/w/index.php?search=${encodeURIComponent(title)}`, '_blank', 'noopener,noreferrer');
    } finally {
      wikiBusy = false;
    }
  }

  function wireInfoCover() {
    const wrap = document.getElementById('infoCoverWrap');
    if (!wrap || wrap.dataset.onebaseWikiBound === VERSION) return;
    wrap.dataset.onebaseWikiBound = VERSION;
    wrap.addEventListener('click', (event) => {
      if (!event.target.closest('.cover')) return;
      event.preventDefault();
      openWikipedia();
    });

    const observer = new MutationObserver(addWikipediaHint);
    observer.observe(wrap, { childList: true, subtree: true });
  }

  function boot() {
    injectStyles();
    wireInfoCover();
    hideLegacyAddRow();
    addWikipediaHint();

    const rows = document.getElementById('rows');
    if (rows) {
      const observer = new MutationObserver(() => hideLegacyAddRow());
      observer.observe(rows, { childList: true, subtree: true });
    }

    const infoModal = document.getElementById('infoModal');
    if (infoModal) {
      const observer = new MutationObserver(() => addWikipediaHint());
      observer.observe(infoModal, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    setTimeout(boot, 0);
  }
})();
