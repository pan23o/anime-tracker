/* OneBase · Fuentes predeterminadas
 * Las fuentes oficiales usan el mismo resolvedor que las webs personalizadas:
 * el usuario no necesita conocer sus URLs internas de búsqueda.
 */
(function(){
  'use strict';
  const DEFAULTS=[
    {id:'default-nyaa',name:'Nyaa',homepage:'https://nyaa.si'},
    {id:'default-subplease',name:'SubPlease',homepage:'https://subplease.org'},
    {id:'default-ext',name:'EXT.to',homepage:'https://ext.to'}
  ];
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  function title(){return String(document.getElementById('sourceAnime')?.textContent||document.getElementById('sourceAnime')?.value||'').trim()}
  function buttonFor(source){
    const b=document.createElement('button');b.type='button';b.dataset.onebaseDefaultWeb=source.id;b.textContent=source.name;
    b.addEventListener('click',async()=>{
      const t=title();if(!t){if(window.toast)window.toast('No se ha podido identificar el anime.');return}
      const old=b.textContent;b.textContent='Buscando…';b.disabled=true;
      try{
        const r=await fetch(`/api/resolve-web-search?url=${encodeURIComponent(source.homepage)}&query=${encodeURIComponent(t)}`,{headers:{accept:'application/json'}});
        const data=await r.json().catch(()=>({}));
        if(!r.ok||!data.ok||!data.url)throw new Error(data.error||'No se ha encontrado el buscador.');
        window.open(data.url,'_blank','noopener,noreferrer');document.getElementById('sourceModal')?.classList.add('hidden');
      }catch(_){
        if(window.confirm(`OneBase no ha podido localizar automáticamente el buscador de ${source.name}.\n\n¿Quieres abrir la web principal para buscarlo manualmente?`))window.open(source.homepage,'_blank','noopener,noreferrer');
      }finally{b.textContent=old;b.disabled=false}
    });
    return b;
  }
  function inject(){
    const c=document.querySelector('#sourceModal .sourceChoices');if(!c)return;
    DEFAULTS.forEach(s=>{if(!c.querySelector(`[data-onebase-default-web="${CSS.escape(s.id)}"]`))c.appendChild(buttonFor(s));});
  }
  function boot(){
    inject();
    const obs=new MutationObserver(()=>inject());obs.observe(document.body,{childList:true,subtree:true});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
