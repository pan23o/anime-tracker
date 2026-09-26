/* AnimeTracker persistence engine v8
 * Primary library persistence: Supabase Storage -> one TXT file per user.
 * Local IndexedDB/localStorage are emergency mirrors only.
 */
(function () {
  'use strict';

  const SUPABASE_URL = 'https://djfjqecahztogacliavh.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
  const LIB = 'anime_tracker_v6';
  const META = 'anime_tracker_persistence_v2';
  const PROFILE = 'anime_tracker_profile_v1';
  const STORAGE_BUCKET = 'anime-libraries';
  const FILE_NAME = 'library.txt';

  const $ = id => document.getElementById(id);
  const now = () => Date.now();
  const parse = (s, fallback) => { try { return JSON.parse(s); } catch { return fallback; } };
  const toast = m => window.toast ? window.toast(m) : console.info('[AnimeTracker]', m);
  const client = window.supabase?.createClient?.(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  if (!client) { console.error('[AnimeTracker] Supabase client unavailable'); return; }

  let user = null, bootPromise = null, saveTimer = null, profileTimer = null;
  let saving = false, queuedSave = false, bound = false, lastFingerprint = '';
  window.OneBaseLibrarySync = { status: 'pending', lastSavedAt: null };

  function getMeta() { return parse(localStorage.getItem(META) || '{}', {}) || {}; }
  function setMeta(value) { try { localStorage.setItem(META, JSON.stringify(value)); } catch {} }
  function ensureMeta() {
    const m = getMeta();
    if (!m.deviceId) m.deviceId = crypto.randomUUID ? crypto.randomUUID() : `${Math.random()}-${now()}`;
    if (!Number.isFinite(m.revision)) m.revision = 0;
    if (!('owner' in m)) m.owner = '';
    setMeta(m); return m;
  }

  function normalizeItem(item) {
    try { if (typeof window.normalizeItem === 'function') return window.normalizeItem(item); } catch {}
    return { ...item, anime: String(item?.anime || '').trim(), favorite: Boolean(item?.favorite), addedAt: Number(item?.addedAt) || now(), updatedAt: Number(item?.updatedAt) || Number(item?.addedAt) || now() };
  }
  function clean(list) { return Array.isArray(list) ? list.filter(x => x && typeof x === 'object' && String(x.anime || '').trim()).map(normalizeItem) : []; }
  function localList() {
    // The live library is authoritative after edits; localStorage is its durable mirror.
    try { if (Array.isArray(window.__ONEBASE_DATA__)) return clean(window.__ONEBASE_DATA__); } catch {}
    return clean(parse(localStorage.getItem(LIB) || '[]', []));
  }
  function keyOf(item) { const id = item?.aniId || item?.anilistId || item?.malId; return id ? `id:${id}` : `title:${String(item?.anime || '').trim().toLowerCase()}`; }
  function mergeLatest(remote, local) {
    const items = new Map();
    for (const item of clean(remote)) items.set(keyOf(item), item);
    for (const item of clean(local)) {
      const key = keyOf(item), previous = items.get(key);
      if (!previous || (Number(item.updatedAt) || Number(item.addedAt) || 0) >= (Number(previous.updatedAt) || Number(previous.addedAt) || 0)) items.set(key, item);
    }
    return [...items.values()];
  }
  function fingerprint(list) { try { return JSON.stringify(clean(list)); } catch { return ''; } }

  function setLocalList(list, render = true) {
    const cleanList = clean(list);
    try { localStorage.setItem(LIB, JSON.stringify(cleanList)); } catch (e) { console.error('[AnimeTracker] local library write failed', e); }
    try {
      if (typeof data !== 'undefined') data = cleanList.map(normalizeItem);
      if (render && typeof window.render === 'function') window.render();
    } catch (e) { console.warn('[AnimeTracker] render after restore failed', e); }
    lastFingerprint = fingerprint(cleanList);
    window.dispatchEvent(new CustomEvent('animetracker:restored', { detail: { source: 'account-file', count: cleanList.length } }));
    return true;
  }

  function encodeLibrary(list) {
    const items = clean(list);
    return ['# AnimeTracker library v1', `# user=${user?.id || 'guest'}`, `# updated=${new Date().toISOString()}`, ...items.map(item => JSON.stringify(item))].join('\n') + '\n';
  }
  function decodeLibrary(text) {
    if (!text || typeof text !== 'string') return [];
    const result = [];
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      try { const item = JSON.parse(trimmed); if (item && typeof item === 'object' && String(item.anime || '').trim()) result.push(item); } catch {}
    }
    return clean(result);
  }
  function accountFilePath(uid = user?.id) { return uid ? `${uid}/${FILE_NAME}` : null; }

  async function downloadAccountFile(uid = user?.id) {
    if (!uid) return null;
    try {
      const { data, error } = await client.storage.from(STORAGE_BUCKET).download(accountFilePath(uid));
      if (error) { if (/not found|object not found|404/i.test(error.message || '')) return null; throw error; }
      return decodeLibrary(await data.text());
    } catch (e) { console.warn('[AnimeTracker] account TXT download failed:', e); return null; }
  }

  async function uploadAccountFile(list) {
    if (!user) return false;
    try {
      const body = new Blob([encodeLibrary(list)], { type: 'text/plain;charset=utf-8' });
      const { error } = await client.storage.from(STORAGE_BUCKET).upload(accountFilePath(), body, { upsert: true, contentType: 'text/plain;charset=utf-8', cacheControl: '0' });
      if (error) throw error;
      const m = ensureMeta();
      setMeta({ ...m, owner: `account:${user.id}`, revision: Number(m.revision || 0) + 1, savedAt: now() });
      return true;
    } catch (e) { console.error('[AnimeTracker] account TXT upload failed:', e); return false; }
  }

  async function saveEmergencyMirror(list) {
    const key = user ? `account:${user.id}` : 'guest', record = { key, updatedAt: now(), library: clean(list) };
    try { localStorage.setItem(`anime_tracker_vault_mirror_v1:${key}`, JSON.stringify(record)); } catch {}
    try {
      const request = indexedDB.open('AnimeTrackerVault_v2', 1);
      await new Promise((resolve, reject) => {
        request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains('states')) request.result.createObjectStore('states', { keyPath: 'key' }); };
        request.onsuccess = () => { const db = request.result, tx = db.transaction('states', 'readwrite'); tx.objectStore('states').put(record); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); };
        request.onerror = () => reject(request.error);
      });
    } catch {}
  }
  async function loadEmergencyMirror() {
    const key = user ? `account:${user.id}` : 'guest';
    try { const value = parse(localStorage.getItem(`anime_tracker_vault_mirror_v1:${key}`) || 'null', null); if (value?.library?.length) return clean(value.library); } catch {}
    return [];
  }

  async function saveCloudTable(list) {
    if (!user) return false;
    try {
      const { data: remote, error: readError } = await client.from('tracker_state').select('state,revision,checksum,device_id,saved_at,updated_at').eq('user_id', user.id).maybeSingle();
      if (readError) throw readError;
      const base = remote?.state && typeof remote.state === 'object' ? remote.state : {}, serialized = JSON.stringify(clean(list));
      if (String(base[LIB] || '') === serialized) return true;
      const m = ensureMeta(), revision = Math.max(Number(remote?.revision) || 0, Number(m.revision) || 0) + 1, stamp = now(), state = { ...base, [LIB]: serialized };
      const { error } = await client.from('tracker_state').upsert({ user_id: user.id, state, revision, checksum: `${serialized.length}:${revision}`, device_id: m.deviceId, saved_at: new Date(stamp).toISOString(), updated_at: new Date(stamp).toISOString() }, { onConflict: 'user_id' });
      if (error) throw error;
      setMeta({ ...m, owner: `account:${user.id}`, revision, savedAt: stamp }); return true;
    } catch (e) { console.warn('[AnimeTracker] tracker_state fallback failed:', e); return false; }
  }

  async function saveLibraryNow() {
    if (!user) { await saveEmergencyMirror(localList()); return true; }
    if (saving) { queuedSave = true; return false; }
    saving = true;
    try {
      const current = localList();

      // The database row is the authoritative cloud copy for progress. The TXT file
      // remains a portable mirror, but a failure in Storage must never make a
      // successful progress update look like it was lost.
      const tableSaved = await saveCloudTable(current);
      const fileSaved = await uploadAccountFile(current);
      await saveEmergencyMirror(current);

      const ok = tableSaved || fileSaved;
      window.OneBaseLibrarySync = {
        status: ok ? 'saved' : 'failed',
        lastSavedAt: ok ? now() : null,
        cloudTable: tableSaved,
        storageFile: fileSaved
      };
      if (!ok) toast('⚠️ No se pudo guardar la biblioteca en la nube.');
      return ok;
    } finally {
      saving = false;
      if (queuedSave) { queuedSave = false; void saveLibraryNow(); }
    }
  }

  // Explicit progress persistence endpoint used by the chapter counter.
  // It bypasses the polling interval and makes chapter changes durable as soon
  // as the input event fires.
  async function saveProgressNow() {
    if (!user) {
      await saveEmergencyMirror(localList());
      return true;
    }
    return saveLibraryNow();
  }
  function scheduleLibrarySave() { clearTimeout(saveTimer); saveEmergencyMirror(localList()); if (user) saveTimer = setTimeout(() => void saveLibraryNow(), 500); }

  async function restoreAccountLibrary() {
    if (!user) return false;

    // Restore from both cloud copies. The old implementation preferred the TXT
    // file whenever it existed, which could resurrect an older chapter counter
    // even when tracker_state already contained a newer progress update.
    let fileList = [];
    let tableList = [];
    try { fileList = (await downloadAccountFile(user.id)) || []; } catch (_) {}
    try {
      const { data, error } = await client.from('tracker_state')
        .select('state,revision,saved_at,updated_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!error) tableList = clean(parse(data?.state?.[LIB] || '[]', []));
    } catch (e) {
      console.warn('[AnimeTracker] tracker_state restore failed:', e);
    }

    if (fileList.length || tableList.length) {
      const merged = mergeLatest(fileList, tableList);
      const local = localList();
      const finalList = mergeLatest(merged, local);
      setLocalList(finalList);
      await saveEmergencyMirror(finalList);

      // Heal whichever cloud copy is behind. This is deliberately fire-and-forget
      // after the browser has the newest local state.
      if (fingerprint(finalList) !== fingerprint(fileList) || fingerprint(finalList) !== fingerprint(tableList)) {
        void saveLibraryNow();
      }
      return true;
    }
    const emergency = await loadEmergencyMirror();
    if (emergency.length) { const merged = mergeLatest(emergency, localList()); setLocalList(merged); await uploadAccountFile(merged); return true; }
    return false;
  }

  async function getUser() { try { const { data, error } = await client.auth.getUser(); if (error) return null; return data?.user || null; } catch { return null; } }
  function profileLocal() { return parse(localStorage.getItem(PROFILE) || '{}', {}) || {}; }
  function initials(name) { return String(name || 'Usuario').trim().split(/\s+/).slice(0, 2).map(x => x[0] || '').join('').toUpperCase() || 'AT'; }
  function normalizeProfile(p) { return { name: String(p?.name || 'Usuario').trim().slice(0, 32) || 'Usuario', email: String(user?.email || p?.email || '').trim().slice(0, 120), avatar: String(p?.avatar || ''), createdAt: Number(p?.createdAt) || now() }; }
  function updateProfileDom(p) {
    if ($('profileName')) $('profileName').value = p.name || 'Usuario'; if ($('profileEmail')) $('profileEmail').value = p.email || ''; if ($('profileDisplayName')) $('profileDisplayName').textContent = p.name || 'Usuario'; if ($('profileEmailDisplay')) $('profileEmailDisplay').textContent = p.email || 'Sin correo configurado';
    for (const id of ['profileAvatar', 'profileTopBtn']) { const el = $(id); if (!el) continue; el.innerHTML = p.avatar ? `<img src="${p.avatar}" alt="Foto de perfil">` : initials(p.name); }
  }
  function updateAccountUi() {
    const btn = $('cloudAccountBtn'), menu = $('cloudUserMenu'), sync = $('cloudSyncBtn'), logoutBtn = $('cloudLogoutBtn'), status = $('cloudStatus'), p = profileLocal();
    if (user) {
      if (btn) { btn.textContent = '👤'; btn.dataset.atSession = '1'; btn.title = `Cuenta conectada: ${user.email || ''}`; }
      if (menu) { menu.querySelector('.at-local-state')?.remove(); let head = menu.querySelector('.at-account-head'); if (!head) { head = document.createElement('div'); head.className = 'at-account-head'; menu.prepend(head); } head.innerHTML = '<div class="at-account-state">● SESIÓN INICIADA</div><div class="at-account-name"></div><div class="at-account-email"></div>'; head.querySelector('.at-account-name').textContent = p.name || 'Cuenta'; head.querySelector('.at-account-email').textContent = user.email || p.email || ''; }
      if (sync) sync.style.display = ''; if (logoutBtn) logoutBtn.style.display = ''; if (status) status.textContent = `✓ Sesión iniciada${p.name ? ` como ${p.name}` : ''}`; document.documentElement.dataset.atSession = '1';
    } else {
      if (btn) { btn.textContent = '☁️'; delete btn.dataset.atSession; btn.title = 'Modo local · abrir cuenta'; }
      if (menu) { menu.querySelector('.at-account-head')?.remove(); let local = menu.querySelector('.at-local-state'); if (!local) { local = document.createElement('div'); local.className = 'at-local-state'; menu.prepend(local); } local.textContent = '● MODO LOCAL · no has iniciado sesión'; }
      if (sync) sync.style.display = 'none'; if (logoutBtn) logoutBtn.style.display = 'none'; if (status) status.textContent = 'Modo local. Pulsa la nube para iniciar sesión.'; delete document.documentElement.dataset.atSession;
    }
  }
  function injectUiStyle() {
    if ($('atAccountUiStyle')) return;
    const style = document.createElement('style');
    style.id = 'atAccountUiStyle';
    style.textContent = `
      .cloud-account-btn{z-index:10020!important}
      .cloud-account-btn[data-at-session="1"]{border-color:rgba(103,223,138,.55)!important;box-shadow:0 0 0 2px rgba(103,223,138,.18),0 0 26px rgba(103,223,138,.10)!important}
      .cloud-user-menu{z-index:10021!important;min-width:290px!important}
      .cloud-user-menu.show{display:block!important}
      .at-account-head{padding:12px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}
      .at-account-state{font-size:10px;font-weight:900;color:#67df8a}
      .at-account-name{margin-top:5px;font-size:13px;font-weight:900}
      .at-account-email{margin-top:2px;font-size:10px;color:#777}
      .at-local-state{padding:10px;color:#aaa;font-size:10px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}
      .cloud-logout-busy{opacity:.6!important;pointer-events:none!important}

      .cloud-auth-overlay{position:fixed;inset:0;z-index:10050;background:radial-gradient(circle at 50% 15%,rgba(255,215,0,.11),transparent 38%),rgba(0,0,0,.82);display:none;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(16px)}
      .cloud-auth-overlay.show{display:flex;animation:onebaseAuthIn .22s ease both}
      .cloud-auth-card{position:relative;width:min(920px,100%);min-height:560px;overflow:hidden;background:linear-gradient(135deg,var(--panel),var(--panel2));border:1px solid rgba(255,255,255,.12);border-radius:28px;padding:0;box-shadow:0 30px 90px rgba(0,0,0,.55),0 0 70px rgba(255,215,0,.08);display:grid;grid-template-columns:42% 58%}
      .cloud-auth-hero{padding:48px;display:flex;flex-direction:column;justify-content:space-between;border-right:1px solid rgba(255,255,255,.08);background:radial-gradient(circle at 20% 20%,rgba(255,215,0,.12),transparent 42%)}
      .cloud-auth-logo{font-size:12px;font-weight:950;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
      .cloud-auth-hero h2{font-size:38px;line-height:1.02;margin:18px 0 12px;letter-spacing:-.04em}
      .cloud-auth-hero p{color:var(--muted);line-height:1.6;margin:0}
      .cloud-auth-features{display:grid;gap:12px;margin-top:28px}
      .cloud-auth-feature{display:flex;gap:11px;align-items:flex-start;color:var(--text);font-size:13px}
      .cloud-auth-feature b{display:block;margin-bottom:2px}
      .cloud-auth-feature span{color:var(--muted);font-size:11px}
      .cloud-auth-main{padding:48px 52px;display:flex;flex-direction:column;justify-content:center;position:relative}
      .cloud-auth-close{position:absolute;top:18px;right:18px;width:38px;height:38px;border-radius:50%;border:1px solid var(--line2);background:var(--panel2);color:var(--text);font-size:22px;cursor:pointer}
      .cloud-auth-main h3{font-size:25px;margin:0 0 7px}
      .cloud-auth-main .authSubtitle{color:var(--muted);font-size:13px;margin:0 0 24px}
      .cloud-auth-card label{display:block;font-size:11px;font-weight:800;color:var(--muted);margin:13px 0 6px;text-transform:uppercase;letter-spacing:.07em}
      .cloud-auth-card input{width:100%;margin:0;padding:14px 15px;border-radius:12px;border:1px solid var(--line2);background:var(--bg2);color:var(--text);outline:none;transition:.2s}
      .cloud-auth-card input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(255,215,0,.10)}
      .authPasswordWrap{position:relative}.authPasswordWrap input{padding-right:52px}.authPasswordToggle{position:absolute;right:8px;top:7px;width:38px;height:38px;border:0;background:transparent;color:var(--muted);cursor:pointer}
      .cloud-auth-actions{display:grid;grid-template-columns:1fr;gap:9px;margin-top:20px}
      .cloud-auth-actions button{width:100%;padding:14px;border-radius:12px;border:1px solid var(--line2);background:var(--accent);color:#080808;font-weight:950;cursor:pointer;transition:transform .18s,box-shadow .18s}
      .cloud-auth-actions button:hover{transform:translateY(-1px);box-shadow:0 8px 25px rgba(255,215,0,.18)}
      .cloud-auth-actions .secondary{background:var(--panel2);color:var(--text)}
      .auth-links{display:flex;justify-content:space-between;gap:10px;margin-top:14px}.auth-links button{border:0;background:none;color:var(--muted);cursor:pointer;font-size:11px}.auth-links button:hover{color:var(--accent)}
      .cloud-status{min-height:18px;font-size:12px;color:var(--muted);margin-top:15px;padding:9px 11px;border-radius:10px;background:rgba(255,255,255,.035)}
      .authTrust{display:flex;gap:8px;align-items:center;color:var(--muted);font-size:10px;margin-top:18px}.authTrust strong{color:var(--text)}
      @keyframes onebaseAuthIn{from{opacity:0;transform:scale(.985)}to{opacity:1;transform:none}}
      @media(max-width:760px){.cloud-auth-card{grid-template-columns:1fr;min-height:0}.cloud-auth-hero{display:none}.cloud-auth-main{padding:42px 28px}}
    `;
    document.head.appendChild(style);
  }
  function openAccountUi() { if (user) $('cloudUserMenu')?.classList.toggle('show'); else $('cloudAuthOverlay')?.classList.add('show'); }
  function bindUi() {
    if (bound) return; bound = true; injectUiStyle();
    $('cloudAccountBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openAccountUi(); });
    $('cloudClose')?.addEventListener('click', () => $('cloudAuthOverlay')?.classList.remove('show'));
    $('cloudCloseAlt')?.addEventListener('click', () => $('cloudAuthOverlay')?.classList.remove('show'));
    $('cloudAuthOverlay')?.addEventListener('click', e => { if (e.target === $('cloudAuthOverlay')) $('cloudAuthOverlay').classList.remove('show'); });
    $('authPasswordToggle')?.addEventListener('click', () => {
      const input = $('cloudPassword');
      if (!input) return;
      const showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      $('authPasswordToggle').textContent = showing ? '◉' : '◌';
      $('authPasswordToggle').setAttribute('aria-label', showing ? 'Mostrar contraseña' : 'Ocultar contraseña');
    });
    $('cloudPassword')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); void login(); } });
    $('cloudEmail')?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('cloudPassword')?.focus(); } });
    $('cloudSyncBtn')?.addEventListener('click', () => void saveLibraryNow()); $('cloudLogoutBtn')?.addEventListener('click', logout); $('cloudLogin')?.addEventListener('click', login); $('cloudRegister')?.addEventListener('click', register); $('cloudReset')?.addEventListener('click', resetPassword);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('cloudAuthOverlay')?.classList.remove('show'); $('cloudUserMenu')?.classList.remove('show'); } });
  }
  function authMessage(text) { if ($('cloudStatus')) $('cloudStatus').textContent = text; }
  async function login() { const email = String($('cloudEmail')?.value || '').trim(), password = String($('cloudPassword')?.value || ''); if (!email || !password) return authMessage('Escribe correo y contraseña.'); authMessage('Iniciando sesión…'); try { const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error; user = data?.user || null; $('cloudAuthOverlay')?.classList.remove('show'); await bootstrap(); updateAccountUi(); toast('✓ Sesión iniciada'); } catch (e) { console.error('[AnimeTracker] login', e); authMessage(e?.message || 'No se pudo iniciar sesión.'); } }
  function authRedirectUrl() {
    // Supabase uses this URL after confirming the email. On production this is
    // the real site origin; locally it remains localhost for local development.
    return window.location.origin + window.location.pathname;
  }
  function handleAuthCallback() {
    const hash = String(window.location.hash || '');
    if (!hash) return;
    const params = new URLSearchParams(hash.slice(1));
    const type = params.get('type');
    const accessToken = params.get('access_token');
    const errorDescription = params.get('error_description');
    if (errorDescription) {
      authMessage(decodeURIComponent(errorDescription.replace(/\+/g, ' ')));
      $('cloudAuthOverlay')?.classList.add('show');
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
      return;
    }
    if (type === 'signup' && accessToken) {
      history.replaceState(null, document.title, window.location.pathname + window.location.search);
      authMessage('✓ Correo verificado. Tu cuenta está activa y tu sesión se está preparando…');
      toast('✓ Correo verificado correctamente');
      setTimeout(() => { $('cloudAuthOverlay')?.classList.remove('show'); }, 900);
    }
  }
  async function register() { const name = String($('cloudName')?.value || '').trim().slice(0, 32) || 'Usuario', email = String($('cloudEmail')?.value || '').trim(), password = String($('cloudPassword')?.value || ''); if (!email || !password) return authMessage('Escribe correo y contraseña.'); if (password.length < 6) return authMessage('La contraseña debe tener al menos 6 caracteres.'); authMessage('Creando cuenta…'); try { const { data, error } = await client.auth.signUp({ email, password, options: { data: { username: name }, redirectTo: authRedirectUrl() } }); if (error) throw error; if (data?.user) { user = data.user; localStorage.setItem(PROFILE, JSON.stringify({ name, email, avatar: '', createdAt: now() })); if (data.session) { await bootstrap(); $('cloudAuthOverlay')?.classList.remove('show'); updateAccountUi(); toast('✓ Cuenta creada y sesión iniciada'); } else { authMessage('✓ Cuenta creada. Te hemos enviado un correo de verificación. Ábrelo y pulsa «Verificar correo» para activar tu cuenta.'); updateAccountUi(); } } } catch (e) { console.error('[AnimeTracker] register', e); authMessage(e?.message || 'No se pudo crear la cuenta.'); } }
  async function resetPassword() { const email = String($('cloudEmail')?.value || '').trim(); if (!email) return authMessage('Escribe tu correo para recuperar la contraseña.'); authMessage('Enviando correo…'); try { const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: authRedirectUrl() }); if (error) throw error; authMessage('✓ Revisa tu correo.'); } catch (e) { authMessage(e?.message || 'No se pudo enviar el correo.'); } }
  async function syncProfile() { if (!user) return; try { const local = profileLocal(), { data: cloud, error } = await client.from('profiles').select('username,avatar_data,created_at').eq('id', user.id).maybeSingle(); if (error) throw error; if (cloud) { const p = normalizeProfile({ name: cloud.username || 'Usuario', avatar: cloud.avatar_data || '', createdAt: Date.parse(cloud.created_at || '') || local.createdAt || now() }); localStorage.setItem(PROFILE, JSON.stringify(p)); updateProfileDom(p); } else { const p = normalizeProfile(local); localStorage.setItem(PROFILE, JSON.stringify(p)); updateProfileDom(p); await client.from('profiles').upsert({ id: user.id, username: p.name, avatar_data: p.avatar }, { onConflict: 'id' }); } } catch (e) { console.warn('[AnimeTracker] profile sync failed:', e); } }
  function scheduleProfileSync() { if (!user) return; clearTimeout(profileTimer); profileTimer = setTimeout(async () => { try { const p = normalizeProfile(profileLocal()); await client.from('profiles').upsert({ id: user.id, username: p.name, avatar_data: p.avatar, updated_at: new Date().toISOString() }, { onConflict: 'id' }); } catch (e) { console.warn('[AnimeTracker] profile save failed:', e); } }, 500); }
  async function logout(event) { event?.preventDefault?.(); const button = $('cloudLogoutBtn'); if (button) { button.disabled = true; button.classList.add('cloud-logout-busy'); button.textContent = 'Cerrando sesión…'; } try { const oldUser = user, current = localList(); if (oldUser) { await uploadAccountFile(current); await saveEmergencyMirror(current); await saveCloudTable(current); } user = null; setMeta({ ...ensureMeta(), owner: '' }); await saveEmergencyMirror(current); await client.auth.signOut(); $('cloudUserMenu')?.classList.remove('show'); updateAccountUi(); toast('✓ Sesión cerrada'); } catch (e) { console.error('[AnimeTracker] logout', e); toast('No se pudo cerrar la sesión.'); } finally { if (button) { button.disabled = false; button.classList.remove('cloud-logout-busy'); button.textContent = 'Cerrar sesión'; } } }

  async function bootstrap() { if (bootPromise) return bootPromise; bootPromise = (async () => { const found = await getUser(); if (!found) { user = null; ensureMeta(); updateAccountUi(); return; } user = found; updateAccountUi(); await new Promise(resolve => setTimeout(resolve, 150)); await restoreAccountLibrary(); await saveEmergencyMirror(localList()); await syncProfile(); lastFingerprint = fingerprint(localList()); updateAccountUi(); })(); try { return await bootPromise; } finally { bootPromise = null; } }

  function observe() {
    lastFingerprint = fingerprint(localList()); let lastDataFingerprint = '';
    setInterval(() => {
      let current = localList();
      try {
        if (typeof data !== 'undefined' && Array.isArray(data)) {
          const dataList = clean(data), dataFp = fingerprint(dataList);
          if (dataFp && dataFp !== lastDataFingerprint) { lastDataFingerprint = dataFp; if (fingerprint(current) !== dataFp) { setLocalList(dataList, false); current = dataList; } }
        }
      } catch {}
      const fp = fingerprint(current); if (fp !== lastFingerprint) { lastFingerprint = fp; scheduleLibrarySave(); }
      const profileRaw = localStorage.getItem(PROFILE) || ''; if (profileRaw) scheduleProfileSync();
    }, 250);
    window.addEventListener('animetracker:saved', scheduleLibrarySave);
    window.addEventListener('animetracker:progress-changed', () => { void saveProgressNow(); });
    try { if (typeof window.render === 'function' && !window.render.__animeTrackerWrapped) { const originalRender = window.render; const wrappedRender = function (...args) { const result = originalRender.apply(this, args); scheduleLibrarySave(); return result; }; wrappedRender.__animeTrackerWrapped = true; wrappedRender.__animeTrackerOriginal = originalRender; window.render = wrappedRender; } } catch {}
    window.addEventListener('beforeunload', () => { try { saveEmergencyMirror(localList()); } catch {} });
  }

  client.auth.onAuthStateChange((event, session) => { user = session?.user || null; updateAccountUi(); if (event === 'SIGNED_IN' && user) void bootstrap(); if (event === 'SIGNED_OUT') { user = null; updateAccountUi(); } });
  async function boot() { ensureMeta(); injectUiStyle(); bindUi(); handleAuthCallback(); updateAccountUi(); await bootstrap(); observe(); updateAccountUi(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot(), { once: true }); else void boot();
  window.AnimeTrackerCloud = { sync: () => user ? saveLibraryNow() : openAccountUi(), saveProgress: saveProgressNow, refresh: updateAccountUi, open: openAccountUi, logout };
})();
