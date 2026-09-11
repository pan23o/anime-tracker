/* OneBase · Fuentes predeterminadas
 * Nyaa, SubPlease y EXT.to usan el mismo resolvedor automático.
 */
(function(){
  'use strict';
  const DEFAULTS=[
    {id:'default-nyaa',name:'Nyaa',homepage:'https://nyaa.si'},
    {id:'default-subplease',name:'SubPlease',homepage:'https://subplease.org'},
    {id:'default-ext',name:'EXT.to',homepage:'https://ext.to'}
  ];

  function title(){return String(document.getElementById('sourceAnime')?.textContent||document.getElementById('sourceAnime')?.value||'').trim()}

  function showFailure(source, retry){
    document.getElementById('onebase-source-failure')?.remove();
    const m=document.createElement('div');m.id='onebase-source-failure';
    m.style.cssText='position:fixed;inset:0;z-index:12000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)';
    m.innerHTML=`<div style="width:min(520px,94vw);box-sizing:border-box;background:var(--panel,#111);color:var(--text,#fff);border:1px solid var(--line2,#353535);border-radius:18px;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.65)">
      <div style="font-size:18px;font-weight:800;margin-bottom:8px">No se han encontrado coincidencias</div>
      <div style="color:var(--muted,#9299a3);font-size:12px;line-height:1.6;margin-bottom:20px">OneBase ha buscado <b>${String(source.name).replace(/[&<>]/g,'')}</b>, pero no ha encontrado el anime o episodios disponibles en esa web.</div>
      <div style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap">
        <button type="button" data-ob-retry style="padding:10px 14px;border-radius:10px;border:1px solid var(--accent,#d6a84f);background:var(--accent,#d6a84f);color:#080808;font-weight:800;cursor:pointer">↻ Volver a intentarlo</button>
        <button type="button" data-ob-other style="padding:10px 14px;border-radius:10px;border:1px solid var(--line2,#353535);background:var(--soft,#1c1c1c);color:var(--text,#fff);font-weight:800;cursor:pointer">🌐 Elegir otra web</button>
      </div>
    </div>`;
    document.body.appendChild(m);
    m.querySelector('[data-ob-retry]').onclick=()=>{m.remove();retry()};
    m.querySelector('[data-ob-other]').onclick=()=>{m.remove();document.getElementById('sourceModal')?.classList.remove('hidden');document.getElementById('sourceModal')?.classList.add('open')};
  }

  async function search(source, button){
    const t=title();if(!t){if(window.toast)window.toast('No se ha podido identificar el anime.');return}
    const old=button.textContent;button.textContent='Buscando…';button.disabled=true;
    try{
      const r=await fetch(`/api/resolve-web-search?url=${encodeURIComponent(source.homepage)}&query=${encodeURIComponent(t)}`,{headers:{accept:'application/json'}});
      const data=await r.json().catch(()=>({}));
      if(!r.ok||!data.ok||!data.url)throw new Error(data.error||'No se ha encontrado el buscador.');
      if(data.found===false||data.hasEpisodes===false){showFailure(source,()=>search(source,button));return}
      window.open(data.url,'_blank','noopener,noreferrer');document.getElementById('sourceModal')?.classList.add('hidden');
    }catch(_){
      showFailure(source,()=>search(source,button));
    }finally{button.textContent=old;button.disabled=false}
  }

  function buttonFor(source){const b=document.createElement('button');b.type='button';b.dataset.onebaseDefaultWeb=source.id;b.textContent=source.name;b.addEventListener('click',()=>search(source,b));return b}

  function inject(){
    const c=document.querySelector('#sourceModal .sourceChoices');if(!c)return;
    /* Elimina los botones antiguos que hacían la búsqueda directa. Conserva únicamente los nuevos. */
    c.querySelectorAll('button').forEach(b=>{if(!b.dataset.onebaseDefaultWeb&&!b.dataset.customWeb&&/^(Nyaa|SubPlease|EXT\.to)$/i.test((b.textContent||'').trim()))b.remove()});
    DEFAULTS.forEach(s=>{if(!c.querySelector(`[data-onebase-default-web="${CSS.escape(s.id)}"]`))c.appendChild(buttonFor(s))});
  }
  function boot(){inject();new MutationObserver(inject).observe(document.body,{childList:true,subtree:true})}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
