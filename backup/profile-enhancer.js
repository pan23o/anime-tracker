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
    const stored = clean(parse(localStorage.getItem(LIB) || '[]', []));
    if (stored.length) return stored;
    try { if (typeof data !== 'undefined' && Array.isArray(data)) return clean(data); } catch {}
    return [];
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
      const fileSaved = await uploadAccountFile(current);
      await saveEmergencyMirror(current);
      await saveCloudTable(current);
      if (!fileSaved) toast('⚠️ No se pudo escribir el archivo de biblioteca.');
      return fileSaved;
    } finally { saving = false; if (queuedSave) { queuedSave = false; void saveLibraryNow(); } }
  }
  function scheduleLibrarySave() { clearTimeout(saveTimer); saveEmergencyMirror(localList()); if (user) saveTimer = setTimeout(() => void saveLibraryNow(), 500); }

  async function restoreAccountLibrary() {
    if (!user) return false;
    const fileList = await downloadAccountFile(user.id);
    if (fileList && fileList.length) { setLocalList(fileList); await saveEmergencyMirror(fileList); return true; }
    try {
      const { data, error } = await client.from('tracker_state').select('state,revision,saved_at,updated_at').eq('user_id', user.id).maybeSingle();
      if (!error) {
        const tableList = clean(parse(data?.state?.[LIB] || '[]', []));
        if (tableList.length) { setLocalList(tableList); await uploadAccountFile(tableList); await saveEmergencyMirror(tableList); return true; }
      }
    } catch (e) { console.warn('[AnimeTracker] tracker_state restore failed:', e); }
    const emergency = await loadEmergencyMirror();
    if (emergency.length) { setLocalList(emergency); await uploadAccountFile(emergency); return true; }
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
  function injectUiStyle() { if ($('atAccountUiStyle')) return; const style = document.createElement('style'); style.id = 'atAccountUiStyle'; style.textContent = '.cloud-account-btn{z-index:10020!important}.cloud-account-btn[data-at-session="1"]{border-color:rgba(103,223,138,.55)!important;box-shadow:0 0 0 2px rgba(103,223,138,.18),0 0 26px rgba(103,223,138,.10)!important}.cloud-user-menu{z-index:10021!important;min-width:270px!important}.cloud-user-menu.show{display:block!important}.at-account-head{padding:10px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}.at-account-state{font-size:10px;font-weight:900;color:#67df8a}.at-account-name{margin-top:5px;font-size:13px;font-weight:900}.at-account-email{margin-top:2px;font-size:10px;color:#777}.at-local-state{padding:10px;color:#aaa;font-size:10px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}.cloud-logout-busy{opacity:.6!important;pointer-events:none!important}'; document.head.appendChild(style); }
  function openAccountUi() { if (user) $('cloudUserMenu')?.classList.toggle('show'); else $('cloudAuthOverlay')?.classList.add('show'); }
  function bindUi() {
    if (bound) return; bound = true; injectUiStyle();
    $('cloudAccountBtn')?.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); openAccountUi(); });
    $('cloudClose')?.addEventListener('click', () => $('cloudAuthOverlay')?.classList.remove('show'));
    $('cloudAuthOverlay')?.addEventListener('click', e => { if (e.target === $('cloudAuthOverlay')) $('cloudAuthOverlay').classList.remove('show'); });
    $('cloudSyncBtn')?.addEventListener('click', () => void saveLibraryNow()); $('cloudLogoutBtn')?.addEventListener('click', logout); $('cloudLogin')?.addEventListener('click', login); $('cloudRegister')?.addEventListener('click', register); $('cloudReset')?.addEventListener('click', resetPassword);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') { $('cloudAuthOverlay')?.classList.remove('show'); $('cloudUserMenu')?.classList.remove('show'); } });
  }
  function authMessage(text) { if ($('cloudStatus')) $('cloudStatus').textContent = text; }
  async function login() { const email = String($('cloudEmail')?.value || '').trim(), password = String($('cloudPassword')?.value || ''); if (!email || !password) return authMessage('Escribe correo y contraseña.'); authMessage('Iniciando sesión…'); try { const { data, error } = await client.auth.signInWithPassword({ email, password }); if (error) throw error; user = data?.user || null; $('cloudAuthOverlay')?.classList.remove('show'); await bootstrap(); updateAccountUi(); toast('✓ Sesión iniciada'); } catch (e) { console.error('[AnimeTracker] login', e); authMessage(e?.message || 'No se pudo iniciar sesión.'); } }
  async function register() { const name = String($('cloudName')?.value || '').trim().slice(0, 32) || 'Usuario', email = String($('cloudEmail')?.value || '').trim(), password = String($('cloudPassword')?.value || ''); if (!email || !password) return authMessage('Escribe correo y contraseña.'); if (password.length < 6) return authMessage('La contraseña debe tener al menos 6 caracteres.'); authMessage('Creando cuenta…'); try { const { data, error } = await client.auth.signUp({ email, password, options: { data: { username: name } } }); if (error) throw error; if (data?.user) { user = data.user; localStorage.setItem(PROFILE, JSON.stringify({ name, email, avatar: '', createdAt: now() })); if (data.session) await bootstrap(); } $('cloudAuthOverlay')?.classList.remove('show'); updateAccountUi(); toast(data?.session ? '✓ Cuenta creada y sesión iniciada' : '✓ Cuenta creada. Revisa tu correo.'); } catch (e) { console.error('[AnimeTracker] register', e); authMessage(e?.message || 'No se pudo crear la cuenta.'); } }
  async function resetPassword() { const email = String($('cloudEmail')?.value || '').trim(); if (!email) return authMessage('Escribe tu correo para recuperar la contraseña.'); authMessage('Enviando correo…'); try { const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: location.href }); if (error) throw error; authMessage('✓ Revisa tu correo.'); } catch (e) { authMessage(e?.message || 'No se pudo enviar el correo.'); } }
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
    try { if (typeof window.render === 'function' && !window.render.__animeTrackerWrapped) { const originalRender = window.render; const wrappedRender = function (...args) { const result = originalRender.apply(this, args); scheduleLibrarySave(); return result; }; wrappedRender.__animeTrackerWrapped = true; wrappedRender.__animeTrackerOriginal = originalRender; window.render = wrappedRender; } } catch {}
    window.addEventListener('beforeunload', () => { try { saveEmergencyMirror(localList()); } catch {} });
  }

  client.auth.onAuthStateChange((event, session) => { user = session?.user || null; updateAccountUi(); if (event === 'SIGNED_IN' && user) void bootstrap(); if (event === 'SIGNED_OUT') { user = null; updateAccountUi(); } });
  async function boot() { ensureMeta(); injectUiStyle(); bindUi(); updateAccountUi(); await bootstrap(); observe(); updateAccountUi(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => void boot(), { once: true }); else void boot();
  window.AnimeTrackerCloud = { sync: () => user ? saveLibraryNow() : openAccountUi(), refresh: updateAccountUi, open: openAccountUi, logout };
})();
