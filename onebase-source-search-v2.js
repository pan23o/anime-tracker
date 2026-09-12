/* OneBase · búsqueda de fuentes v8
   Nyaa y EXT.to: primero buscan por anime + español, sin añadir episodios del tracker.
   Si no aparece una coincidencia española, no abre nada: muestra una elección para
   buscar solo el anime o volver al selector. Esto evita falsos episodios como "170".
   SubPlease: mantiene el resolvedor v2 existente.
   No se observa el body: el modal se normaliza solo al arrancar o cuando cambian webs.
*/
(function(){'use strict';
const DEFAULTS=[{id:'default-nyaa',name:'Nyaa',homepage:'https://nyaa.si'},{id:'default-subplease',name:'SubPlease',homepage:'https://subplease.org'},{id:'default-ext',name:'EXT.to',homepage:'https://ext.to'}];
const DEFAULT_NAMES=new Set(['nyaa','subplease','subsplease','ext.to','ext']);
const DEFAULT_HOSTS=new Set(['nyaa.si','subsplease.org','subplease.org','ext.to']);
let rebuilding=false,booted=false;
function norm(v){return String(v||'').trim().toLowerCase().replace(/^www\./,'').replace(/\/$/,'')}
function animeTitle(){return String(document.getElementById('sourceAnime')?.textContent||document.getElementById('sourceAnime')?.value||'').trim()}
function hostOfButton(b){try{const id=b?.dataset?.customWeb;if(!id)return'';const x=window.OneBaseCustomWebs?.get?.().find(v=>v.id===id);return norm(new URL(x?.homepage||'').hostname)}catch(_){return''}}
function isDefaultButton(b){const text=norm(b?.textContent);return DEFAULT_NAMES.has(text)||text.includes('subplease')||DEFAULT_HOSTS.has(hostOfButton(b))||!!b?.dataset?.onebaseDefaultWeb||!!b?.dataset?.source}
function removeLegacyFooter(modal){modal.querySelectorAll('*').forEach(el=>{if(el.id==='sourceHint'||el.closest('.sourceChoices'))return;if(el.children.length)return;const t=String(el.textContent||'').trim();if(/^(Nyaa|SubPlease|SubsPlease)\s*:/i.test(t))el.remove()})}
function createDefaultButton(source){const b=document.createElement('button');b.type='button';b.dataset.onebaseDefaultWeb=source.id;b.textContent=source.name;return b}
function rebuildModal(){const modal=document.getElementById('sourceModal');const c=modal?.querySelector('.sourceChoices');if(!c||rebuilding)return;rebuilding=true;try{const custom=[];c.querySelectorAll('button[data-custom-web]').forEach(b=>{if(!isDefaultButton(b))custom.push(b)});c.querySelectorAll('button').forEach(b=>{if(isDefaultButton(b)||!b.dataset.customWeb)b.remove()});DEFAULTS.forEach(s=>c.appendChild(createDefaultButton(s)));custom.forEach(b=>c.appendChild(b));removeLegacyFooter(modal)}finally{rebuilding=false}}
function close(){document.getElementById('sourceModal')?.classList.add('hidden')}
function openSelector(){document.getElementById('sourceModal')?.classList.remove('hidden');rebuildModal()}
function escapeHtml(s){return String(s||'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function failure(source,retry){document.getElementById('onebase-source-failure-v8')?.remove();const m=document.createElement('div');m.id='onebase-source-failure-v8';m.style.cssText='position:fixed;inset:0;z-index:13000;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.78);backdrop-filter:blur(8px)';m.innerHTML=`<div style="width:min(540px,94vw);box-sizing:border-box;background:var(--panel,#111);color:var(--text,#fff);border:1px solid var(--line2,#353535);border-radius:18px;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.65)"><div style="font-size:18px;font-weight:800;margin-bottom:8px">No se han encontrado coincidencias</div><div style="color:var(--muted,#9299a3);font-size:12px;line-height:1.6;margin-bottom:20px">No se ha podido confirmar el anime o episodio solicitado en <b>${escapeHtml(source?.name||'esta web')}</b>.</div><div style="display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap"><button type="button" data-ob-v8-retry style="padding:10px 14px;border-radius:10px;border:1px solid var(--accent,#d6a84f);background:var(--accent,#d6a84f);color:#080808;font-weight:800;cursor:pointer">↻ Volver a intentarlo</button><button type="button" data-ob-v8-other style="padding:10px 14px;border-radius:10px;border:1px solid var(--line2,#353535);background:var(--soft,#1c1c1c);color:var(--text,#fff);font-weight:800;cursor:pointer">🌐 Elegir otra web</button></div></div>`;document.body.appendChild(m);m.querySelector('[data-ob-v8-retry]').onclick=()=>{m.remove();retry()};m.querySelector('[data-ob-v8-other]').onclick=()=>{m.remove();openSelector()}}
function spanishFallback(source,fallbackUrl){document.getElementById('onebase-spanish-fallback-v8')?.remove();const m=document.createElement('div');m.id='onebase-spanish-fallback-v8';m.style.cssText='position:fixed;inset:0;z-index:13100;display:grid;place-items:center;padding:20px;background:rgba(0,0,0,.80);backdrop-filter:blur(8px)';m.innerHTML=`<div style="width:min(520px,94vw);box-sizing:border-box;background:var(--panel,#111);color:var(--text,#fff);border:1px solid var(--line2,#353535);border-radius:18px;padding:24px;box-shadow:0 30px 90px rgba(0,0,0,.65)"><div style="font-size:18px;font-weight:800;margin-bottom:8px">No se ha encontrado en español</div><div style="color:var(--muted,#9299a3);font-size:12px;line-height:1.65;margin-bottom:18px">No se han encontrado resultados confirmados con subtítulos en español para <b>${escapeHtml(animeTitle())}</b> en <b>${escapeHtml(source.name)}</b>.</div><div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap"><button type="button" data-ob-v8-view style="padding:10px 15px;border-radius:10px;border:1px solid var(--accent,#d6a84f);background:var(--accent,#d6a84f);color:#080808;font-weight:800;cursor:pointer">Ver</button><button type="button" data-ob-v8-back style="padding:10px 15px;border-radius:10px;border:1px solid var(--line2,#353535);background:var(--soft,#1c1c1c);color:var(--text,#fff);font-weight:800;cursor:pointer">Atrás</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:9px;color:var(--muted,#777);font-size:8px;line-height:1.45;text-align:center"><span>Ver: busca el anime solo por su nombre, sin exigir español.</span><span>Atrás: vuelve al selector para elegir otra web.</span></div></div>`;document.body.appendChild(m);m.querySelector('[data-ob-v8-view]').onclick=()=>{m.remove();if(fallbackUrl){window.open(fallbackUrl,'_blank','noopener,noreferrer');close()}};m.querySelector('[data-ob-v8-back]').onclick=()=>{m.remove();openSelector()}}
async function requestJson(path){const r=await fetch(path,{headers:{accept:'application/json'},cache:'no-store'});const d=await r.json().catch(()=>({}));return{r,d}}
async function search(source,button){const title=animeTitle();if(!title){window.toast?.('No se ha podido identificar el anime.');return}const old=button?.textContent||source.name;if(button){button.textContent='Buscando…';button.disabled=true}try{const host=norm(new URL(source.homepage).hostname);let r,d;
  if(host==='nyaa.si'||host==='ext.to'){
    const p=new URLSearchParams({url:source.homepage,query:title});
    ({r,d}=await requestJson(`/api/resolve-spanish-search?${p.toString()}`));
    if(!r.ok||!d.ok||!d.url)throw new Error(d.error||'No se ha podido construir la búsqueda.');
    if(d.languageFound===false){spanishFallback(source,d.fallbackUrl||d.url);return}
    window.open(d.url,'_blank','noopener,noreferrer');close();return;
  }
  const p=new URLSearchParams({url:source.homepage,query:title});
  ({r,d}=await requestJson(`/api/resolve-web-search-v2?${p.toString()}`));
  if(!r.ok||!d.ok||!d.url)throw new Error(d.error||'No se ha podido construir la búsqueda.');
  if(d.found===false||d.hasEpisodes===false){failure(source,()=>search(source,button));return}
  window.open(d.url,'_blank','noopener,noreferrer');close()
}catch(_){failure(source,()=>search(source,button))}finally{if(button){button.textContent=old;button.disabled=false}}}
function intercept(e){const b=e.target?.closest?.('#sourceModal .sourceChoices button');if(!b)return;const id=b.dataset.onebaseDefaultWeb;if(!id)return;const source=DEFAULTS.find(x=>x.id===id);if(!source)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();search(source,b)}
function boot(){if(booted)return;booted=true;document.addEventListener('click',intercept,true);rebuildModal();window.addEventListener('onebase:custom-webs-changed',()=>setTimeout(rebuildModal,0));window.OneBaseSourceSearchV2={getContext:()=>({title:animeTitle(),episode:0}),search,rebuildModal};window.OneBaseSourceFailure=failure}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
