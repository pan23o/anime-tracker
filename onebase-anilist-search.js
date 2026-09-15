/* ONEBASE · AniList search v1
 * Replaces the fragile title-only add flow with: search -> choose exact anime -> preview -> add.
 * Uses the local /api/anilist-search proxy so the browser never talks to AniList directly.
 */
(function () {
  'use strict';

  const VERSION = 'anilist-search-v1';
  let booted = false;
  let searchTimer = null;
  let requestSerial = 0;
  let selected = null;
  let modal = null;

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  const text = (value) => String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const titleOf = (m) => m?.title?.userPreferred || m?.title?.english || m?.title?.romaji || m?.title?.native || 'Sin título';
  const altTitleOf = (m) => {
    const titles = [m?.title?.english, m?.title?.romaji, m?.title?.native, ...(Array.isArray(m?.synonyms) ? m.synonyms : [])]
      .map(text).filter(Boolean);
    const main = titleOf(m).toLowerCase();
    return [...new Set(titles.filter(v => v.toLowerCase() !== main.toLowerCase()))].slice(0, 3);
  };
  const yearOf = (m) => Number(m?.seasonYear || String(m?.startDate?.year || '').replace(/\D/g, '')) || '';
  const formatOf = (m) => ({ TV: 'TV', MOVIE: 'PELÍCULA', OVA: 'OVA', ONA: 'ONA', SPECIAL: 'ESPECIAL', MUSIC: 'MÚSICA', TV_SHORT: 'TV CORTA' }[m?.format] || m?.format || 'ANIME');
  const statusOf = (m) => ({ FINISHED: 'TERMINADO', RELEASING: 'EN EMISIÓN', NOT_YET_RELEASED: 'PRÓXIMAMENTE', CANCELLED: 'CANCELADO', HIATUS: 'PAUSADO' }[m?.status] || m?.status || 'DESCONOCIDO');
  const sourceOf = (m) => ({ MANGA: 'MANGA', ORIGINAL: 'ORIGINAL', LIGHT_NOVEL: 'NOVELA LIGERA', VISUAL_NOVEL: 'VISUAL NOVEL', VIDEO_GAME: 'VIDEOJUEGO', WEB_NOVEL: 'WEB NOVEL', OTHER: 'OTRO', NOVEL: 'NOVELA', DOUJINSHI: 'DOUJINSHI', ANIME: 'ANIME', LIVE_ACTION: 'LIVE ACTION', GAME: 'JUEGO', COMIC: 'CÓMIC', MULTIMEDIA_PROJECT: 'PROYECTO MULTIMEDIA', PICTURE_BOOK: 'LIBRO ILUSTRADO' }[m?.source] || '—');
  const coverOf = (m) => m?.coverImage?.extraLarge || m?.coverImage?.large || m?.coverImage?.medium || '';
  const normalize = (v) => text(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

  function getData() {
    try { return (typeof data !== 'undefined' && Array.isArray(data)) ? data : null; } catch (_) { return null; }
  }

  function isDuplicate(media) {
    const list = getData() || [];
    const id = Number(media?.id);
    const wanted = normalize(titleOf(media));
    return list.some(item => Number(item?.anilistId || item?.aniListId || item?.anilist_id) === id || normalize(item?.anime) === wanted);
  }

  function persist() {
    try {
      if (typeof save === 'function') save({ skipBackup: true });
      if (typeof window.render === 'function') window.render();
      window.dispatchEvent(new CustomEvent('onebase:anime-added', { detail: selected }));
      return true;
    } catch (error) {
      console.error('[ONEBASE] AniList add failed:', error);
      window.toast?.('No se ha podido guardar el anime.');
      return false;
    }
  }

  function addSelected() {
    if (!selected) return;
    if (isDuplicate(selected)) {
      window.toast?.('Este anime ya está en tu lista.');
      return;
    }
    const list = getData();
    if (!list) {
      window.toast?.('La lista todavía no está preparada. Inténtalo de nuevo.');
      return;
    }

    const total = Number.isFinite(Number(selected.episodes)) && Number(selected.episodes) > 0 ? String(selected.episodes) : '';
    const item = {
      anime: titleOf(selected),
      watched: '0',
      total,
      state: selected.status === 'FINISHED' ? 'terminado' : 'pendiente',
      newEpisodes: 0,
      favorite: false,
      anilistId: Number(selected.id),
      malId: selected.idMal ? Number(selected.idMal) : null,
      coverImage: coverOf(selected),
      bannerImage: selected.bannerImage || '',
      description: text(selected.description || ''),
      year: yearOf(selected) || '',
      format: selected.format || '',
      anilistStatus: selected.status || '',
      score: Number(selected.averageScore || 0),
      popularity: Number(selected.popularity || 0),
      favourites: Number(selected.favourites || 0),
      genres: Array.isArray(selected.genres) ? selected.genres.slice(0, 8) : [],
      synonyms: Array.isArray(selected.synonyms) ? selected.synonyms.slice(0, 8) : [],
      source: selected.source || '',
      duration: Number(selected.duration || 0),
      countryOfOrigin: selected.countryOfOrigin || '',
      siteUrl: selected.siteUrl || '',
      updatedAt: Date.now()
    };

    list.push(item);
    selected = null;
    closeModal();
    persist();
    window.toast?.('Anime añadido a OneBase.');
  }

  function injectStyles() {
    if (document.getElementById('onebase-anilist-style')) return;
    const style = document.createElement('style');
    style.id = 'onebase-anilist-style';
    style.textContent = `
      #onebase-anilist-modal{position:fixed;inset:0;z-index:24000;display:none;place-items:center;padding:18px;background:rgba(0,0,0,.78);backdrop-filter:blur(12px)}
      #onebase-anilist-modal.open{display:grid}
      .ob-al-shell{width:min(1080px,96vw);max-height:min(88vh,900px);display:flex;flex-direction:column;overflow:hidden;border:1px solid #303030;border-radius:24px;background:#0d0d0f;color:#f5f5f5;box-shadow:0 35px 120px rgba(0,0,0,.7);animation:obAlIn .25s ease both}
      @keyframes obAlIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
      .ob-al-head{padding:22px 24px 16px;border-bottom:1px solid #222;display:flex;align-items:flex-start;justify-content:space-between;gap:18px}
      .ob-al-title{font-size:23px;font-weight:900;letter-spacing:-.7px}.ob-al-kicker{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#777;margin-bottom:6px}
      .ob-al-close{width:34px;height:34px;border:1px solid #333;border-radius:10px;background:#161616;color:#aaa;font-size:18px;cursor:pointer}.ob-al-close:hover{color:#fff;background:#222}
      .ob-al-search{padding:15px 24px;border-bottom:1px solid #222;display:flex;gap:9px}.ob-al-input{min-width:0;flex:1;border:1px solid #333;border-radius:12px;background:#151515;color:#fff;padding:13px 14px;outline:none;font-size:13px}.ob-al-input:focus{border-color:#777;box-shadow:0 0 0 3px rgba(255,255,255,.04)}
      .ob-al-search button,.ob-al-primary{border:1px solid #eee;background:#eee;color:#090909;border-radius:12px;padding:0 17px;font-weight:900;cursor:pointer}.ob-al-search button:disabled,.ob-al-primary:disabled{opacity:.45;cursor:default}
      .ob-al-body{overflow:auto;min-height:0;padding:18px 24px 24px}.ob-al-state{min-height:220px;display:grid;place-items:center;color:#777;font-size:12px;text-align:center}
      .ob-al-results{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.ob-al-card{min-width:0;border:1px solid #292929;border-radius:16px;background:#141416;overflow:hidden;cursor:pointer;transition:.2s ease}.ob-al-card:hover{transform:translateY(-3px);border-color:#666;box-shadow:0 14px 35px rgba(0,0,0,.35)}
      .ob-al-card-cover{height:250px;background:#202020;position:relative;overflow:hidden}.ob-al-card-cover img{width:100%;height:100%;object-fit:cover;display:block}.ob-al-no-cover{height:100%;display:grid;place-items:center;color:#666;font-size:11px}.ob-al-score{position:absolute;right:9px;top:9px;padding:5px 7px;border-radius:8px;background:rgba(0,0,0,.78);font-size:10px;font-weight:900}
      .ob-al-card-body{padding:12px}.ob-al-card-title{font-size:13px;font-weight:850;line-height:1.25;min-height:33px}.ob-al-alt{margin-top:4px;color:#6f6f6f;font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ob-al-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:10px}.ob-al-chip{padding:4px 7px;border:1px solid #292929;border-radius:999px;color:#999;background:#191919;font-size:8px;font-weight:800;letter-spacing:.3px}.ob-al-pages{display:flex;justify-content:center;gap:8px;margin-top:16px}.ob-al-page{border:1px solid #333;background:#151515;color:#aaa;border-radius:9px;padding:8px 11px;cursor:pointer}.ob-al-page:disabled{opacity:.35;cursor:default}
      .ob-al-detail{display:grid;grid-template-columns:220px minmax(0,1fr);gap:22px}.ob-al-detail-cover{height:320px;border-radius:16px;overflow:hidden;background:#202020}.ob-al-detail-cover img{width:100%;height:100%;object-fit:cover}.ob-al-detail-main{min-width:0}.ob-al-detail-title{font-size:28px;line-height:1.05;font-weight:950;letter-spacing:-1px}.ob-al-detail-alt{margin-top:8px;color:#777;font-size:11px;line-height:1.5}.ob-al-detail-chips{display:flex;flex-wrap:wrap;gap:6px;margin:15px 0}.ob-al-description{color:#aaa;font-size:11px;line-height:1.65;max-height:145px;overflow:auto}.ob-al-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:15px}.ob-al-info{border:1px solid #252525;border-radius:10px;padding:9px;background:#121214}.ob-al-info b{display:block;color:#666;font-size:8px;text-transform:uppercase;letter-spacing:1px;margin-bottom:3px}.ob-al-info span{font-size:10px;color:#ddd}.ob-al-genres{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}.ob-al-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}.ob-al-secondary{border:1px solid #333;background:#171717;color:#aaa;border-radius:11px;padding:10px 14px;font-weight:800;cursor:pointer}.ob-al-secondary:hover{color:#fff;background:#222}
      .ob-al-add{margin-left:auto}.ob-al-existing{border-color:#66551e;background:#201d12;color:#d9bb54}
      @media(max-width:800px){.ob-al-results{grid-template-columns:repeat(2,minmax(0,1fr))}.ob-al-card-cover{height:220px}.ob-al-detail{grid-template-columns:140px minmax(0,1fr)}.ob-al-detail-cover{height:220px}.ob-al-detail-title{font-size:22px}}
      @media(max-width:560px){#onebase-anilist-modal{padding:8px}.ob-al-shell{max-height:94vh;border-radius:18px}.ob-al-head,.ob-al-search,.ob-al-body{padding-left:14px;padding-right:14px}.ob-al-search{flex-direction:column}.ob-al-search button{height:42px}.ob-al-results{grid-template-columns:1fr 1fr;gap:8px}.ob-al-card-cover{height:185px}.ob-al-detail{grid-template-columns:1fr}.ob-al-detail-cover{height:300px}.ob-al-grid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'onebase-anilist-modal';
    modal.innerHTML = `
      <div class="ob-al-shell" role="dialog" aria-modal="true" aria-label="Buscar anime">
        <div class="ob-al-head"><div><div class="ob-al-kicker">ONEBASE · ANIME DATABASE</div><div class="ob-al-title">Añadir anime</div></div><button class="ob-al-close" type="button" aria-label="Cerrar">×</button></div>
        <div class="ob-al-search"><input class="ob-al-input" autocomplete="off" placeholder="Busca por título, nombre japonés o nombre alternativo…" maxlength="120"><button type="button" class="ob-al-go">Buscar</button></div>
        <div class="ob-al-body"><div class="ob-al-state">Escribe al menos 2 caracteres para buscar.</div></div>
      </div>`;
    document.body.appendChild(modal);
    const input = modal.querySelector('.ob-al-input');
    modal.querySelector('.ob-al-close').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    modal.querySelector('.ob-al-go').addEventListener('click', () => runSearch(input.value.trim(), 1));
    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (q.length < 2) { requestSerial++; renderState('Escribe al menos 2 caracteres para buscar.'); return; }
      renderState('Buscando en AniList…');
      searchTimer = setTimeout(() => runSearch(q, 1), 320);
    });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); runSearch(input.value.trim(), 1); } if (e.key === 'Escape') closeModal(); });
    return modal;
  }

  function renderState(message) {
    const body = modal?.querySelector('.ob-al-body');
    if (body) body.innerHTML = `<div class="ob-al-state">${esc(message)}</div>`;
  }

  async function runSearch(query, page) {
    if (!modal || query.length < 2) return;
    const serial = ++requestSerial;
    const body = modal.querySelector('.ob-al-body');
    const go = modal.querySelector('.ob-al-go');
    if (go) { go.disabled = true; go.textContent = '…'; }
    body.innerHTML = `<div class="ob-al-state">Buscando <b>${esc(query)}</b>…</div>`;
    try {
      const response = await fetch(`/api/anilist-search?q=${encodeURIComponent(query)}&page=${page}&perPage=12`, { headers: { accept: 'application/json' }, cache: 'no-store' });
      const payload = await response.json().catch(() => null);
      if (serial !== requestSerial) return;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'No se pudo completar la búsqueda.');
      renderResults(payload.results || [], payload.pageInfo || {}, query);
    } catch (error) {
      if (serial !== requestSerial) return;
      body.innerHTML = `<div class="ob-al-state"><div><div style="color:#fff;font-weight:800;margin-bottom:6px">No se pudo buscar</div><div>${esc(error?.message || 'Error desconocido.')}</div><button type="button" class="ob-al-secondary" data-retry style="margin-top:14px">↻ Reintentar</button></div></div>`;
      body.querySelector('[data-retry]')?.addEventListener('click', () => runSearch(query, page));
    } finally {
      if (go) { go.disabled = false; go.textContent = 'Buscar'; }
    }
  }

  function renderResults(results, pageInfo, query) {
    const body = modal.querySelector('.ob-al-body');
    if (!results.length) { body.innerHTML = `<div class="ob-al-state"><div>No hemos encontrado anime para <b>${esc(query)}</b>.<br><span style="color:#555">Prueba con el título original o un nombre alternativo.</span></div></div>`; return; }
    body.innerHTML = `<div class="ob-al-results">${results.map((m, i) => {
      const cover = coverOf(m);
      const alt = altTitleOf(m)[0] || '';
      const score = Number(m.averageScore || 0);
      const existing = isDuplicate(m);
      return `<button type="button" class="ob-al-card ${existing ? 'ob-al-existing' : ''}" data-result="${i}" style="padding:0;text-align:left;color:inherit">
        <div class="ob-al-card-cover">${cover ? `<img src="${esc(cover)}" alt="" loading="lazy">` : '<div class="ob-al-no-cover">SIN PORTADA</div>'}${score ? `<span class="ob-al-score">★ ${score}%</span>` : ''}</div>
        <div class="ob-al-card-body"><div class="ob-al-card-title">${esc(titleOf(m))}</div>${alt ? `<div class="ob-al-alt">${esc(alt)}</div>` : ''}<div class="ob-al-meta"><span class="ob-al-chip">${esc(formatOf(m))}</span>${m.seasonYear ? `<span class="ob-al-chip">${esc(m.seasonYear)}</span>` : ''}${m.episodes ? `<span class="ob-al-chip">${esc(m.episodes)} EP</span>` : ''}${existing ? '<span class="ob-al-chip">YA AÑADIDO</span>' : ''}</div></div>
      </button>`;
    }).join('')}</div>
      <div class="ob-al-pages"><button class="ob-al-page" type="button" data-page-prev ${Number(pageInfo.currentPage || 1) <= 1 ? 'disabled' : ''}>← Anterior</button><span class="ob-al-page" style="cursor:default">Página ${Number(pageInfo.currentPage || 1)}</span><button class="ob-al-page" type="button" data-page-next ${pageInfo.hasNextPage ? '' : 'disabled'}>Siguiente →</button></div>`;
    body.querySelectorAll('[data-result]').forEach((el) => el.addEventListener('click', () => selectResult(results[Number(el.dataset.result)])));
    body.querySelector('[data-page-prev]')?.addEventListener('click', () => runSearch(query, Math.max(1, Number(pageInfo.currentPage || 1) - 1)));
    body.querySelector('[data-page-next]')?.addEventListener('click', () => runSearch(query, Number(pageInfo.currentPage || 1) + 1));
  }

  function selectResult(media) {
    selected = media;
    const body = modal.querySelector('.ob-al-body');
    const cover = coverOf(media);
    const alt = altTitleOf(media).join(' · ');
    const description = text(media.description || 'Sin descripción disponible.');
    const genres = Array.isArray(media.genres) ? media.genres : [];
    const duplicate = isDuplicate(media);
    body.innerHTML = `<div class="ob-al-detail">
      <div class="ob-al-detail-cover">${cover ? `<img src="${esc(cover)}" alt="${esc(titleOf(media))}">` : '<div class="ob-al-no-cover">SIN PORTADA</div>'}</div>
      <div class="ob-al-detail-main"><div class="ob-al-detail-title">${esc(titleOf(media))}</div>${alt ? `<div class="ob-al-detail-alt">${esc(alt)}</div>` : ''}
      <div class="ob-al-detail-chips"><span class="ob-al-chip">${esc(formatOf(media))}</span><span class="ob-al-chip">${esc(statusOf(media))}</span>${media.seasonYear ? `<span class="ob-al-chip">${esc(media.seasonYear)}</span>` : ''}${media.episodes ? `<span class="ob-al-chip">${esc(media.episodes)} episodios</span>` : ''}${media.averageScore ? `<span class="ob-al-chip">★ ${esc(media.averageScore)}%</span>` : ''}</div>
      <div class="ob-al-description">${esc(description)}</div>
      <div class="ob-al-grid"><div class="ob-al-info"><b>Origen</b><span>${esc(sourceOf(media))}</span></div><div class="ob-al-info"><b>Duración</b><span>${media.duration ? `${esc(media.duration)} min/ep` : '—'}</span></div><div class="ob-al-info"><b>Popularidad</b><span>${media.popularity ? esc(Number(media.popularity).toLocaleString('es-ES')) : '—'}</span></div><div class="ob-al-info"><b>Favoritos</b><span>${media.favourites ? esc(Number(media.favourites).toLocaleString('es-ES')) : '—'}</span></div></div>
      ${genres.length ? `<div class="ob-al-genres">${genres.map(g => `<span class="ob-al-chip">${esc(g)}</span>`).join('')}</div>` : ''}
      <div class="ob-al-actions"><button type="button" class="ob-al-secondary" data-back>← Volver a resultados</button>${media.siteUrl ? `<button type="button" class="ob-al-secondary" data-anilist>Ver en AniList</button>` : ''}<button type="button" class="ob-al-primary ob-al-add" data-add ${duplicate ? 'disabled' : ''}>${duplicate ? 'Ya está en tu lista' : '＋ Añadir a OneBase'}</button></div>
      </div></div>`;
    body.querySelector('[data-back]')?.addEventListener('click', () => runSearch(modal.querySelector('.ob-al-input').value.trim(), 1));
    body.querySelector('[data-anilist]')?.addEventListener('click', () => window.open(media.siteUrl, '_blank', 'noopener,noreferrer'));
    body.querySelector('[data-add]')?.addEventListener('click', addSelected);
  }

  function openModal() {
    ensureModal();
    selected = null;
    modal.classList.add('open');
    const input = modal.querySelector('.ob-al-input');
    input.value = '';
    renderState('Escribe al menos 2 caracteres para buscar.');
    setTimeout(() => input.focus(), 30);
  }

  function closeModal() {
    requestSerial++;
    clearTimeout(searchTimer);
    selected = null;
    modal?.classList.remove('open');
  }

  function looksLikeAddButton(button) {
    const value = text(button?.textContent).toLowerCase();
    return /^(\+\s*)?(añadir|agregar|nuevo)(\s+anime)?$/.test(value) || /añadir anime|nuevo anime/.test(value);
  }

  function wireExistingButton() {
    const buttons = [...document.querySelectorAll('button, a')].filter(looksLikeAddButton);
    buttons.slice(0, 3).forEach((button) => {
      if (button.dataset.onebaseAniListBound === VERSION) return;
      button.dataset.onebaseAniListBound = VERSION;
      button.addEventListener('click', (event) => {
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation(); openModal();
      }, true);
    });
    return buttons.length > 0;
  }

  function injectButton() {
    if (document.getElementById('onebase-anilist-add-btn') || wireExistingButton()) return;
    const target = document.querySelector('.controls') || document.querySelector('.toolbar') || document.querySelector('header');
    if (!target) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'onebase-anilist-add-btn';
    button.className = 'btn';
    button.textContent = '＋ Añadir anime';
    button.title = 'Buscar anime en AniList y añadirlo a tu lista';
    button.addEventListener('click', openModal);
    target.appendChild(button);
  }

  function boot() {
    if (booted) return;
    booted = true;
    injectStyles();
    ensureModal();
    injectButton();
    // The tracker can rebuild its header after cloud restoration.
    const observer = new MutationObserver(() => { if (!document.getElementById('onebase-anilist-add-btn')) injectButton(); });
    observer.observe(document.body, { childList: true, subtree: true });
    window.OneBaseAniListSearch = { open: openModal, close: closeModal, search: runSearch };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else setTimeout(boot, 0);
})();
