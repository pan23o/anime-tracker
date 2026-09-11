/* OneBase · Webs favoritas por usuario
 *
 * Cada web se guarda como una fuente de búsqueda personalizada.
 * URL obligatoria: una URL HTTPS/HTTP de búsqueda que contenga {query}.
 * {query} recibe el nombre del anime y {episode} recibe el número de episodio.
 * Ejemplo: https://ejemplo.com/search?q={query}
 * Ejemplo: https://ejemplo.com/search?q={query}&episode={episode}
 */
(function(){
  'use strict';

  const STORAGE='onebase_custom_webs_v1';
  const MAX_WEBS=30;
  let sources=[];
  let currentUserKey='default';

  function profileKey(){
    try{
      const profile=JSON.parse(localStorage.getItem('anime_tracker_profile_v1')||'{}');
      const email=String(profile?.email||'').trim().toLowerCase();
      return email ? email : 'default';
    }catch(_){ return 'default'; }
  }

  function readAll(){
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE)||'{}');
      if(Array.isArray(raw)) return {'default':raw};
      return raw&&typeof raw==='object'?raw:{};
    }catch(_){return {};}
  }

  function load(){
    currentUserKey=profileKey();
    const all=readAll();
    sources=Array.isArray(all[currentUserKey])?all[currentUserKey]:[];
    if(currentUserKey!=='default' && !sources.length && Array.isArray(all.default) && all.default.length){
      // Migra las fuentes locales antiguas una sola vez al perfil actual.
      sources=all.default.map(x=>({...x,id:cryptoId()}));
      save();
    }
  }

  function save(){
    const all=readAll();
    all[currentUserKey]=sources.slice(0,MAX_WEBS);
    try{localStorage.setItem(STORAGE,JSON.stringify(all));}catch(_){ }
    window.dispatchEvent(new CustomEvent('onebase:custom-webs-changed',{detail:{sources:sources.slice()}}));
  }

  function cryptoId(){
    try{return crypto.randomUUID();}catch(_){return 'web_'+Date.now()+'_'+Math.random().toString(36).slice(2);}
  }

  function escapeHtml(value){
    return String(value??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  }

  function validTemplate(value){
    let url='';
    try{url=new URL(String(value).trim());}catch(_){return false;}
    if(!/^https?:$/.test(url.protocol)) return false;
    return String(value).includes('{query}');
  }

  function buildUrl(template,anime,episode){
    const title=String(anime||'').trim();
    const ep=Number(episode)||0;
    return String(template)
      .replaceAll('{query}',encodeURIComponent(ep>0?`${title} ${ep}`:title))
      .replaceAll('{episode}',encodeURIComponent(ep>0?String(ep):''));
  }

  function css(){
    if(document.getElementById('onebase-custom-webs-css'))return;
    const style=document.createElement('style');
    style.id='onebase-custom-webs-css';
    style.textContent=`
      .ob-custom-webs-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-top:1px solid var(--line,#292929)}
      .ob-custom-webs-copy{min-width:0}.ob-custom-webs-copy strong{display:block;font-size:11px}.ob-custom-webs-copy span{display:block;margin-top:4px;color:var(--muted,#8b8b8b);font-size:9px;line-height:1.45}
      .ob-custom-webs-add{border:1px solid var(--line2,#353535);border-radius:10px;padding:9px 12px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
      .ob-custom-webs-list{display:grid;gap:7px;padding:0 17px 14px}
      .ob-custom-web-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid var(--line,#292929);border-radius:10px;background:var(--panel,#111)}
      .ob-custom-web-item strong{display:block;font-size:10px}.ob-custom-web-item code{display:block;margin-top:3px;color:var(--muted,#8b8b8b);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:470px}
      .ob-custom-web-delete{border:1px solid #5a3030;border-radius:8px;padding:7px 9px;background:rgba(100,20,20,.12);color:#ffbaba;font-size:9px;font-weight:800;cursor:pointer;flex:0 0 auto}
      .ob-custom-empty{padding:5px 0 2px;color:var(--muted,#8b8b8b);font-size:9px}
      #onebaseCustomWebModal{position:fixed;inset:0;z-index:10120;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.76);backdrop-filter:blur(9px)}
      #onebaseCustomWebModal.open{display:flex}
      .ob-custom-web-dialog{width:min(520px,94vw);background:var(--panel,#111);color:var(--text,#f5f5f5);border:1px solid var(--line2,#353535);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.65);padding:21px}
      .ob-custom-web-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.ob-custom-web-head h2{margin:0;font-size:17px}.ob-custom-web-close{border:0;background:none;color:var(--muted,#8b8b8b);font-size:24px;cursor:pointer}
      .ob-custom-web-help{margin:6px 0 16px;color:var(--muted,#8b8b8b);font-size:9px;line-height:1.6}
      .ob-custom-field{display:grid;gap:6px;margin-top:11px}.ob-custom-field label{font-size:9px;color:var(--muted,#8b8b8b);text-transform:uppercase;letter-spacing:1px;font-weight:800}.ob-custom-field input{width:100%;padding:11px;border:1px solid var(--line2,#353535);border-radius:10px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);outline:none;font-size:11px}.ob-custom-field input:focus{border-color:var(--accent,#d6a84f)}
      .ob-custom-template-help{margin-top:6px;color:var(--muted,#8b8b8b);font-size:8px;line-height:1.5}.ob-custom-template-help code{color:var(--text,#f5f5f5)}
      .ob-custom-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}.ob-custom-actions button{border:1px solid var(--line2,#353535);border-radius:10px;padding:10px 13px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);font-size:10px;font-weight:800;cursor:pointer}.ob-custom-actions .primary{background:var(--accent,#d6a84f);color:#080808;border-color:var(--accent,#d6a84f)}
      .ob-custom-error{min-height:14px;margin-top:7px;color:#ffbaba;font-size:9px}
      .ob-custom-count{padding:0 17px 11px;color:var(--muted,#8b8b8b);font-size:8px}
      body.onebase-light-theme #onebaseCustomWebModal{background:rgba(255,255,255,.75)}
      body.onebase-light-theme .ob-custom-web-dialog{background:#fff;color:#050505;border-color:#050505}.onebase-light-theme .ob-custom-field input{background:#fff;color:#050505;border:2px solid #050505}.onebase-light-theme .ob-custom-web-delete{color:#8a0000;border-color:#8a0000}.onebase-light-theme .ob-custom-template-help code{color:#050505}
      @media(max-width:600px){.ob-custom-web-item code{max-width:240px}.ob-custom-webs-entry{align-items:flex-start;flex-direction:column}.ob-custom-webs-add{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function createModal(){
    if(document.getElementById('onebaseCustomWebModal'))return;
    const modal=document.createElement('div');
    modal.id='onebaseCustomWebModal';
    modal.innerHTML=`
      <div class="ob-custom-web-dialog" role="dialog" aria-modal="true" aria-labelledby="obCustomWebTitle">
        <div class="ob-custom-web-head"><h2 id="obCustomWebTitle">🌐 Añadir web</h2><button class="ob-custom-web-close" id="obCustomWebClose" type="button" aria-label="Cerrar">×</button></div>
        <p class="ob-custom-web-help">Añade una web donde suelas buscar anime. Para que OneBase pueda generar la búsqueda automáticamente, necesitas introducir <b>la URL de búsqueda</b>, no solo la página de inicio.</p>
        <div class="ob-custom-field"><label for="obCustomWebName">Nombre de web</label><input id="obCustomWebName" maxlength="60" placeholder="Ej.: Mi página de anime" autocomplete="off"></div>
        <div class="ob-custom-field"><label for="obCustomWebUrl">URL de búsqueda</label><input id="obCustomWebUrl" maxlength="1000" placeholder="https://ejemplo.com/search?q={query}" autocomplete="off"></div>
        <div class="ob-custom-template-help">La URL debe empezar por <code>http://</code> o <code>https://</code> y contener <code>{query}</code>. Puedes añadir <code>{episode}</code> si la web permite indicar el episodio por separado.</div>
        <div class="ob-custom-error" id="obCustomWebError" aria-live="polite"></div>
        <div class="ob-custom-actions"><button type="button" id="obCustomWebCancel">Cancelar</button><button type="button" class="primary" id="obCustomWebSave">Añadir web</button></div>
      </div>`;
    document.body.appendChild(modal);
    const close=()=>modal.classList.remove('open');
    document.getElementById('obCustomWebClose').addEventListener('click',close);
    document.getElementById('obCustomWebCancel').addEventListener('click',close);
    modal.addEventListener('click',e=>{if(e.target===modal)close();});
    document.getElementById('obCustomWebSave').addEventListener('click',addFromForm);
    document.getElementById('obCustomWebUrl').addEventListener('keydown',e=>{if(e.key==='Enter')addFromForm();});
    document.getElementById('obCustomWebName').addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('obCustomWebUrl').focus();});
  }

  function openAdd(){
    createModal();
    const modal=document.getElementById('onebaseCustomWebModal');
    document.getElementById('obCustomWebName').value='';
    document.getElementById('obCustomWebUrl').value='';
    document.getElementById('obCustomWebError').textContent='';
    modal.classList.add('open');
    setTimeout(()=>document.getElementById('obCustomWebName').focus(),30);
  }

  function addFromForm(){
    const name=document.getElementById('obCustomWebName').value.trim();
    const template=document.getElementById('obCustomWebUrl').value.trim();
    const error=document.getElementById('obCustomWebError');
    error.textContent='';
    if(!name){error.textContent='Escribe un nombre para la web.';return;}
    if(name.length<2){error.textContent='El nombre es demasiado corto.';return;}
    if(sources.length>=MAX_WEBS){error.textContent=`Has alcanzado el máximo de ${MAX_WEBS} webs.`;return;}
    if(!validTemplate(template)){error.textContent='La URL debe ser http/https y contener {query}. Usa la URL de búsqueda de la web.';return;}
    let parsed;
    try{parsed=new URL(template);}catch(_){error.textContent='La URL no es válida.';return;}
    const host=parsed.hostname.toLowerCase();
    if(sources.some(x=>String(x.name).toLowerCase()===name.toLowerCase() || String(x.template).toLowerCase()===template.toLowerCase())){
      error.textContent='Esa web ya está añadida.';return;
    }
    sources.push({id:cryptoId(),name:name.slice(0,60),template,host,createdAt:Date.now()});
    save();
    document.getElementById('onebaseCustomWebModal').classList.remove('open');
    renderSettingsSection();
    if(window.toast)window.toast(`✓ ${name} añadida a tus webs`);
  }

  function renderSettingsSection(){
    const settingsOverlay=document.getElementById('onebaseSettingsOverlay');
    if(!settingsOverlay)return;
    const body=settingsOverlay.querySelector('.ob-settings-body');
    if(!body)return;
    let section=document.getElementById('onebaseCustomWebsSection');
    if(!section){
      section=document.createElement('section');
      section.id='onebaseCustomWebsSection';
      section.className='ob-settings-section';
      body.appendChild(section);
    }
    section.innerHTML=`
      <div class="ob-settings-section-head"><strong>🌐 Webs favoritas</strong><p>Añade tus propias páginas. Aparecerán junto a las búsquedas oficiales cuando pulses el nombre de un anime.</p></div>
      <div class="ob-custom-webs-entry"><div class="ob-custom-webs-copy"><strong>Mis webs</strong><span>Se guardan separadas para cada perfil local de OneBase.</span></div><button type="button" class="ob-custom-webs-add" id="obCustomWebAdd">＋ Añadir web</button></div>
      <div class="ob-custom-count">${sources.length}/${MAX_WEBS} webs configuradas</div>
      <div class="ob-custom-webs-list" id="obCustomWebList"></div>`;
    const list=section.querySelector('#obCustomWebList');
    if(!sources.length){list.innerHTML='<div class="ob-custom-empty">Todavía no has añadido ninguna web.</div>';}else{
      list.innerHTML=sources.map(source=>`<div class="ob-custom-web-item"><div><strong>${escapeHtml(source.name)}</strong><code>${escapeHtml(source.template)}</code></div><button type="button" class="ob-custom-web-delete" data-custom-web-delete="${escapeHtml(source.id)}">Eliminar</button></div>`).join('');
    }
    section.querySelector('#obCustomWebAdd').addEventListener('click',openAdd);
    section.querySelectorAll('[data-custom-web-delete]').forEach(btn=>btn.addEventListener('click',()=>{
      const id=btn.dataset.customWebDelete;
      const source=sources.find(x=>x.id===id);if(!source)return;
      if(!window.confirm(`¿Eliminar la web "${source.name}" de tus webs favoritas?`))return;
      sources=sources.filter(x=>x.id!==id);save();renderSettingsSection();
      if(window.toast)window.toast('Web eliminada');
    }));
  }

  function injectSourceButtons(){
    const choices=document.querySelector('#sourceModal .sourceChoices');
    if(!choices)return;
    choices.querySelectorAll('[data-custom-web]').forEach(el=>el.remove());
    if(!sources.length)return;
    sources.forEach(source=>{
      const button=document.createElement('button');
      button.type='button';button.dataset.customWeb=source.id;button.textContent=source.name;
      button.addEventListener('click',()=>{
        const modal=document.getElementById('sourceModal');
        const anime=document.getElementById('sourceAnime')?.textContent||'';
        const index=window.__onebaseSourceIndex;
        let episode=0;
        try{
          const item=Array.isArray(window.data)?window.data[index]:null;
          episode=Number(item?.watched)||0;
        }catch(_){ }
        const url=buildUrl(source.template,anime,episode);
        try{window.open(url,'_blank','noopener,noreferrer');}catch(_){window.location.href=url;}
        modal?.classList.add('hidden');
      });
      choices.appendChild(button);
    });
  }

  function watchSourceModal(){
    const modal=document.getElementById('sourceModal');
    if(!modal)return;
    const originalOpen=window.openSourceModal;
    // The app function is lexical, so expose the current index by observing the modal title.
    const observer=new MutationObserver(()=>injectSourceButtons());
    observer.observe(modal,{childList:true,subtree:true,characterData:true,attributes:true});
    modal.addEventListener('click',()=>setTimeout(injectSourceButtons,0),true);
    injectSourceButtons();
  }

  function sourceIndexBridge(){
    const rows=document.getElementById('rows');
    if(!rows)return;
    rows.addEventListener('click',e=>{
      const link=e.target.closest?.('.animeLink');
      if(!link)return;
      const row=link.closest('.row');
      if(row)window.__onebaseSourceIndex=Number(row.dataset.index);
    },true);
  }

  function boot(){
    css();load();createModal();
    const start=()=>{renderSettingsSection();watchSourceModal();sourceIndexBridge();injectSourceButtons();};
    start();
    const observer=new MutationObserver(()=>{renderSettingsSection();injectSourceButtons();});
    observer.observe(document.body,{childList:true,subtree:true});
    window.addEventListener('onebase:custom-webs-changed',()=>{load();renderSettingsSection();injectSourceButtons();});
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.OneBaseCustomWebs={get:()=>sources.slice(),reload:load,openAdd};
})();
