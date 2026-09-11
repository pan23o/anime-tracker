/* OneBase real settings panel: themes + protection controls. */
(function () {
  'use strict';

  const SETTINGS_KEY = 'anime_tracker_settings_v1';
  const DEFAULT_SETTINGS = {
    confirmDelete: true,
    autoBackup: true,
    achievementPopups: true,
    episodeNotifications: false
  };

  function readSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULT_SETTINGS, ...(raw && typeof raw === 'object' ? raw : {}) };
    } catch (_) {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function writeSettings(patch) {
    const next = { ...readSettings(), ...patch };
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch (_) {}
    return next;
  }

  function injectStyles() {
    if (document.getElementById('onebase-settings-style')) return;
    const style = document.createElement('style');
    style.id = 'onebase-settings-style';
    style.textContent = `
      .onebase-theme-section { grid-column: 1 / -1; }
      .onebase-theme-row { display:grid; grid-template-columns:minmax(0,1fr) minmax(220px,320px); gap:14px; align-items:center; }
      .onebase-theme-copy strong { display:block; font-size:11px; color:var(--text); }
      .onebase-theme-copy span { display:block; margin-top:4px; color:var(--muted); font-size:9px; line-height:1.5; }
      .onebase-theme-control { display:flex; align-items:center; gap:8px; }
      .onebase-theme-control .select { width:100%; min-height:40px; }
      .onebase-theme-status { margin-top:9px; color:var(--muted); font-size:9px; }
      .onebase-protection-section .settingToggle { min-height:54px; }
      .onebase-protection-section .settingToggle small { max-width:430px; }
      .onebase-setting-switch { position:relative; flex:0 0 auto; width:44px; height:24px; }
      .onebase-setting-switch input { position:absolute; inset:0; width:1px; height:1px; opacity:0; }
      .onebase-setting-slider { position:absolute; inset:0; border:1px solid var(--line2); border-radius:999px; background:var(--soft); transition:.2s ease; cursor:pointer; }
      .onebase-setting-slider:before { content:""; position:absolute; width:18px; height:18px; left:2px; top:2px; border-radius:50%; background:var(--muted); transition:.2s ease; }
      .onebase-setting-switch input:checked + .onebase-setting-slider { background:color-mix(in srgb,var(--accent) 18%,var(--soft)); border-color:var(--accent); }
      .onebase-setting-switch input:checked + .onebase-setting-slider:before { transform:translateX(20px); background:var(--accent); }
      .onebase-setting-switch input:focus-visible + .onebase-setting-slider { outline:2px solid var(--accent); outline-offset:3px; }
      .onebase-notification-toggle { display:none !important; }
      @media(max-width:650px){ .onebase-theme-row { grid-template-columns:1fr; } .onebase-theme-control { width:100%; } }
    `;
    document.head.appendChild(style);
  }

  function makeSwitch(id, checked) {
    const wrap = document.createElement('label');
    wrap.className = 'onebase-setting-switch';
    wrap.innerHTML = `<input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><span class="onebase-setting-slider" aria-hidden="true"></span>`;
    return wrap;
  }

  function addThemeSection() {
    const grid = document.querySelector('#settingsModal .settingsGrid');
    const existing = document.getElementById('onebaseThemeSection');
    const select = document.getElementById('themeSelect');
    if (!grid || !select) return;

    if (!existing) {
      const section = document.createElement('section');
      section.className = 'settingsSection full onebase-theme-section';
      section.id = 'onebaseThemeSection';
      section.innerHTML = `
        <h3>🎨 Apariencia</h3>
        <div class="onebase-theme-row">
          <div class="onebase-theme-copy">
            <strong>Tema de OneBase</strong>
            <span>Elige uno de los temas actuales. El cambio se aplica al instante y queda guardado en este navegador.</span>
            <div class="onebase-theme-status" id="onebaseThemeStatus"></div>
          </div>
          <div class="onebase-theme-control" id="onebaseThemeControl"></div>
        </div>`;
      grid.insertBefore(section, grid.firstElementChild);
    }

    const control = document.getElementById('onebaseThemeControl');
    if (control && select.parentElement !== control) control.appendChild(select);
    select.removeAttribute('aria-label');
    select.setAttribute('aria-label', 'Tema de OneBase');
    select.classList.add('onebase-settings-theme-select');
    select.title = 'Cambiar tema';

    const status = document.getElementById('onebaseThemeStatus');
    if (status) {
      const labels = {
        'high-black': 'Alto contraste · Negro',
        'high-white': 'Alto contraste · Blanco',
        manga: 'Manga',
        ink: 'Tinta',
        custom: 'Personalizado'
      };
      status.textContent = `Tema activo: ${labels[select.value] || select.value}`;
    }
    if (!select.dataset.onebaseSettingsBound) {
      select.dataset.onebaseSettingsBound = '1';
      select.addEventListener('change', () => {
        const statusEl = document.getElementById('onebaseThemeStatus');
        const labels = { 'high-black':'Alto contraste · Negro', 'high-white':'Alto contraste · Blanco', manga:'Manga', ink:'Tinta', custom:'Personalizado' };
        if (statusEl) statusEl.textContent = `Tema activo: ${labels[select.value] || select.value}`;
      });
    }
  }

  function addEpisodeNotificationSetting() {
    const protection = [...document.querySelectorAll('#settingsModal .settingsSection')].find(section => section.querySelector('h3')?.textContent?.includes('Protección'));
    if (!protection) return;
    protection.classList.add('onebase-protection-section');
    const existing = document.getElementById('settingEpisodeNotifications');
    if (existing) return;

    const row = document.createElement('label');
    row.className = 'settingToggle';
    row.innerHTML = `<span>Enviar notificaciones de nuevos episodios<small>Recibe un aviso cuando OneBase detecte que un anime tiene un episodio nuevo, incluso si la web está cerrada.</small></span>`;
    row.appendChild(makeSwitch('settingEpisodeNotifications', false));
    protection.appendChild(row);

    const input = document.getElementById('settingEpisodeNotifications');
    input.addEventListener('change', async () => {
      if (input.checked) {
        try {
          if (!window.OneBaseEpisodeNotifications?.enablePush) throw new Error('El sistema de notificaciones todavía no está disponible.');
          await window.OneBaseEpisodeNotifications.enablePush();
          writeSettings({ episodeNotifications: true });
          if (window.toast) window.toast('✓ Notificaciones de nuevos episodios activadas.');
        } catch (error) {
          input.checked = false;
          writeSettings({ episodeNotifications: false });
          if (window.toast) window.toast(`⚠️ ${error?.message || 'No se pudieron activar las notificaciones.'}`);
          else console.warn('[ONEBASE] Notification setting:', error);
        }
      } else {
        try { await window.OneBaseEpisodeNotifications?.disablePush?.(); } catch (_) {}
        writeSettings({ episodeNotifications: false });
        if (window.toast) window.toast('Notificaciones de nuevos episodios desactivadas.');
      }
    });
  }

  async function syncEpisodeNotificationState() {
    const input = document.getElementById('settingEpisodeNotifications');
    if (!input) return;
    const localEnabled = localStorage.getItem('onebase_push_enabled_v1') === '1';
    input.checked = localEnabled;
    writeSettings({ episodeNotifications: localEnabled });

    try {
      const api = window.OneBaseEpisodeNotifications;
      const registration = await api?.registerServiceWorker?.();
      const subscription = await registration?.pushManager?.getSubscription();
      const enabled = Boolean(subscription && 'Notification' in window && Notification.permission === 'granted');
      input.checked = enabled;
      writeSettings({ episodeNotifications: enabled });
    } catch (_) {}
  }

  function wireSettingsOpen() {
    const open = () => {
      addThemeSection();
      addEpisodeNotificationSetting();
      const settings = readSettings();
      const confirm = document.getElementById('settingConfirmDelete');
      const backup = document.getElementById('settingAutoBackup');
      const achievements = document.getElementById('settingAchievementPopups');
      if (confirm) confirm.checked = !!settings.confirmDelete;
      if (backup) backup.checked = !!settings.autoBackup;
      if (achievements) achievements.checked = !!settings.achievementPopups;
      void syncEpisodeNotificationState();
    };
    document.getElementById('settingsBtn')?.addEventListener('click', () => setTimeout(open, 0));
    document.getElementById('profileTopBtn')?.addEventListener('click', () => setTimeout(open, 0));
    open();
  }

  function boot() {
    injectStyles();
    addThemeSection();
    addEpisodeNotificationSetting();
    wireSettingsOpen();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
