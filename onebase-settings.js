/* OneBase — ajustes independientes del perfil. */
(function () {
  'use strict';

  const KEY = 'onebase_settings_v2';
  const DEFAULTS = {
    confirmDelete: true,
    autoBackup: true,
    achievementPopups: true,
    episodeNotifications: false
  };

  const state = () => {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch (_) { return { ...DEFAULTS }; }
  };

  function saveState(patch) {
    const next = { ...state(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch (_) {}
    window.OneBaseSettings = window.OneBaseSettings || {};
    window.OneBaseSettings.state = next;
    return next;
  }

  function css() {
    if (document.getElementById('onebase-settings-v2-css')) return;
    const style = document.createElement('style');
    style.id = 'onebase-settings-v2-css';
    style.textContent = `
      #onebaseSettingsButton{position:relative;display:inline-flex;align-items:center;gap:7px}
      #onebaseSettingsButton .ob-settings-icon{font-size:14px;line-height:1}
      #onebaseSettingsOverlay{position:fixed;inset:0;z-index:10080;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.72);backdrop-filter:blur(10px);animation:obSettingsFade .18s ease}
      #onebaseSettingsOverlay.open{display:flex}
      .ob-settings-window{width:min(780px,94vw);max-height:min(820px,90vh);overflow:hidden;display:flex;flex-direction:column;background:var(--panel,#111);color:var(--text,#f5f5f5);border:1px solid var(--line2,#353535);border-radius:20px;box-shadow:0 30px 90px rgba(0,0,0,.58);animation:obSettingsIn .25s cubic-bezier(.2,.8,.2,1)}
      .ob-settings-head{display:flex;align-items:center;justify-content:space-between;padding:20px 22px;border-bottom:1px solid var(--line,#292929);flex:0 0 auto}
      .ob-settings-title{display:flex;align-items:center;gap:11px}.ob-settings-title strong{font-size:18px;letter-spacing:-.4px}.ob-settings-title small{display:block;margin-top:3px;color:var(--muted,#8b8b8b);font-size:9px;letter-spacing:.6px;text-transform:uppercase}
      .ob-settings-close{width:34px;height:34px;border:1px solid var(--line2,#353535);border-radius:10px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);font-size:17px;cursor:pointer}
      .ob-settings-body{padding:18px;overflow:auto;display:grid;gap:14px}
      .ob-settings-section{border:1px solid var(--line,#292929);border-radius:15px;background:var(--panel2,#171717);overflow:hidden}
      .ob-settings-section-head{padding:15px 17px;border-bottom:1px solid var(--line,#292929)}
      .ob-settings-section-head strong{font-size:12px}.ob-settings-section-head p{margin:4px 0 0;color:var(--muted,#8b8b8b);font-size:9px;line-height:1.5}
      .ob-setting-row{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:14px 17px;border-bottom:1px solid var(--line,#292929)}.ob-setting-row:last-child{border-bottom:0}
      .ob-setting-copy{min-width:0}.ob-setting-copy strong{display:block;font-size:11px}.ob-setting-copy span{display:block;margin-top:4px;color:var(--muted,#8b8b8b);font-size:9px;line-height:1.45}
      .ob-switch{position:relative;flex:0 0 46px;width:46px;height:25px}.ob-switch input{position:absolute;opacity:0;width:1px;height:1px}.ob-switch-track{position:absolute;inset:0;border:1px solid var(--line2,#353535);border-radius:999px;background:var(--soft,#1c1c1c);cursor:pointer;transition:.2s ease}.ob-switch-track:before{content:"";position:absolute;left:3px;top:3px;width:17px;height:17px;border-radius:50%;background:var(--muted,#8b8b8b);transition:.2s ease}.ob-switch input:checked+.ob-switch-track{border-color:var(--accent,#d6a84f);background:color-mix(in srgb,var(--accent,#d6a84f) 16%,var(--soft,#1c1c1c))}.ob-switch input:checked+.ob-switch-track:before{transform:translateX(21px);background:var(--accent,#d6a84f)}
      .ob-theme-box{padding:16px 17px}.ob-theme-select{width:100%;padding:11px 12px;border:1px solid var(--line2,#353535);border-radius:11px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);font-weight:700;font-size:11px;outline:none}.ob-theme-note{margin-top:8px;color:var(--muted,#8b8b8b);font-size:9px}
      @keyframes obSettingsFade{from{opacity:0}to{opacity:1}}@keyframes obSettingsIn{from{opacity:0;transform:translateY(12px) scale(.985)}to{opacity:1;transform:none}}
      body.onebase-light-theme #onebaseSettingsOverlay{background:rgba(255,255,255,.72)}
      body.onebase-light-theme .ob-settings-window,body.onebase-light-theme .ob-settings-section{background:#fff!important;color:#050505!important;border-color:#050505!important;box-shadow:0 10px 0 rgba(0,0,0,.08)}
      body.onebase-light-theme .ob-settings-head,body.onebase-light-theme .ob-setting-row{border-color:#050505!important}.onebase-light-theme .ob-settings-close,.onebase-light-theme .ob-theme-select{background:#fff!important;color:#050505!important;border:2px solid #050505!important}.onebase-light-theme .ob-settings-section-head{border-color:#050505!important}.onebase-light-theme .ob-setting-copy span,.onebase-light-theme .ob-theme-note{color:#222!important}
      @media(max-width:600px){.ob-settings-body{padding:10px}.ob-settings-head{padding:15px}.ob-setting-row{padding:13px}.ob-settings-window{max-height:94vh}}
    `;
    document.head.appendChild(style);
  }

  function makeSwitch(id, checked) {
    const label = document.createElement('label');
    label.className = 'ob-switch';
    label.innerHTML = `<input id="${id}" type="checkbox" ${checked ? 'checked' : ''}><span class="ob-switch-track"></span>`;
    return label;
  }

  function row(id, title, description, checked) {
    const el = document.createElement('div');
    el.className = 'ob-setting-row';
    const copy = document.createElement('div'); copy.className = 'ob-setting-copy';
    copy.innerHTML = `<strong>${title}</strong><span>${description}</span>`;
    el.append(copy, makeSwitch(id, checked));
    return el;
  }

  function findOriginalThemeSelect() {
    return document.getElementById('themeSelect') || document.querySelector('select[data-theme], select[name="theme"]');
  }

  function themeOptions(original) {
    if (original?.options?.length) return [...original.options].map(o => ({value:o.value,text:o.textContent.trim()}));
    return [
      {value:'high-black',text:'Alto contraste · Negro'},
      {value:'high-white',text:'Alto contraste · Blanco'},
      {value:'manga',text:'Manga'},
      {value:'ink',text:'Tinta'},
      {value:'custom',text:'Personalizado'}
    ];
  }

  function applyTheme(value) {
    const original = findOriginalThemeSelect();
    if (original) {
      original.value = value;
      original.dispatchEvent(new Event('change', {bubbles:true}));
    }
    try { localStorage.setItem('onebase_theme_v1', value); } catch (_) {}
    const theme = document.getElementById('onebaseSettingsTheme');
    const status = document.getElementById('onebaseSettingsThemeStatus');
    if (theme && status) status.textContent = `Tema activo: ${theme.selectedOptions[0]?.textContent || value}`;
  }

  function buildOverlay() {
    if (document.getElementById('onebaseSettingsOverlay')) return;
    const s = state();
    const overlay = document.createElement('div');
    overlay.id = 'onebaseSettingsOverlay';
    overlay.innerHTML = `
      <div class="ob-settings-window" role="dialog" aria-modal="true" aria-labelledby="onebaseSettingsTitle">
        <div class="ob-settings-head">
          <div class="ob-settings-title"><span style="font-size:22px">⚙️</span><div><strong id="onebaseSettingsTitle">Ajustes</strong><small>Configuración de OneBase</small></div></div>
          <button type="button" class="ob-settings-close" id="onebaseSettingsClose" aria-label="Cerrar ajustes">×</button>
        </div>
        <div class="ob-settings-body">
          <section class="ob-settings-section">
            <div class="ob-settings-section-head"><strong>🎨 Apariencia</strong><p>La configuración de apariencia está disponible aquí sin eliminar los controles originales.</p></div>
            <div class="ob-theme-box"><select id="onebaseSettingsTheme" class="ob-theme-select" aria-label="Tema de OneBase"></select><div class="ob-theme-note" id="onebaseSettingsThemeStatus"></div></div>
          </section>
          <section class="ob-settings-section">
            <div class="ob-settings-section-head"><strong>🛡️ Protección</strong><p>Controles para proteger tu biblioteca y controlar los avisos de OneBase.</p></div>
            <div id="onebaseProtectionRows"></div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const protection = overlay.querySelector('#onebaseProtectionRows');
    protection.append(
      row('onebaseSettingConfirmDelete','Confirmar eliminaciones','Evita borrar un anime por accidente.',s.confirmDelete),
      row('onebaseSettingAutoBackup','Copias automáticas','Guarda instantáneas locales periódicas de tu biblioteca.',s.autoBackup),
      row('onebaseSettingAchievementPopups','Avisos de logros','Muestra la ventana emergente al desbloquearlos.',s.achievementPopups),
      row('onebaseSettingEpisodeNotifications','Enviar notificaciones de nuevos episodios','Recibe avisos cuando OneBase detecte un episodio nuevo, incluso con la web cerrada.',s.episodeNotifications)
    );

    const original = findOriginalThemeSelect();
    const theme = overlay.querySelector('#onebaseSettingsTheme');
    for (const option of themeOptions(original)) {
      const o = document.createElement('option'); o.value=option.value; o.textContent=option.text; theme.appendChild(o);
    }
    theme.value = original?.value || s.theme || theme.options[0]?.value || '';
    overlay.querySelector('#onebaseSettingsThemeStatus').textContent = `Tema activo: ${theme.selectedOptions[0]?.textContent || theme.value}`;
    theme.addEventListener('change', () => applyTheme(theme.value));

    overlay.querySelector('#onebaseSettingsClose').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

    bindToggle('onebaseSettingConfirmDelete','confirmDelete');
    bindToggle('onebaseSettingAutoBackup','autoBackup');
    bindToggle('onebaseSettingAchievementPopups','achievementPopups');
    bindToggle('onebaseSettingEpisodeNotifications','episodeNotifications', async input => {
      try {
        if (input.checked) {
          if (!window.OneBaseEpisodeNotifications?.enablePush) throw new Error('El sistema de notificaciones no está disponible.');
          await window.OneBaseEpisodeNotifications.enablePush();
          saveState({episodeNotifications:true});
          if (window.toast) window.toast('✓ Notificaciones de nuevos episodios activadas.');
        } else {
          await window.OneBaseEpisodeNotifications?.disablePush?.();
          saveState({episodeNotifications:false});
          if (window.toast) window.toast('Notificaciones de nuevos episodios desactivadas.');
        }
      } catch (error) {
        input.checked=false; saveState({episodeNotifications:false});
        if (window.toast) window.toast(`⚠️ ${error?.message || 'No se pudieron cambiar las notificaciones.'}`);
      }
    });
  }

  function bindToggle(id,key,custom) {
    const input=document.getElementById(id); if(!input) return;
    input.addEventListener('change',async()=>{ if(custom){await custom(input);return;} saveState({[key]:input.checked}); });
  }

  function open(){buildOverlay();document.getElementById('onebaseSettingsOverlay').classList.add('open');document.body.style.overflow='hidden';}
  function close(){document.getElementById('onebaseSettingsOverlay')?.classList.remove('open');document.body.style.overflow='';}

  function addButton(){
    if(document.getElementById('onebaseSettingsButton')) return;
    const controls=document.querySelector('header .controls')||document.querySelector('.controls');
    if(!controls) return;
    const button=document.createElement('button');
    button.type='button';button.id='onebaseSettingsButton';button.className='btn icon';button.title='Ajustes';button.innerHTML='<span class="ob-settings-icon">⚙</span><span>Ajustes</span>';
    button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();open();});
    const profile=document.getElementById('profileTopBtn');
    if(profile && profile.parentElement===controls) controls.insertBefore(button,profile); else controls.appendChild(button);
  }

  function installProtection(){
    document.addEventListener('click',e=>{
      if(!state().confirmDelete) return;
      const target=e.target.closest?.('.clearAnime,[data-action="delete-anime"],[data-delete-anime]');
      if(!target) return;
      if(target.dataset.onebaseConfirmed==='1'){delete target.dataset.onebaseConfirmed;return;}
      const ok=window.confirm('¿Seguro que quieres eliminar este anime?');
      if(!ok){e.preventDefault();e.stopImmediatePropagation();} else target.dataset.onebaseConfirmed='1';
    },true);
    if(!window.OneBaseSettingsBackupTimer){
      window.OneBaseSettingsBackupTimer=setInterval(()=>{
        if(!state().autoBackup) return;
        try{
          const list=Array.isArray(window.data)?window.data:[]; if(!list.length)return;
          const key=`onebase_backup_${new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')}`;
          localStorage.setItem(key,JSON.stringify({createdAt:Date.now(),library:list}));
        }catch(_){ }
      },30*60*1000);
    }
  }

  window.OneBaseSettings={open,close,state,save:saveState};

  function boot(){css();addButton();installProtection();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
