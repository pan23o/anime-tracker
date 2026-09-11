/* OneBase · Webs favoritas por usuario
 * El usuario solo necesita introducir la URL principal de la web.
 * OneBase analiza esa página desde /api/resolve-web-search cuando necesita
 * realizar una búsqueda y descubre automáticamente el formulario de búsqueda.
 */
(function(){
  'use strict';
  const STORAGE='onebase_custom_webs_v1';
  const MAX_WEBS=30;
  let sources=[];
  let currentUserKey='default';

  function profileKey(){
    try{const p=JSON.parse(localStorage.getItem('anime_tracker_profile_v1')||'{}');return String(p?.email||'').trim().toLowerCase()||'default';}catch(_){return 'default';}
  }
  function id(){try{return crypto.randomUUID();}catch(_){return 'web_'+Date.now()+'_'+Math.random().toString(36).slice(2);}}
  function readAll(){try{const r=JSON.parse(localStorage.getItem(STORAGE)||'{}');return Array.isArray(r)?{default:r}:(r&&typeof r==='object'?r:{});}catch(_){return {};}}
  function save(){const all=readAll();all[currentUserKey]=sources.slice(0,MAX_WEBS);try{localStorage.setItem(STORAGE,JSON.stringify(all));}catch(_){}window.dispatchEvent(new CustomEvent('onebase:custom-webs-changed',{detail:{sources:sources.slice()}}));}
  function load(){
    currentUserKey=profileKey();const all=readAll();let list=Array.isArray(all[currentUserKey])?all[currentUserKey]:[];
    list=list.map(x=>({id:x.id||id(),name:String(x.name||'Web').trim(),homepage:String(x.homepage||x.url||x.template||'').trim(),createdAt:x.createdAt||Date.now()})).filter(x=>x.homepage);
    if(currentUserKey!=='default'&&!list.length&&Array.isArray(all.default)&&all.default.length) list=all.default.map(x=>({id:id(),name:String(x.name||'Web').trim(),homepage:String(x.homepage||x.url||x.template||'').trim(),createdAt:Date.now()})).filter(x=>x.homepage);
    sources=list.slice(0,MAX_WEBS);save();
  }
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}
  function validHomepage(v){try{const u=new URL(String(v).trim());return /^https?:$/.test(u.protocol)&&!!u.hostname;}catch(_){return false;}}
  function normalizeHomepage(v){const u=new URL(String(v).trim());u.hash='';return u.toString().replace(/\/$/,'');}

  function css(){
    if(document.getElementById('onebase-custom-webs-css'))return;
    const s=document.createElement('style');s.id='onebase-custom-webs-css';s.textContent=`
      .ob-custom-webs-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-top:1px solid var(--line,#292929)}
      .ob-custom-webs-copy{min-width:0}.ob-custom-webs-copy strong{display:block;font-size:11px}.ob-custom-webs-copy span{display:block;margin-top:4px;color:var(--muted,#8b8b8b);font-size:9px;line-height:1.5}
      .ob-custom-webs-add{border:1px solid var(--line2,#353535);border-radius:10px;padding:9px 12px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}
      .ob-custom-webs-list{display:grid;gap:7px;padding:0 17px 14px}.ob-custom-web-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid var(--line,#292929);border-radius:10px;background:var(--panel,#111)}
      .ob-custom-web-copy{min-width:0}.ob-custom-web-copy strong{display:block;font-size:10px}.ob-custom-web-copy code{display:block;margin-top:4px;color:var(--muted,#8b8b8b);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:470px}
      .ob-custom-web-delete{border:1px solid #5a3030;border-radius:8px;padding:7px 9px;background:rgba(100,20,20,.12);color:#ffbaba;font-size:9px;font-weight:800;cursor:pointer;flex:0 0 auto}.ob-custom-empty{padding:5px 0 2px;color:var(--muted,#8b8b8b);font-size:9px}.ob-custom-count{padding:0 17px 11px;color:var(--muted,#8b8b8b);font-size:8px}
      #onebaseCustomWebModal{position:fixed;inset:0;z-index:10120;display:none;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.76);backdrop-filter:blur(9px)}#onebaseCustomWebModal.open{display:flex}
      .ob-custom-web-dialog{width:min(520px,94vw);background:var(--panel,#111);color:var(--text,#f5f5f5);border:1px solid var(--line2,#353535);border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.65);padding:21px}.ob-custom-web-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.ob-custom-web-head h2{margin:0;font-size:17px}.ob-custom-web-close{border:0;background:none;color:var(--muted,#8b8b8b);font-size:24px;cursor:pointer}
      .ob-custom-web-help{margin:6px 0 16px;color:var(--muted,#8b8b8b);font-size:9px;line-height:1.65}.ob-custom-field{display:grid;gap:6px;margin-top:11px}.ob-custom-field label{font-size:9px;color:var(--muted,#8b8b8b);text-transform:uppercase;letter-spacing:1px;font-weight:800}.ob-custom-field input{width:100%;box-sizing:border-box;padding:11px;border:1px solid var(--line2,#353535);border-radius:10px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);outline:none;font-size:11px}.ob-custom-field input:focus{border-color:var(--accent,#d6a84f)}.ob-custom-url-help{margin-top:6px;color:var(--muted,#8b8b8b);font-size:8px;line-height:1.5}
      .ob-custom-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}.ob-custom-actions button{border:1px solid var(--line2,#353535);border-radius:10px;padding:10px 13px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);font-size:10px;font-weight:800;cursor:pointer}.ob-custom-actions .primary{background:var(--accent,#d6a84f);color:#080808;border-color:var(--accent,#d6a84f)}.ob-custom-error{min-height:14px;margin-top:7px;color:#ffbaba;font-size:9px}.ob-custom-loading{opacity:.7;pointer-events:none}
      body.onebase-light-theme #onebaseCustomWebModal{background:rgba(255,255,255,.75)}body.onebase-light-theme .ob-custom-web-dialog{background:#fff;color:#050505;border-color:#050505}.onebase-light-theme .ob-custom-field input{background:#fff;color:#050505;border:2px solid #050505}.onebase-light-theme .ob-custom-web-delete{color:#8a0000;border-color:#8a0000}
      @media(max-width:600px){.ob-custom-web-copy code{max-width:240px}.ob-custom-webs-entry{align-items:flex-start;flex-direction:column}.ob-custom-webs-add{width:100%}}
    `;document.head.appendChild(s);
  }

  function createModal(){
    if(document.getElementById('onebaseCustomWebModal'))return;
    const m=document.createElement('div');m.id='onebaseCustomWebModal';m.innerHTML=`
      <div class="ob-custom-web-dialog" role="dialog" aria-modal="true" aria-labelledby="obCustomWebTitle">
        <div class="ob-custom-web-head"><h2 id="obCustomWebTitle">🌐 Añadir web</h2><button class="ob-custom-web-close" id="obCustomWebClose" type="button" aria-label="Cerrar">×</button></div>
        <p class="ob-custom-web-help">Solo necesitas poner el <b>nombre</b> de la web y su <b>dirección principal</b>. No tienes que saber cómo funciona su buscador: OneBase intentará detectar automáticamente dónde y cómo buscar el anime dentro de esa web.</p>
        <div class="ob-custom-field"><label for="obCustomWebName">Nombre de web</label><input id="obCustomWebName" maxlength="60" placeholder="Ej.: AnimeFLV" autocomplete="off"></div>
        <div class="ob-custom-field"><label for="obCustomWebUrl">URL de la web</label><input id="obCustomWebUrl" maxlength="1000" placeholder="https://animeflv.or.at" autocomplete="off"></div>
        <div class="ob-custom-url-help">La dirección debe ser la página principal de la web y empezar por <code>http://</code> o <code>https://</code>. <b>No necesitas añadir {query}, /search ni ningún parámetro.</b></div>
        <div class="ob-custom-error" id="obCustomWebError" aria-live="polite"></div>
        <div class="ob-custom-actions"><button type="button" id="obCustomWebCancel">Cancelar</button><button type="button" class="primary" id="obCustomWebSave">Añadir web</button></div>
      </div>`;
    document.body.appendChild(m);const close=()=>m.classList.remove('open');
    m.querySelector('#obCustomWebClose').addEventListener('click',close);m.querySelector('#obCustomWebCancel').addEventListener('click',close);m.addEventListener('click',e=>{if(e.target===m)close()});m.querySelector('#obCustomWebSave').addEventListener('click',addFromForm);m.querySelector('#obCustomWebUrl').addEventListener('keydown',e=>{if(e.key==='Enter')addFromForm()});m.querySelector('#obCustomWebName').addEventListener('keydown',e=>{if(e.key==='Enter')m.querySelector('#obCustomWebUrl').focus()});
  }
  function openAdd(){createModal();const m=document.getElementById('onebaseCustomWebModal');m.querySelector('#obCustomWebName').value='';m.querySelector('#obCustomWebUrl').value='';m.querySelector('#obCustomWebError').textContent='';m.classList.add('open');setTimeout(()=>m.querySelector('#obCustomWebName').focus(),30);}
  function addFromForm(){
    const name=document.getElementById('obCustomWebName').value.trim(),raw=document.getElementById('obCustomWebUrl').value.trim(),error=document.getElementById('obCustomWebError');error.textContent='';
    if(!name){error.textContent='Escribe un nombre para la web.';return}if(name.length<2){error.textContent='El nombre es demasiado corto.';return}if(!validHomepage(raw)){error.textContent='Introduce la URL principal completa, por ejemplo: https://animeflv.or.at';return}if(sources.length>=MAX_WEBS){error.textContent=`Has alcanzado el máximo de ${MAX_WEBS} webs.`;return}
    let homepage;try{homepage=normalizeHomepage(raw)}catch(_){error.textContent='La URL no es válida.';return}
    if(sources.some(x=>String(x.name).toLowerCase()===name.toLowerCase()||String(x.homepage).toLowerCase()===homepage.toLowerCase())){error.textContent='Esa web ya está añadida.';return}
    sources.push({id:id(),name:name.slice(0,60),homepage,createdAt:Date.now()});save();document.getElementById('onebaseCustomWebModal').classList.remove('open');renderSettingsSection();if(window.toast)window.toast(`✓ ${name} añadida a tus webs`);
  }

  function renderSettingsSection(){
    const body=document.getElementById('onebaseSettingsOverlay')?.querySelector('.ob-settings-body');if(!body)return;let section=document.getElementById('onebaseCustomWebsSection');
    if(!section){section=document.createElement('section');section.id='onebaseCustomWebsSection';section.className='ob-settings-section';body.appendChild(section)}
    section.innerHTML=`<div class="ob-settings-section-head"><strong>🌐 Webs favoritas</strong><p>Añade las páginas que tú quieras. OneBase intentará localizar automáticamente su buscador cuando selecciones un anime.</p></div><div class="ob-custom-webs-entry"><div class="ob-custom-webs-copy"><strong>Mis webs</strong><span>Las webs se guardan de forma independiente para cada perfil.</span></div><button type="button" class="ob-custom-webs-add" id="obCustomWebAdd">＋ Añadir web</button></div><div class="ob-custom-count">${sources.length}/${MAX_WEBS} webs configuradas</div><div class="ob-custom-webs-list" id="obCustomWebList"></div>`;
    const list=section.querySelector('#obCustomWebList');if(!sources.length)list.innerHTML='<div class="ob-custom-empty">Todavía no has añadido ninguna web.</div>';else list.innerHTML=sources.map(x=>`<div class="ob-custom-web-item"><div class="ob-custom-web-copy"><strong>${esc(x.name)}</strong><code>${esc(x.homepage)}</code></div><button type="button" class="ob-custom-web-delete" data-custom-web-delete="${esc(x.id)}">Eliminar</button></div>`).join('');
    section.querySelector('#obCustomWebAdd').addEventListener('click',openAdd);section.querySelectorAll('[data-custom-web-delete]').forEach(b=>b.addEventListener('click',()=>{const x=sources.find(v=>v.id===b.dataset.customWebDelete);if(!x)return;if(!window.confirm(`¿Eliminar la web "${x.name}" de tus webs favoritas?`))return;sources=sources.filter(v=>v.id!==x.id);save();renderSettingsSection();if(window.toast)window.toast('Web eliminada')}));
  }

  function animeTitle(){return String(document.getElementById('sourceAnime')?.textContent||document.getElementById('sourceAnime')?.value||'').trim();}
  async function openCustomSource(source){
    const title=animeTitle(),modal=document.getElementById('sourceModal'),button=document.querySelector(`[data-custom-web="${CSS.escape(source.id)}"]`);if(!title){if(window.toast)window.toast('No se ha podido identificar el anime.');return}
    const original=button?.textContent||source.name;if(button){button.textContent='Buscando…';button.classList.add('ob-custom-loading')}
    try{
      const r=await fetch(`/api/resolve-web-search?url=${encodeURIComponent(source.homepage)}&query=${encodeURIComponent(title)}`,{headers:{accept:'application/json'}});const result=await r.json().catch(()=>({}));
      if(!r.ok||!result.ok||!result.url)throw new Error(result.error||'No se ha podido localizar el buscador.');window.open(result.url,'_blank','noopener,noreferrer');modal?.classList.add('hidden');
    }catch(_){if(window.confirm(`OneBase no ha podido localizar automáticamente el buscador de ${source.name}.\n\n¿Quieres abrir la web principal para buscarlo manualmente?`))window.open(source.homepage,'_blank','noopener,noreferrer')}
    finally{if(button){button.textContent=original;button.classList.remove('ob-custom-loading')}}
  }
  function injectSourceButtons(){
    const choices=document.querySelector('#sourceModal .sourceChoices');if(!choices)return;choices.querySelectorAll('[data-custom-web]').forEach(e=>e.remove());sources.forEach(source=>{const b=document.createElement('button');b.type='button';b.dataset.customWeb=source.id;b.textContent=source.name;b.addEventListener('click',()=>openCustomSource(source));choices.appendChild(b)});
  }
  function refresh(){load();renderSettingsSection();injectSourceButtons()}
  function boot(){css();refresh();const observer=new MutationObserver(()=>{renderSettingsSection();injectSourceButtons()});observer.observe(document.body,{childList:true,subtree:true});window.addEventListener('onebase:custom-webs-changed',refresh);window.addEventListener('storage',e=>{if(e.key===STORAGE)refresh()});}
  window.OneBaseCustomWebs={getAll:()=>sources.slice(),reload:refresh};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
