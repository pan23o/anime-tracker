/* OneBase · Webs favoritas por usuario — v2
 * URL de búsqueda: debe ser HTTP/HTTPS y contener {query}.
 * {query} = anime + episodio actual; {episode} = episodio actual.
 * Ejemplo: https://ejemplo.com/search?q={query}
 */
(function(){
  'use strict';
  const KEY='onebase_custom_webs_v2', MAX=30;
  let userKey='default', sources=[];

  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const id=()=>{try{return crypto.randomUUID()}catch(_){return 'web_'+Date.now()+'_'+Math.random().toString(36).slice(2)}};

  function getUserKey(){
    try{
      const p=JSON.parse(localStorage.getItem('anime_tracker_profile_v1')||'{}');
      return String(p?.email||'').trim().toLowerCase()||'default';
    }catch(_){return 'default'}
  }
  function all(){
    try{
      const x=JSON.parse(localStorage.getItem(KEY)||'{}');
      return Array.isArray(x)?{default:x}:(x&&typeof x==='object'?x:{});
    }catch(_){return {}}
  }
  function load(){
    userKey=getUserKey();
    const db=all();
    sources=Array.isArray(db[userKey])?db[userKey]:[];
    if(userKey!=='default'&&!sources.length&&Array.isArray(db.default)&&db.default.length){
      sources=db.default.map(x=>({...x,id()})); save();
    }
  }
  function save(){
    const db=all();db[userKey]=sources.slice(0,MAX);
    try{localStorage.setItem(KEY,JSON.stringify(db))}catch(_){ }
    window.dispatchEvent(new CustomEvent('onebase:custom-webs-changed'));
  }
  function valid(url){
    try{const u=new URL(url);return /^https?:$/.test(u.protocol)&&url.includes('{query}')}catch(_){return false}
  }
  function makeUrl(template,title,episode){
    const ep=Number(episode)||0;
    const query=encodeURIComponent(ep?`${title} ${ep}`:title);
    return template.replaceAll('{query}',query).replaceAll('{episode}',encodeURIComponent(ep?String(ep):''));
  }
  function toast(msg){if(window.toast)window.toast(msg)}

  function styles(){
    if(document.getElementById('ob-custom-webs-v2-css'))return;
    const s=document.createElement('style');s.id='ob-custom-webs-v2-css';s.textContent=`
      #onebaseCustomWebModal{position:fixed;inset:0;z-index:10200;display:none;place-items:center;padding:20px;background:rgba(0,0,0,.76);backdrop-filter:blur(9px)}
      #onebaseCustomWebModal.open{display:grid}.obcw-dialog{width:min(540px,94vw);background:var(--panel,#111);color:var(--text,#f5f5f5);border:1px solid var(--line2,#353535);border-radius:18px;padding:22px;box-shadow:0 30px 90px rgba(0,0,0,.65)}
      .obcw-head{display:flex;justify-content:space-between;align-items:center}.obcw-head h2{margin:0;font-size:18px}.obcw-close{border:0;background:none;color:var(--muted,#888);font-size:25px;cursor:pointer}.obcw-help{color:var(--muted,#888);font-size:9px;line-height:1.6;margin:7px 0 16px}
      .obcw-field{display:grid;gap:6px;margin:11px 0}.obcw-field label{font-size:9px;color:var(--muted,#888);font-weight:800;letter-spacing:1px;text-transform:uppercase}.obcw-field input{width:100%;padding:11px;border:1px solid var(--line2,#353535);border-radius:10px;background:var(--soft,#1c1c1c);color:var(--text,#f5f5f5);outline:none;font-size:11px}.obcw-field input:focus{border-color:var(--accent,#d6a84f)}
      .obcw-note{color:var(--muted,#888);font-size:8px;line-height:1.55}.obcw-note code{color:var(--text,#fff)}.obcw-error{height:15px;margin-top:7px;color:#ffbaba;font-size:9px}.obcw-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.obcw-actions button{padding:10px 13px;border:1px solid var(--line2,#353535);border-radius:10px;background:var(--soft,#1c1c1c);color:var(--text,#fff);font-size:10px;font-weight:800;cursor:pointer}.obcw-actions .primary{background:var(--accent,#d6a84f);color:#080808;border-color:var(--accent,#d6a84f)}
      .obcw-entry{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:15px 17px;border-top:1px solid var(--line,#292929)}.obcw-entry-copy strong{display:block;font-size:11px}.obcw-entry-copy span{display:block;margin-top:4px;color:var(--muted,#888);font-size:9px}.obcw-add{padding:9px 12px;border:1px solid var(--line2,#353535);border-radius:10px;background:var(--soft,#1c1c1c);color:var(--text,#fff);font-size:10px;font-weight:800;cursor:pointer;white-space:nowrap}.obcw-list{display:grid;gap:7px;padding:0 17px 14px}.obcw-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 11px;border:1px solid var(--line,#292929);border-radius:10px;background:var(--panel,#111)}.obcw-item strong{display:block;font-size:10px}.obcw-item code{display:block;max-width:480px;margin-top:3px;color:var(--muted,#888);font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.obcw-delete{padding:7px 9px;border:1px solid #5a3030;border-radius:8px;background:rgba(100,20,20,.12);color:#ffbaba;font-size:9px;font-weight:800;cursor:pointer}.obcw-empty,.obcw-count{color:var(--muted,#888);font-size:8px}.obcw-count{padding:0 17px 10px}
      body.onebase-light-theme #onebaseCustomWebModal{background:rgba(255,255,255,.75)}body.onebase-light-theme .obcw-dialog{background:#fff;color:#050505;border-color:#050505}.onebase-light-theme .obcw-field input{background:#fff;color:#050505;border:2px solid #050505}.onebase-light-theme .obcw-note code{color:#050505}.onebase-light-theme .obcw-delete{color:#8a0000;border-color:#8a0000}
      @media(max-width:600px){.obcw-entry{align-items:flex-start;flex-direction:column}.obcw-add{width:100%}.obcw-item code{max-width:230px}}
    `;document.head.appendChild(s);
  }

  function modal(){
    if(document.getElementById('onebaseCustomWebModal'))return;
    const m=document.createElement('div');m.id='onebaseCustomWebModal';m.innerHTML=`<div class="obcw-dialog" role="dialog" aria-modal="true"><div class="obcw-head"><h2>🌐 Añadir web</h2><button class="obcw-close" id="obcwClose">×</button></div><p class="obcw-help">Añade una web donde busques anime. <b>Importante:</b> no pongas la página de inicio; pon la URL que utiliza la web para realizar una búsqueda.</p><div class="obcw-field"><label>Nombre de web</label><input id="obcwName" maxlength="60" placeholder="Ej.: Mi web favorita"></div><div class="obcw-field"><label>URL de búsqueda</label><input id="obcwUrl" maxlength="1000" placeholder="https://ejemplo.com/search?q={query}"></div><div class="obcw-note">La URL debe empezar por <code>http://</code> o <code>https://</code> y contener <code>{query}</code>. Si la web admite el episodio por separado, puedes usar también <code>{episode}</code>.</div><div class="obcw-error" id="obcwError"></div><div class="obcw-actions"><button id="obcwCancel">Cancelar</button><button class="primary" id="obcwSave">Añadir web</button></div></div>`;document.body.appendChild(m);
    const close=()=>m.classList.remove('open');document.getElementById('obcwClose').onclick=close;document.getElementById('obcwCancel').onclick=close;document.getElementById('obcwSave').onclick=add;document.getElementById('obcwUrl').onkeydown=e=>{if(e.key==='Enter')add()};m.onclick=e=>{if(e.target===m)close()};
  }
  function openAdd(){modal();document.getElementById('obcwName').value='';document.getElementById('obcwUrl').value='';document.getElementById('obcwError').textContent='';document.getElementById('onebaseCustomWebModal').classList.add('open');setTimeout(()=>document.getElementById('obcwName').focus(),20)}
  function add(){
    const name=document.getElementById('obcwName').value.trim(),url=document.getElementById('obcwUrl').value.trim(),err=document.getElementById('obcwError');err.textContent='';
    if(!name){err.textContent='Escribe el nombre de la web.';return}if(sources.length>=MAX){err.textContent=`Máximo ${MAX} webs.`;return}if(!valid(url)){err.textContent='La URL debe ser http/https y contener {query}.';return}
    if(sources.some(x=>x.name.toLowerCase()===name.toLowerCase()||x.template.toLowerCase()===url.toLowerCase())){err.textContent='Esa web ya está añadida.';return}
    let host='';try{host=new URL(url).hostname}catch(_){ }
    sources.push({id:id(),name:name.slice(0,60),template:url,host,createdAt:Date.now()});save();document.getElementById('onebaseCustomWebModal').classList.remove('open');renderSettings();injectSources();toast(`✓ ${name} añadida`);
  }

  function renderSettings(){
    const overlay=document.getElementById('onebaseSettingsOverlay');const body=overlay?.querySelector('.ob-settings-body');if(!body)return;
    let sec=document.getElementById('onebaseCustomWebsSection');if(!sec){sec=document.createElement('section');sec.id='onebaseCustomWebsSection';sec.className='ob-settings-section';body.appendChild(sec)}
    sec.innerHTML=`<div class="ob-settings-section-head"><strong>🌐 Webs favoritas</strong><p>Añade tus propias webs de búsqueda. Solo tú las verás en tus opciones.</p></div><div class="obcw-entry"><div class="obcw-entry-copy"><strong>Mis webs</strong><span>${sources.length}/${MAX} configuradas · puedes añadirlas o eliminarlas cuando quieras.</span></div><button class="obcw-add" id="obcwAdd" type="button">＋ Añadir web</button></div><div class="obcw-list" id="obcwList"></div>`;
    const list=sec.querySelector('#obcwList');
    if(!sources.length)list.innerHTML='<div class="obcw-empty">No tienes ninguna web personalizada todavía.</div>';
    else list.innerHTML=sources.map(x=>`<div class="obcw-item"><div><strong>${esc(x.name)}</strong><code>${esc(x.template)}</code></div><button class="obcw-delete" data-id="${esc(x.id)}" type="button">Eliminar</button></div>`).join('');
    sec.querySelector('#obcwAdd').onclick=openAdd;
    sec.querySelectorAll('.obcw-delete').forEach(b=>b.onclick=()=>{const x=sources.find(v=>v.id===b.dataset.id);if(!x)return;if(!confirm(`¿Eliminar "${x.name}"?`))return;sources=sources.filter(v=>v.id!==x.id);save();renderSettings();injectSources();toast('Web eliminada')});
  }

  function currentAnimeAndEpisode(){
    const title=(document.getElementById('sourceAnime')?.textContent||'').trim();let ep=0;
    for(const row of document.querySelectorAll('#rows .row')){
      const name=(row.querySelector('.animeLink')?.textContent||'').trim();
      if(name.toLowerCase()===title.toLowerCase()){ep=Number(row.querySelector('.watched')?.value)||0;break}
    }
    return {title,ep};
  }
  function injectSources(){
    const choices=document.querySelector('#sourceModal .sourceChoices');if(!choices)return;
    choices.querySelectorAll('[data-custom-web]').forEach(x=>x.remove());
    sources.forEach(x=>{const b=document.createElement('button');b.type='button';b.dataset.customWeb=x.id;b.textContent=x.name;b.onclick=()=>{const {title,ep}=currentAnimeAndEpisode();const url=makeUrl(x.template,title,ep);window.open(url,'_blank','noopener,noreferrer');document.getElementById('sourceModal')?.classList.add('hidden')};choices.appendChild(b)});
  }

  function boot(){
    styles();load();modal();injectSources();
    document.addEventListener('click',e=>{if(e.target.closest?.('#onebaseSettingsButton'))setTimeout(renderSettings,40)},true);
    // El perfil abre la ventana antigua de perfil; no inyectamos nada allí.
    document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('onebaseCustomWebModal')?.classList.remove('open')});
    window.addEventListener('onebase:custom-webs-changed',()=>{load();renderSettings();injectSources()});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
  window.OneBaseCustomWebs={get:()=>sources.slice(),openAdd,reload:load};
})();
