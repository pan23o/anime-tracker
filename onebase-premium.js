/* ONEBASE Premium layer v1
 * Dashboard + advanced filters + episode tracker + public profile + health + premium motion.
 * Deliberately avoids global MutationObserver and continuous DOM scanning.
 */
(function(){
'use strict';

const SUPABASE_URL='https://djfjqecahztogacliavh.supabase.co';
const SUPABASE_KEY='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const PUBLIC_KEY='onebase_public_profile_v1';
const STATUS={viendo:'Viendo',terminado:'Terminado',pendiente:'Pendiente',pausa:'En pausa',abandonado:'Abandonado'};
let booted=false,originalRender=null,pendingInfoIndex=null,episodeIndex=null,episodePage=0,episodeTotalPages=1,airingTimer=0,publicTimer=0;
let publicState=loadLocalPublic();
let supa=null;

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const txt=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const getData=()=>Array.isArray(window.__ONEBASE_DATA__)?window.__ONEBASE_DATA__:[];
const fmt=n=>new Intl.NumberFormat('es-ES').format(Math.round(Number(n)||0));
const profileLocal=()=>{try{return JSON.parse(localStorage.getItem('anime_tracker_profile_v1')||'{}')||{}}catch(_){return{}}};
const safeTransition=fn=>{
  if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||typeof document.startViewTransition!=='function'){fn();return}
  try{document.startViewTransition(fn)}catch(_){fn()}
};
function loadLocalPublic(){try{const v=JSON.parse(localStorage.getItem(PUBLIC_KEY)||'{}');return{enabled:Boolean(v.enabled),bio:String(v.bio||'').slice(0,280)}}catch(_){return{enabled:false,bio:''}}}
function saveLocalPublic(){try{localStorage.setItem(PUBLIC_KEY,JSON.stringify(publicState))}catch(_){}}
function supabaseClient(){
  if(supa)return supa;
  try{if(window.supabase?.createClient)supa=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}catch(e){console.warn('[ONEBASE] premium Supabase client',e)}
  return supa;
}
async function currentUser(){
  const c=supabaseClient();if(!c)return null;
  try{const r=await c.auth.getUser();return r?.data?.user||null}catch(_){return null}
}
function stats(list=getData()){
  const filled=list.filter(x=>x&&String(x.anime||'').trim());
  const chapters=filled.reduce((s,x)=>s+(Number(x.watched)||0),0);
  const total=filled.reduce((s,x)=>s+(Number(x.total)||0),0);
  const completed=filled.filter(x=>x.total!==''&&Number(x.watched)>=Number(x.total)).length;
  const favorites=filled.filter(x=>x.favorite).length;
  const rated=filled.filter(x=>x.score!==''&&Number.isFinite(Number(x.score)));
  const avg=rated.length?rated.reduce((s,x)=>s+Number(x.score),0)/rated.length:0;
  const pending=filled.reduce((s,x)=>s+Math.max(0,(Number(x.total)||0)-(Number(x.watched)||0)),0);
  const active=filled.filter(x=>x.state==='viendo').length;
  const hours=filled.reduce((s,x)=>s+((Number(x.watched)||0)*(Number(x.durationMin)||0))/60,0);
  return{filled,chapters,total,completed,favorites,rated: rated.length,avg,pending,active,hours};
}
function ensureHome(){
  if($('#onebaseHomePanel'))return;
  const toolbar=$('.toolbar');if(!toolbar)return;
  const panel=document.createElement('section');panel.id='onebaseHomePanel';panel.className='onebase-home-panel onebase-premium-enter';
  panel.innerHTML='<article class="onebase-home-card"><div class="onebase-home-head"><h3>▶ Continuar viendo</h3><span data-ob-count></span></div><div class="onebase-home-list" data-ob-continue></div></article><article class="onebase-home-card"><div class="onebase-home-head"><h3>◷ Próximos episodios</h3><span>seguimiento AniList</span></div><div class="onebase-home-list" data-ob-airing></div></article>';
  toolbar.parentNode.insertBefore(panel,toolbar.nextSibling);
}
function miniCard(item,index,kind){
  const cover=String(item.cover||item.coverImage||'').trim();
  const watched=Number(item.watched)||0,total=Number(item.total)||0;
  let sub=total?String(watched)+' / '+String(total)+' episodios':(STATUS[item.state]||'Sin progreso');
  let time='';
  if(kind==='airing')time=formatRemaining(Number(item.nextAiringAt)||0);
  else if(item.score!=='')sub+=' · '+Number(item.score).toFixed(1)+'/10';
  return '<button type="button" class="onebase-mini" data-ob-open="'+index+'"><span class="onebase-mini-cover">'+(cover?'<img loading="lazy" src="'+esc(cover)+'" alt="">':'SIN PORTADA')+'</span><span><strong class="onebase-mini-title">'+esc(item.anime)+'</strong><span class="onebase-mini-sub">'+esc(sub)+'</span></span>'+(time?'<span class="onebase-mini-time">'+esc(time)+'</span>':'<span class="onebase-mini-time">›</span>')+'</button>';
}
function formatRemaining(ts){
  if(!ts)return '—';
  const diff=Math.floor((ts*1000-Date.now())/1000);
  if(diff<=0)return 'YA';
  const d=Math.floor(diff/86400),h=Math.floor(diff%86400/3600),m=Math.floor(diff%3600/60);
  if(d)return d+'d '+h+'h';
  if(h)return h+'h '+m+'m';
  return Math.max(1,m)+'m';
}
function renderHome(){
  ensureHome();
  const list=getData().filter(x=>String(x?.anime||'').trim());
  const cont=list.filter(x=>x.state==='viendo'&&Number(x.total||0)>Number(x.watched||0)).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0)).slice(0,6);
  const airing=list.filter(x=>Number(x.nextAiringAt)>0&&Number(x.nextAiringEpisode)>0&&Number(x.nextAiringAt)*1000>Date.now()-86400000).sort((a,b)=>(Number(a.nextAiringAt)||0)-(Number(b.nextAiringAt)||0)).slice(0,6);
  const c=$('[data-ob-continue]'),a=$('[data-ob-airing]');
  if(c)c.innerHTML=cont.length?cont.map(x=>miniCard(x,list.indexOf(x),'continue')).join(''):'<div class="onebase-empty">No tienes series activas con episodios pendientes.</div>';
  if(a)a.innerHTML=airing.length?airing.map(x=>miniCard(x,list.indexOf(x),'airing')).join(''):'<div class="onebase-empty">No hay próximos episodios registrados.</div>';
  const count=$('[data-ob-count]');if(count)count.textContent=cont.length?cont.length+' activas':'todo al día';
}
function openInfoIndex(i){
  const row=document.querySelector('.row[data-index="'+i+'"]');
  row?.querySelector('.infoBtn')?.click();
}
function ensureExtraFilters(){
  const toolbar=$('.toolbar');if(!toolbar||$('#onebaseExtraFilters'))return;
  const wrap=document.createElement('div');wrap.id='onebaseExtraFilters';wrap.className='onebase-toolbar-extra';
  wrap.innerHTML='<select id="onebaseGenreFilter" aria-label="Filtrar por género"><option value="all">Todos los géneros</option></select><select id="onebaseScoreFilter" aria-label="Filtrar por nota"><option value="all">Cualquier nota</option><option value="rated">Con nota personal</option><option value="8">Nota ≥ 8</option><option value="9">Nota ≥ 9</option></select><select id="onebaseProgressFilter" aria-label="Filtrar por progreso"><option value="all">Cualquier progreso</option><option value="none">Sin empezar</option><option value="active">En progreso</option><option value="complete">Completados</option><option value="new">Con episodios nuevos</option></select><select id="onebaseAiringFilter" aria-label="Filtrar por emisión"><option value="all">Cualquier emisión</option><option value="releasing">En emisión</option><option value="upcoming">Próximo episodio</option></select>';
  toolbar.appendChild(wrap);
  wrap.querySelectorAll('select').forEach(s=>s.addEventListener('change',applyAdvancedFilters));
}
function populateGenreFilter(){
  const sel=$('#onebaseGenreFilter');if(!sel)return;
  const current=sel.value;
  const genres=[...new Set(getData().flatMap(x=>Array.isArray(x?.genres)?x.genres:[]).map(x=>txt(x)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
  sel.innerHTML='<option value="all">Todos los géneros</option>'+genres.map(g=>'<option value="'+esc(g)+'">'+esc(g)+'</option>').join('');
  if(genres.includes(current))sel.value=current;
}
function applyAdvancedFilters(){
  const genre=$('#onebaseGenreFilter')?.value||'all',score=$('#onebaseScoreFilter')?.value||'all',progress=$('#onebaseProgressFilter')?.value||'all',airing=$('#onebaseAiringFilter')?.value||'all';
  document.querySelectorAll('#rows .row[data-index]').forEach(row=>{
    const i=Number(row.dataset.index),item=getData()[i];if(!item?.anime?.trim())return;
    let show=true;
    if(genre!=='all'&&!Array.isArray(item.genres))show=false;
    if(genre!=='all'&&Array.isArray(item.genres)&&!item.genres.some(g=>String(g).toLowerCase()===genre.toLowerCase()))show=false;
    const rated=item.score!==''&&Number.isFinite(Number(item.score));
    if(score==='rated'&&!rated)show=false;
    if(score==='8'&&(!rated||Number(item.score)<8))show=false;
    if(score==='9'&&(!rated||Number(item.score)<9))show=false;
    const w=Number(item.watched)||0,t=Number(item.total)||0;
    if(progress==='none'&&w>0)show=false;
    if(progress==='active'&&(w<=0||!t||w>=t))show=false;
    if(progress==='complete'&&(!t||w<t))show=false;
    if(progress==='new'&&Number(item.newEpisodes)<=0)show=false;
    if(airing==='releasing'&&String(item.apiStatus||'')!=='RELEASING')show=false;
    if(airing==='upcoming'&&!(Number(item.nextAiringAt)>0&&Number(item.nextAiringEpisode)>0&&Number(item.nextAiringAt)*1000>Date.now()))show=false;
    row.classList.toggle('onebase-advanced-hidden',!show);
  });
}
function decorateRows(){
  document.querySelectorAll('#rows .row:not(.head)').forEach((row,i)=>{
    row.style.setProperty('--onebase-row-i',String(Math.min(i,20)));
    if(row.dataset.index===undefined)row.dataset.index=String(i);
  });
}
function wrapRender(){
  if(typeof window.render!=='function'||window.render.__onebasePremium)return;
  originalRender=window.render;
  const wrapped=function(...args){
    const result=originalRender.apply(this,args);
    setTimeout(refresh,0);
    return result;
  };
  wrapped.__onebasePremium=true;window.render=wrapped;
}
function refresh(){
  try{ensureHome();ensureExtraFilters();populateGenreFilter();renderHome();decorateRows();applyAdvancedFilters();refreshCountdown();}catch(e){console.warn('[ONEBASE] premium refresh',e)}
}
function refreshCountdown(){
  clearTimeout(airingTimer);
  airingTimer=setTimeout(()=>{renderHome();refreshCountdown()},30000);
}
function ensureInfoEnhancement(){
  const modal=$('#infoModal');if(!modal||modal.dataset.onebasePremium==='1')return;
  modal.dataset.onebasePremium='1';
  const card=modal.querySelector('.infoCard');if(!card)return;
  card.classList.add('onebase-premium-info');
  const grid=card.querySelector('.infoGrid');if(!grid)return;
  const hero=document.createElement('div');hero.className='onebase-info-hero';hero.id='onebaseInfoHero';
  card.insertBefore(hero,grid);
  const desc=document.createElement('div');desc.className='onebase-info-description';desc.id='onebaseInfoDescription';grid.querySelector('.infoGrid>div:nth-child(2)')?.appendChild(desc);
  const statsEl=document.createElement('div');statsEl.className='onebase-info-stats';statsEl.id='onebaseInfoStats';grid.querySelector('.infoGrid>div:nth-child(2)')?.appendChild(statsEl);
  const progress=document.createElement('div');progress.className='onebase-info-progress';progress.id='onebaseInfoProgress';grid.querySelector('.infoGrid>div:nth-child(2)')?.appendChild(progress);
  const epBtn=document.createElement('button');epBtn.type='button';epBtn.className='onebase-episode-button';epBtn.id='onebaseOpenEpisodes';epBtn.textContent='▦ Abrir sistema de episodios';grid.querySelector('.infoGrid>div:nth-child(2)')?.appendChild(epBtn);
  epBtn.addEventListener('click',()=>openEpisodes(pendingInfoIndex));
}
function enhanceInfo(){
  ensureInfoEnhancement();
  const i=pendingInfoIndex,item=getData()[i];if(!item)return;
  const hero=$('#onebaseInfoHero'),desc=$('#onebaseInfoDescription'),st=$('#onebaseInfoStats'),pr=$('#onebaseInfoProgress');
  if(hero){
    const banner=String(item.bannerImage||'').trim();
    hero.innerHTML=(banner?'<img src="'+esc(banner)+'" alt="">':'')+'<div class="onebase-info-hero-content"><div class="onebase-info-hero-kicker">ONEBASE · FICHA PREMIUM</div><div class="onebase-info-hero-title">'+esc(item.anime)+'</div></div>';
  }
  if(desc)desc.textContent=txt(item.descriptionEs||item.description||'')||'Sin descripción disponible.';
  const watched=Number(item.watched)||0,total=Number(item.total)||0,remaining=Math.max(0,total-watched);
  if(st)st.innerHTML='<div class="onebase-info-stat"><b>Mi progreso</b><span>'+esc(watched)+' / '+esc(total||'—')+'</span></div><div class="onebase-info-stat"><b>Pendientes</b><span>'+esc(remaining)+'</span></div><div class="onebase-info-stat"><b>Mi nota</b><span>'+(item.score!==''?Number(item.score).toFixed(1)+'/10':'—')+'</span></div>';
  if(pr){const pct=total?Math.max(0,Math.min(100,watched/total*100)):0;pr.innerHTML='<div class="onebase-info-progress-top"><span>Progreso</span><b>'+Math.round(pct)+'%</b></div><div class="onebase-info-progress-bar"><span style="width:'+pct+'%"></span></div>'}
}
function ensureEpisodeModal(){
  if($('#onebaseEpisodesModal'))return;
  const m=document.createElement('div');m.id='onebaseEpisodesModal';m.className='onebase-episodes-modal';m.innerHTML='<div class="onebase-episodes-card" role="dialog" aria-modal="true" aria-labelledby="onebaseEpisodesTitle"><div class="onebase-episodes-head"><div><div class="onebase-episodes-kicker">ONEBASE · EPISODIOS</div><h2 class="onebase-episodes-title" id="onebaseEpisodesTitle">Episodios</h2><p class="onebase-episodes-sub" id="onebaseEpisodesSub"></p></div><button type="button" class="onebase-episodes-close" aria-label="Cerrar">×</button></div><div class="onebase-episodes-progress" id="onebaseEpisodesProgress"></div><div class="onebase-episodes-toolbar"><input id="onebaseEpisodeJump" type="number" min="1" step="1" placeholder="Episodio"><button type="button" data-ep-action="jump">Ir</button><button type="button" data-ep-action="latest">Marcar último visto</button><button type="button" data-ep-action="first">Marcar 0</button></div><div class="onebase-episode-grid" id="onebaseEpisodeGrid"></div><div class="onebase-episode-actions"><button type="button" class="primary" data-ep-action="source">Buscar este episodio</button><button type="button" data-ep-action="close">Cerrar</button></div></div>';
  document.body.appendChild(m);
  m.querySelector('.onebase-episodes-close').addEventListener('click',closeEpisodes);
  m.addEventListener('click',e=>{if(e.target===m)closeEpisodes()});
  m.querySelectorAll('[data-ep-action]').forEach(b=>b.addEventListener('click',()=>episodeAction(b.dataset.epAction)));
}
function openEpisodes(i){
  if(!Number.isInteger(i)||!getData()[i])return;
  episodeIndex=i;episodePage=Math.max(0,Math.floor((Number(getData()[i].watched)||0)/50));ensureEpisodeModal();
  safeTransition(()=>{$('#onebaseEpisodesModal').classList.add('open')});
  renderEpisodes();
}
function closeEpisodes(){safeTransition(()=>$('#onebaseEpisodesModal')?.classList.remove('open'))}
function renderEpisodes(){
  const item=getData()[episodeIndex];if(!item)return;
  const total=Math.max(0,Number(item.total)||Number(item.knownTotal)||0),watched=Math.max(0,Number(item.watched)||0);
  $('#onebaseEpisodesTitle').textContent=item.anime||'Episodios';
  $('#onebaseEpisodesSub').textContent=total?watched+' / '+total+' episodios vistos':'Este anime no tiene un total conocido.';
  const pct=total?Math.min(100,watched/total*100):0;
  $('#onebaseEpisodesProgress').innerHTML='<div class="onebase-episodes-progress-top"><span>Progreso</span><b>'+Math.round(pct)+'%</b></div><div class="onebase-episodes-progress-bar"><span style="width:'+pct+'%"></span></div>';
  const grid=$('#onebaseEpisodeGrid');if(!grid)return;
  if(!total){grid.innerHTML='<div class="onebase-empty">Añade el número total de episodios para activar el listado.</div>';return}
  episodeTotalPages=Math.max(1,Math.ceil(total/50));episodePage=Math.min(episodePage,episodeTotalPages-1);
  const start=episodePage*50+1,end=Math.min(total,start+49);
  grid.innerHTML=Array.from({length:end-start+1},(_,n)=>{const ep=start+n,isWatched=ep<=watched;return '<button type="button" class="onebase-episode '+(isWatched?'is-watched ':'')+(ep===watched?'is-current':'')+'" data-ep="'+ep+'"><span class="onebase-episode-number">EP '+ep+'</span><span class="onebase-episode-state">'+(isWatched?'VISTO':ep===watched+1?'SIGUIENTE':'PENDIENTE')+'</span></button>'}).join('');
  grid.querySelectorAll('[data-ep]').forEach(b=>b.addEventListener('click',()=>setWatchedEpisode(Number(b.dataset.ep))));
}
function setWatchedEpisode(ep){
  const item=getData()[episodeIndex];if(!item)return;
  const total=Number(item.total)||Number(item.knownTotal)||0;
  item.watched=String(total?Math.min(ep,total):Math.max(0,ep));
  item.newEpisodes=total?Math.max(0,total-Number(item.watched)):0;
  item.state=total&&Number(item.watched)>=total?'terminado':(item.state==='terminado'?'viendo':item.state||'viendo');
  item.updatedAt=Date.now();
  try{if(typeof window.save==='function')window.save({skipBackup:true})}catch(_){}
  try{window.render?.()}catch(_){}
  episodePage=Math.floor((Number(item.watched)||0)/50);
  renderEpisodes();
  window.toast?.('✓ Episodio '+item.watched+' marcado como visto.');
}
function episodeAction(action){
  const item=getData()[episodeIndex];if(!item)return;
  if(action==='close'){closeEpisodes();return}
  if(action==='source'){
    const row=document.querySelector('.row[data-index="'+episodeIndex+'"]');
    const ep=Number(item.watched)||0;
    const modal=$('#sourceModal');if(modal)modal.dataset.sourceEpisode=String(ep>0?ep:1);
    row?.querySelector('.animeLink')?.click();closeEpisodes();return;
  }
  if(action==='latest'){const t=Number(item.total)||Number(item.knownTotal)||0;if(t)setWatchedEpisode(t);return}
  if(action==='first'){setWatchedEpisode(0);return}
  if(action==='jump'){const v=Math.max(1,Number($('#onebaseEpisodeJump')?.value)||1);const t=Number(item.total)||Number(item.knownTotal)||0;if(t)episodePage=Math.floor(Math.min(v,t)-1/1/50);episodePage=Math.floor((Math.min(v,t)-1)/50);renderEpisodes()}
}
function captureInfoClick(e){
  const b=e.target?.closest?.('.infoBtn');if(!b)return;
  const row=b.closest('.row');pendingInfoIndex=row?Number(row.dataset.index):null;
  setTimeout(enhanceInfo,0);
}
function ensureHealth(){
  if($('#onebaseHealthModal'))return;
  const m=document.createElement('div');m.id='onebaseHealthModal';m.className='onebase-health-modal';m.innerHTML='<div class="onebase-health-card" role="dialog" aria-modal="true" aria-labelledby="onebaseHealthTitle"><div class="onebase-health-head"><div><div class="onebase-health-kicker">ONEBASE · DIAGNÓSTICO</div><h2 class="onebase-health-title" id="onebaseHealthTitle">OneBase Health</h2><p class="onebase-health-sub">Pruebas rápidas de la interfaz, persistencia, API y módulos opcionales.</p></div><button type="button" class="onebase-health-close" aria-label="Cerrar">×</button></div><div class="onebase-health-grid" id="onebaseHealthGrid"></div><div class="onebase-health-summary" id="onebaseHealthSummary">Pulsa «Ejecutar diagnóstico» para empezar.</div><div class="onebase-health-actions"><button type="button" class="primary" data-health-run>Ejecutar diagnóstico</button><button type="button" data-health-close>Cerrar</button></div></div>';
  document.body.appendChild(m);m.querySelector('.onebase-health-close').onclick=closeHealth;m.querySelector('[data-health-close]').onclick=closeHealth;m.addEventListener('click',e=>{if(e.target===m)closeHealth()});m.querySelector('[data-health-run]').onclick=runHealth;
}
function openHealth(){ensureHealth();safeTransition(()=>$('#onebaseHealthModal').classList.add('open'));runHealth()}
function closeHealth(){safeTransition(()=>$('#onebaseHealthModal')?.classList.remove('open'))}
async function runHealth(){
  const tests=[
    ['core','Núcleo OneBase',Boolean(window.__ONEBASE_CORE_READY__),'La aplicación principal ha marcado su arranque como correcto.'],
    ['library','Biblioteca',Array.isArray(window.data),'El estado de la biblioteca está disponible en memoria.'],
    ['storage','Persistencia local',storageProbe(),'localStorage responde a lectura/escritura.'],
    ['render','Render',typeof window.render==='function','La función de renderizado está disponible.'],
    ['sources','Fuentes',Boolean(window.OneBaseSourceSearchV2?.search),'El módulo de búsqueda de fuentes está cargado.'],
    ['notifications','Notificaciones','serviceWorker' in navigator,'Service Worker disponible en este navegador.'],
    ['backup','Backup',await httpCheck('/backup/index.html'),'La instantánea pública de recuperación responde.'],
    ['server','API OneBase',await httpCheck('/api/onebase-health'),'El endpoint de salud del backend responde.']
  ];
  const grid=$('#onebaseHealthGrid');grid.innerHTML=tests.map(t=>'<div class="onebase-health-item '+(t[2]?'ok':'fail')+'"><span class="onebase-health-icon">'+(t[2]?'✓':'×')+'</span><span><b class="onebase-health-name">'+esc(t[1])+'</b><span class="onebase-health-detail">'+esc(t[3])+'</span></span><span class="onebase-health-state">'+(t[2]?'OK':'FALLO')+'</span></div>').join('');
  const ok=tests.filter(t=>t[2]).length;$('#onebaseHealthSummary').textContent=ok+'/'+tests.length+' pruebas superadas · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
}
function storageProbe(){try{const k='onebase_health_probe';localStorage.setItem(k,'1');const ok=localStorage.getItem(k)==='1';localStorage.removeItem(k);return ok}catch(_){return false}}
async function httpCheck(url){try{const r=await fetch(url,{cache:'no-store',headers:{accept:'application/json,text/html'}});return r.ok}catch(_){return false}}
function ensureHealthButton(){
  const controls=$('.controls');if(!controls||$('#onebaseHealthButton'))return;
  const b=document.createElement('button');b.type='button';b.id='onebaseHealthButton';b.className='btn ghost onebase-health-btn';b.innerHTML='<span class="onebase-health-dot"></span>Health';b.title='Diagnóstico de OneBase';b.onclick=openHealth;controls.insertBefore(b,controls.firstChild);
}
function ensurePublicSection(){
  const settingsModal=$('#settingsModal'),grid=settingsModal?.querySelector('.settingsGrid');if(!grid||$('#onebasePublicSection'))return;
  const sec=document.createElement('section');sec.className='settingsSection full';sec.id='onebasePublicSection';sec.innerHTML='<h3>🌐 Perfil público</h3><p>Publica solo la información que tú decidas. La biblioteca privada y el correo no se exponen.</p><label class="onebase-public-toggle"><span>Hacer mi perfil visible<small>Permite compartir una página pública con tu nombre, avatar, bio y estadísticas.</small></span><input id="onebasePublicEnabled" type="checkbox"></label><textarea id="onebasePublicBio" class="onebase-public-bio" maxlength="280" placeholder="Bio pública (máximo 280 caracteres)…"></textarea><div class="onebase-public-link" id="onebasePublicLink">Inicia sesión para generar tu enlace.</div><div class="onebase-public-actions"><button type="button" class="primary" data-public-save>Guardar perfil público</button><button type="button" data-public-copy>Copiar enlace</button><button type="button" data-public-open>Abrir perfil</button></div><div class="onebase-public-status" id="onebasePublicStatus"></div>';
  grid.insertBefore(sec,grid.firstElementChild?.nextElementSibling||grid.firstChild);
  $('#onebasePublicEnabled').checked=publicState.enabled;$('#onebasePublicBio').value=publicState.bio;updatePublicLink();
  sec.querySelector('[data-public-save]').onclick=savePublicSettings;
  sec.querySelector('[data-public-copy]').onclick=copyPublicLink;
  sec.querySelector('[data-public-open]').onclick=openPublicLink;
}
async function loadPublicSettings(){
  const user=await currentUser();if(!user){updatePublicLink();return}
  const c=supabaseClient();if(!c)return;
  try{
    const r=await c.from('profiles').select('public_enabled,bio').eq('id',user.id).maybeSingle();
    if(!r.error&&r.data){publicState={enabled:Boolean(r.data.public_enabled),bio:String(r.data.bio||'').slice(0,280)};saveLocalPublic()}
  }catch(_){}
  const toggle=$('#onebasePublicEnabled'),bio=$('#onebasePublicBio');if(toggle)toggle.checked=publicState.enabled;if(bio)bio.value=publicState.bio;updatePublicLink();
}
function publicUrl(userId){return new URL('/profile/?id='+encodeURIComponent(userId),location.origin).href}
async function updatePublicLink(){
  const user=await currentUser().catch(()=>null),el=$('#onebasePublicLink');if(!el)return;
  el.textContent=user&&publicState.enabled?publicUrl(user.id):(user?'Activa el perfil público para generar un enlace.':'Inicia sesión para generar tu enlace.');
}
async function savePublicSettings(){
  const user=await currentUser();if(!user){$('#onebasePublicStatus').textContent='Inicia sesión primero.';return}
  publicState.enabled=Boolean($('#onebasePublicEnabled')?.checked);publicState.bio=String($('#onebasePublicBio')?.value||'').slice(0,280);saveLocalPublic();
  const c=supabaseClient();if(!c)return;
  const p=profileLocal(),snapshot=buildPublicSnapshot();
  const payload={id:user.id,username:String(p.name||'Usuario').slice(0,32),avatar_data:String(p.avatar||''),public_enabled:publicState.enabled,bio:publicState.bio,public_stats:snapshot};
  try{const r=await c.from('profiles').upsert(payload,{onConflict:'id'});if(r.error)throw r.error;$('#onebasePublicStatus').textContent=publicState.enabled?'✓ Perfil público actualizado.':'✓ Perfil público oculto.';updatePublicLink()}catch(e){$('#onebasePublicStatus').textContent='No se pudo guardar: '+(e?.message||'error')}}
function buildPublicSnapshot(){
  const s=stats(),high=s.filled.filter(x=>x.favorite).sort((a,b)=>(Number(b.updatedAt)||0)-(Number(a.updatedAt)||0)).slice(0,8).map(x=>({title:String(x.anime||'').slice(0,100),cover:String(x.cover||x.coverImage||'').slice(0,1000),score:x.score===''?null:Number(x.score)||0}));
  return{animeCount:s.filled.length,completed:s.completed,chapters:s.chapters,favorites:s.favorites,active:s.active,avgScore:Number(s.avg.toFixed(2)),hours:Number(s.hours.toFixed(1)),highlights:high,updatedAt:Date.now()};
}
async function syncPublicSnapshot(){
  if(!publicState.enabled)return;
  clearTimeout(publicTimer);publicTimer=setTimeout(async()=>{
    const user=await currentUser();if(!user)return;const c=supabaseClient();if(!c)return;
    try{const p=profileLocal();const r=await c.from('profiles').update({username:String(p.name||'Usuario').slice(0,32),avatar_data:String(p.avatar||''),public_stats:buildPublicSnapshot(),bio:publicState.bio,public_enabled:true,updated_at:new Date().toISOString()}).eq('id',user.id);if(r.error)throw r.error}catch(e){console.warn('[ONEBASE] public profile sync failed',e)}
  },900);
}
async function copyPublicLink(){
  const user=await currentUser();if(!user||!publicState.enabled){window.toast?.('Activa el perfil público e inicia sesión.');return}
  const url=publicUrl(user.id);try{await navigator.clipboard.writeText(url);window.toast?.('✓ Enlace público copiado.')}catch(_){window.prompt('Copia tu enlace público:',url)}
}
async function openPublicLink(){const user=await currentUser();if(!user||!publicState.enabled){window.toast?.('Activa el perfil público e inicia sesión.');return}window.open(publicUrl(user.id),'_blank','noopener,noreferrer')}
function bindEvents(){
  document.addEventListener('click',captureInfoClick,true);
  document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-ob-open]');if(b)openInfoIndex(Number(b.dataset.obOpen))});
  document.getElementById('settingsBtn')?.addEventListener('click',()=>setTimeout(()=>{ensurePublicSection();void loadPublicSettings()},30));
  document.getElementById('profileTopBtn')?.addEventListener('click',()=>setTimeout(()=>{ensurePublicSection();void loadPublicSettings()},30));
  ['search','statusFilter','sortSelect'].forEach(id=>document.getElementById(id)?.addEventListener('input',()=>setTimeout(applyAdvancedFilters,0)));
  document.getElementById('favFilter')?.addEventListener('click',()=>setTimeout(applyAdvancedFilters,0));
  window.addEventListener('animetracker:saved',()=>{setTimeout(refresh,0);void syncPublicSnapshot()});
  window.addEventListener('animetracker:restored',()=>{setTimeout(refresh,0);void syncPublicSnapshot()});
  window.addEventListener('onebase:anime-added',()=>{setTimeout(refresh,0);void syncPublicSnapshot()});
  window.addEventListener('storage',e=>{if(e.key==='anime_tracker_profile_v1'||e.key===PUBLIC_KEY){publicState=loadLocalPublic();setTimeout(refresh,0)}});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeHealth();closeEpisodes()}});
}
function boot(){
  if(booted)return;booted=true;
  const link=document.createElement('link');link.rel='stylesheet';link.href='/onebase-premium.css?v=2';document.head.appendChild(link);
  ensureHealthButton();ensureHealth();ensureEpisodeModal();ensurePublicSection();wrapRender();bindEvents();refresh();void loadPublicSettings();void syncPublicSnapshot();
  window.OneBasePremium={refresh,openHealth,openEpisodes,openInfo:openInfoIndex,runHealth,publicUrl};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();

/* ONEBASE Pages v1 — same-document navigation, isolated from core rendering. */
(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const data=()=>Array.isArray(window.__ONEBASE_DATA__)?window.__ONEBASE_DATA__:[];
const prof=()=>{try{return JSON.parse(localStorage.getItem('anime_tracker_profile_v1')||'{}')||{}}catch(_){return{}}};
const status={viendo:'Viendo',terminado:'Terminado',pendiente:'Pendiente',pausa:'En pausa',abandonado:'Abandonado'};
let page='home',q='',st='all',genre='all',sort='recent',score='all',progress='all',fav=false,booted=false;
const items=()=>data().map((x,i)=>({x,i})).filter(o=>o.x&&String(o.x.anime||'').trim());
const stats=()=>{const a=items().map(o=>o.x),w=a.reduce((s,x)=>s+(Number(x.watched)||0),0),t=a.reduce((s,x)=>s+(Number(x.total)||0),0),c=a.filter(x=>x.total!==''&&Number(x.watched)>=Number(x.total)).length,r=a.filter(x=>x.score!==''&&Number.isFinite(Number(x.score))),h=a.reduce((s,x)=>s+(Number(x.watched)||0)*(Number(x.durationMin||x.duration)||0)/60,0);return{a,w,t,c,r,h,p:a.reduce((s,x)=>s+Math.max(0,(Number(x.total)||0)-(Number(x.watched)||0)),0),f:a.filter(x=>x.favorite).length,active:a.filter(x=>x.state==='viendo').length}};
const fmt=n=>new Intl.NumberFormat('es-ES').format(Math.round(Number(n)||0));
const transition=fn=>{if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!document.startViewTransition){fn();return}try{document.startViewTransition(fn)}catch(_){fn()}};
function setup(){
 if($('#onebasePageApp'))return;
 const main=$('main');if(!main)return;
 const app=document.createElement('section');app.id='onebasePageApp';app.className='onebase-page-app';main.prepend(app);
 const side=document.createElement('aside');side.id='onebaseSidebar';side.className='onebase-sidebar';
 side.innerHTML='<div class="onebase-sidebar-brand"><span>◉</span><b>ONEBASE</b></div><nav><button data-page="home"><i>⌂</i><span>Inicio</span></button><button data-page="library"><i>▦</i><span>Biblioteca</span></button><button data-page="episodes"><i>▶</i><span>Episodios</span></button><button data-page="stats"><i>◈</i><span>Estadísticas</span></button><button data-page="profile"><i>♙</i><span>Perfil</span></button></nav><div class="onebase-sidebar-bottom"><button data-page="health"><i>🛡</i><span>Health</span></button><button data-page="settings"><i>⚙</i><span>Ajustes</span></button></div>';
 document.body.appendChild(side);
 side.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;navigate(b.dataset.page)});
 ['main > .dashboard','main > .toolbar','main > .table','main > .hint','main > .footerNote','main > .onebase-home-panel'].forEach(s=>$$ (s).forEach(el=>el.classList.add('onebase-legacy-hidden')));
 document.body.classList.add('onebase-pages-mode');
}
function navigate(p,push=true){
 if(p==='health'){window.OneBasePremium?.openHealth?.();return}
 if(p==='settings'){document.getElementById('settingsBtn')?.click();return}
 if(!['home','library','episodes','stats','profile'].includes(p))p='home';
 page=p;
 if(push){try{history.pushState({onebasePage:p},'',location.pathname+'#'+p)}catch(_){}}
 transition(()=>render());
}
function shell(k,t,s,b){return '<div class="onebase-page-head"><div><div class="onebase-page-kicker">ONEBASE · '+esc(k)+'</div><h2>'+esc(t)+'</h2><p>'+esc(s)+'</p></div></div><div class="onebase-page-body">'+b+'</div>'}
function card(label,value,sub){return '<article class="ob-stat-card"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(sub||'')+'</small></article>'}
function home(){
 const s=stats(),active=items().filter(o=>o.x.state==='viendo'&&Number(o.x.total||0)>Number(o.x.watched||0)).sort((a,b)=>(Number(b.x.updatedAt)||0)-(Number(a.x.updatedAt)||0)).slice(0,6);
 const air=items().filter(o=>Number(o.x.nextAiringAt)>0&&Number(o.x.nextAiringEpisode)>0&&Number(o.x.nextAiringAt)*1000>Date.now()-86400000).sort((a,b)=>Number(a.x.nextAiringAt)-Number(b.x.nextAiringAt)).slice(0,5);
 const recent=items().sort((a,b)=>(Number(b.x.updatedAt)||0)-(Number(a.x.updatedAt)||0)).slice(0,6);
 return shell('INICIO','Tu biblioteca, de un vistazo','Lo importante primero. El resto está a un clic.',
 '<div class="ob-stat-grid">'+card('Animes',fmt(s.a.length),s.active+' activos')+card('Completados',fmt(s.c),s.a.length?Math.round(s.c/s.a.length*100)+'% de la lista':'—')+card('Capítulos vistos',fmt(s.w),fmt(s.t)+' conocidos')+card('Tiempo visto',s.h>=24?(s.h/24).toFixed(1)+' días':s.h.toFixed(1)+' h','estimado')+card('Pendientes',fmt(s.p),'por ver')+card('Progreso global',s.t?Math.round(s.w/s.t*100)+'%':'—','biblioteca')+card('Nota media',s.r.length?(s.r.reduce((z,x)=>z+Number(x.score),0)/s.r.length).toFixed(1)+'/10':'—',s.r.length+' valoraciones')+card('Favoritos',fmt(s.f),'colección')}</div>'+
 '<div class="ob-home-columns"><section class="ob-section-card"><header><h3>▶ Continuar viendo</h3><button data-go="episodes">Ver episodios</button></header><div class="ob-home-list">'+(active.length?active.map(o=>mini(o)).join(''):'<div class="ob-empty">No tienes series activas con episodios pendientes.</div>')+'</div></section>'+
 '<section class="ob-section-card"><header><h3>◷ Próximos episodios</h3><button data-go="episodes">Ver todos</button></header><div class="ob-home-list">'+(air.length?air.map(o=>mini(o,true)).join(''):'<div class="ob-empty">No hay próximos episodios registrados.</div>')+'</div></section></div>'+
 '<section class="ob-section-card ob-recent"><header><h3>✦ Actividad reciente</h3><button data-go="library">Abrir biblioteca</button></header><div class="ob-activity-list">'+(recent.length?recent.map(o=>'<button class="ob-activity" data-open="'+o.i+'"><i></i><span><strong>'+esc(o.x.anime)+'</strong><small>'+esc(status[o.x.state]||'Actualizado')+'</small></span><em>›</em></button>').join(''):'<div class="ob-empty">Todavía no hay actividad.</div>')+'</div></section>');
}
function mini(o,air){const x=o.x,c=x.cover||x.coverImage||'',txt=air?'EP '+(x.nextAiringEpisode||'—')+' · '+remain(x.nextAiringAt):(Number(x.watched)||0)+' / '+(Number(x.total)||0)+' episodios';return '<button class="ob-home-anime" data-open="'+o.i+'"><span class="ob-home-cover">'+(c?'<img loading="lazy" src="'+esc(c)+'" alt="">':'SIN PORTADA')+'</span><span><strong>'+esc(x.anime)+'</strong><small>'+esc(txt)+'</small></span><em>›</em></button>'}
function remain(ts){const d=Math.floor((Number(ts)*1000-Date.now())/1000);if(d<=0)return'ahora';const D=Math.floor(d/86400),h=Math.floor(d%86400/3600),m=Math.floor(d%3600/60);return D?D+'d '+h+'h':h?h+'h '+m+'m':Math.max(1,m)+'m'}
function genres(){return [...new Set(items().flatMap(o=>Array.isArray(o.x.genres)?o.x.genres:[]).map(String).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'))}
function filtered(){
 let a=items(),z=q.toLowerCase().trim();
 if(z)a=a.filter(o=>String(o.x.anime).toLowerCase().includes(z));
 if(st!=='all')a=a.filter(o=>o.x.state===st);
 if(genre!=='all')a=a.filter(o=>Array.isArray(o.x.genres)&&o.x.genres.some(g=>String(g).toLowerCase()===genre.toLowerCase()));
 if(fav)a=a.filter(o=>o.x.favorite);
 if(score==='rated')a=a.filter(o=>o.x.score!==''&&Number.isFinite(Number(o.x.score)));
 if(score==='8')a=a.filter(o=>Number(o.x.score)>=8);
 if(score==='9')a=a.filter(o=>Number(o.x.score)>=9);
 if(progress==='none')a=a.filter(o=>(Number(o.x.watched)||0)===0);
 if(progress==='active')a=a.filter(o=>Number(o.x.watched)>0&&Number(o.x.total)>Number(o.x.watched));
 if(progress==='complete')a=a.filter(o=>Number(o.x.total)>0&&Number(o.x.watched)>=Number(o.x.total));
 if(progress==='new')a=a.filter(o=>Number(o.x.newEpisodes)>0);
 if(progress==='airing')a=a.filter(o=>String(o.x.apiStatus||'')==='RELEASING');
 a.sort((x,y)=>sort==='name'?String(x.x.anime).localeCompare(String(y.x.anime),'es'):sort==='score'?(Number(y.x.score)||0)-(Number(x.x.score)||0):sort==='watched'?(Number(y.x.watched)||0)-(Number(x.x.watched)||0):sort==='new'?(Number(y.x.newEpisodes)||0)-(Number(x.x.newEpisodes)||0):sort==='progress'?((Number(y.x.watched)||0)/(Number(y.x.total)||1))-((Number(x.x.watched)||0)/(Number(x.x.total)||1)):(Number(y.x.updatedAt)||0)-(Number(x.x.updatedAt)||0));
 return a;
}
function library(){
 const g=genres(),a=filtered(),opts=Object.entries(status).map(([k,v])=>'<option value="'+k+'" '+(st===k?'selected':'')+'>'+v+'</option>').join('');
 const cards=a.length?a.map((o,n)=>{const x=o.x,c=x.cover||x.coverImage||'',w=Number(x.watched)||0,t=Number(x.total)||0,p=t?Math.min(100,w/t*100):0;return '<article class="ob-anime-card" style="--ob-card-i:'+Math.min(n,20)+'"><button class="ob-card-open" data-open="'+o.i+'"><div class="ob-card-cover">'+(c?'<img loading="lazy" src="'+esc(c)+'" alt="Portada de '+esc(x.anime)+'">':'<span>SIN PORTADA</span>')+'<div class="ob-card-badges">'+(x.favorite?'<b>★</b>':'')+(Number(x.newEpisodes)>0?'<b>+'+esc(x.newEpisodes)+'</b>':'')+'</div></div><div class="ob-card-body"><h3>'+esc(x.anime)+'</h3><div class="ob-card-meta"><span>'+esc(status[x.state]||'Sin estado')+'</span>'+(x.score!==''?'<span>★ '+Number(x.score).toFixed(1)+'</span>':'')+(x.apiScore?'<span>AniList '+Number(x.apiScore).toFixed(1)+'</span>':'')+'</div><div class="ob-card-progress"><span style="width:'+p+'%"></span></div><div class="ob-card-foot"><small>'+w+(t?' / '+t:'')+' episodios</small><small>'+ (t?Math.round(p)+'%':'—')+'</small></div></div></button></article>'}).join(''):'<div class="ob-empty ob-empty-large">No hay animes que coincidan con estos filtros.</div>';
 return shell('BIBLIOTECA','Tu biblioteca','Portadas primero. Haz clic en una tarjeta para abrir toda la información.',
 '<div class="ob-library-tools"><input id="obLibSearch" value="'+esc(q)+'" placeholder="Buscar anime…" autocomplete="off"><select id="obLibStatus"><option value="all">Todos los estados</option>'+opts+'</select><select id="obLibGenre"><option value="all">Todos los géneros</option>'+g.map(x=>'<option value="'+esc(x)+'" '+(genre===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select><select id="obLibScore"><option value="all">Cualquier nota</option><option value="rated" '+(score==='rated'?'selected':'')+'>Con nota personal</option><option value="8" '+(score==='8'?'selected':'')+'>Nota ≥ 8</option><option value="9" '+(score==='9'?'selected':'')+'>Nota ≥ 9</option></select><select id="obLibProgress"><option value="all">Cualquier progreso</option><option value="none" '+(progress==='none'?'selected':'')+'>Sin empezar</option><option value="active" '+(progress==='active'?'selected':'')+'>En progreso</option><option value="complete" '+(progress==='complete'?'selected':'')+'>Completados</option><option value="new" '+(progress==='new'?'selected':'')+'>Con episodios nuevos</option><option value="airing" '+(progress==='airing'?'selected':'')+'>En emisión</option></select><select id="obLibSort"><option value="recent" '+(sort==='recent'?'selected':'')+'>Más recientes</option><option value="name" '+(sort==='name'?'selected':'')+'>Nombre A-Z</option><option value="progress" '+(sort==='progress'?'selected':'')+'>Más progreso</option><option value="score" '+(sort==='score'?'selected':'')+'>Mayor nota</option><option value="watched" '+(sort==='watched'?'selected':'')+'>Más capítulos</option><option value="new" '+(sort==='new'?'selected':'')+'>Nuevos episodios</option></select><button id="obLibFav" class="'+(fav?'active':'')+'">☆ Favoritos</button></div><div class="ob-library-meta"><span>'+a.length+' de '+items().length+' animes</span><span>Haz clic en una portada para abrir la ficha</span></div><div class="ob-library-grid">'+cards+'</div>');
}
function episodes(){
 const up=items().filter(o=>Number(o.x.nextAiringAt)>0&&Number(o.x.nextAiringEpisode)>0&&Number(o.x.nextAiringAt)*1000>Date.now()-86400000).sort((a,b)=>Number(a.x.nextAiringAt)-Number(b.x.nextAiringAt));
 const pe=items().filter(o=>Math.max(0,(Number(o.x.total)||0)-(Number(o.x.watched)||0))>0).sort((a,b)=>((Number(b.x.total)||0)-(Number(b.x.watched)||0))-((Number(a.x.total)||0)-(Number(a.x.watched)||0)));
 const recent=items().filter(o=>Number(o.x.watched)>0).sort((a,b)=>(Number(b.x.updatedAt)||0)-(Number(a.x.updatedAt)||0)).slice(0,10);
 const row=(o,air=false)=>{const x=o.x,c=x.cover||x.coverImage||'',p=Math.max(0,(Number(x.total)||0)-(Number(x.watched)||0));return '<button class="ob-episode-row" data-epopen="'+o.i+'"><span class="ob-episode-cover">'+(c?'<img loading="lazy" src="'+esc(c)+'" alt="">':'')+'</span><span><strong>'+esc(x.anime)+'</strong><small>'+esc(air?'Próximo: episodio '+x.nextAiringEpisode+' · '+remain(x.nextAiringAt):p+' episodios pendientes')+'</small></span><em>'+esc(air?remain(x.nextAiringAt):'▦')+'</em></button>'};
 return shell('EPISODIOS','Seguimiento de episodios','Próximos lanzamientos, pendientes y progreso reciente.',
 '<div class="ob-home-columns"><section class="ob-section-card"><header><h3>◷ Próximos</h3><button data-go="library">Biblioteca</button></header><div class="ob-episode-list">'+(up.length?up.map(o=>row(o,true)).join(''):'<div class="ob-empty">No hay próximos episodios registrados.</div>')+'</div></section><section class="ob-section-card"><header><h3>📌 Pendientes</h3><span>'+pe.length+' animes</span></header><div class="ob-episode-list">'+(pe.length?pe.slice(0,15).map(o=>row(o)).join(''):'<div class="ob-empty">No tienes episodios pendientes.</div>')+'</div></section></div><section class="ob-section-card"><header><h3>✓ Vistos recientemente</h3></header><div class="ob-episode-list ob-episode-list-grid">'+(recent.length?recent.map(o=>row(o)).join(''):'<div class="ob-empty">Todavía no hay progreso reciente.</div>')+'</div></section>');
}
function statistics(){
 const s=stats(),avg=s.r.length?s.r.reduce((z,x)=>z+Number(x.score),0)/s.r.length:0,g={};s.a.forEach(x=>(x.genres||[]).forEach(k=>g[k]=(g[k]||0)+1));const gs=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,8),ratings=Array.from({length:11},(_,i)=>s.r.filter(x=>Math.round(Number(x.score))===i).length);
 return shell('ESTADÍSTICAS','Tu actividad','Tus números, separados de la biblioteca.',
 '<div class="ob-stat-grid ob-stat-grid-large">'+card('Animes',fmt(s.a.length),'biblioteca')+card('Completados',fmt(s.c),'terminados')+card('Episodios',fmt(s.w),'vistos')+card('Tiempo',s.h>=24?(s.h/24).toFixed(1)+' días':s.h.toFixed(1)+' h','estimado')+card('Progreso',s.t?Math.round(s.w/s.t*100)+'%':'—','global')+card('Nota media',avg?avg.toFixed(1)+'/10':'—',s.r.length+' valoraciones')+'</div><div class="ob-stats-columns"><section class="ob-section-card"><header><h3>Géneros</h3></header><div class="ob-bars">'+(gs.length?gs.map(x=>'<div class="ob-bar-row"><span>'+esc(x[0])+'</span><div><i style="width:'+Math.round(x[1]/gs[0][1]*100)+'%"></i></div><b>'+x[1]+'</b></div>').join(''):'<div class="ob-empty">Sin géneros todavía.</div>')+'</div></section><section class="ob-section-card"><header><h3>Distribución de notas</h3></header><div class="ob-rating-bars">'+ratings.map((n,i)=>'<div><span>'+i+'</span><i style="height:'+Math.max(4,n*18)+'px"></i><b>'+n+'</b></div>').join('')+'</div></section></div>');
}
function profilePage(){const p=prof(),s=stats(),name=String(p.name||'Usuario'),av=String(p.avatar||''),ini=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'OB',favv=s.a.filter(x=>x.favorite).slice(0,8);return shell('PERFIL','Tu perfil','Identidad, progresión y colección personal.',
 '<section class="ob-profile-hero"><div class="ob-profile-avatar">'+(av?'<img src="'+esc(av)+'" alt="">':esc(ini))+'</div><div><div class="onebase-page-kicker">ONEBASE · USUARIO</div><h3>'+esc(name)+'</h3><p>Nivel 65 · 16.075 XP · 30% al siguiente nivel</p></div><button id="obEditProfile">Editar perfil</button></section><div class="ob-stat-grid">'+card('Animes',fmt(s.a.length),'colección')+card('Completados',fmt(s.c),'terminados')+card('Capítulos',fmt(s.w),'vistos')+card('Favoritos',fmt(s.f),'marcados')+'</div><section class="ob-section-card"><header><h3>★ Favoritos</h3><button data-go="library">Biblioteca</button></header><div class="ob-favorite-grid">'+(favv.length?favv.map((o)=>'<button data-open="'+items().find(z=>z.x===o)?.i+'"><span>'+(o.cover||o.coverImage?'<img loading="lazy" src="'+esc(o.cover||o.coverImage)+'" alt="">':'')+'</span><strong>'+esc(o.anime)+'</strong></button>').join(''):'<div class="ob-empty">Todavía no tienes favoritos.</div>')+'</div></section>')}
function openInfo(i){document.querySelector('.row[data-index="'+i+'"] .infoBtn')?.click()}
function bind(){
 const app=$('#onebasePageApp');if(!app)return;
 app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
 app.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();openInfo(Number(b.dataset.open))});
 app.querySelectorAll('[data-epopen]').forEach(b=>b.onclick=()=>window.OneBasePremium?.openEpisodes?.(Number(b.dataset.epopen)));
 const qel=$('#obLibSearch');if(qel){qel.oninput=()=>{q=qel.value;render()};$('#obLibStatus').onchange=e=>{st=e.target.value;render()};$('#obLibGenre').onchange=e=>{genre=e.target.value;render()};$('#obLibScore').onchange=e=>{score=e.target.value;render()};$('#obLibProgress').onchange=e=>{progress=e.target.value;render()};$('#obLibSort').onchange=e=>{sort=e.target.value;render()};$('#obLibFav').onclick=()=>{fav=!fav;render()}}
 $('#obEditProfile')?.addEventListener('click',()=>document.getElementById('profileTopBtn')?.click());
}
function render(){setup();const app=$('#onebasePageApp');if(!app)return;app.innerHTML=page==='home'?home():page==='library'?library():page==='episodes'?episodes():page==='stats'?statistics():profilePage();$('#onebaseSidebar')?.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));bind();document.title='ONEBASE · '+({home:'Inicio',library:'Biblioteca',episodes:'Episodios',stats:'Estadísticas',profile:'Perfil'}[page]||'');}
function boot(){if(booted)return;booted=true;setup();const h=location.hash.slice(1);page=['home','library','episodes','stats','profile'].includes(h)?h:'home';try{history.replaceState({onebasePage:page},'',location.pathname+'#'+page)}catch(_){}render();addEventListener('popstate',e=>{const p=e.state?.onebasePage||location.hash.slice(1)||'home';if(['home','library','episodes','stats','profile'].includes(p)){page=p;render()}});['animetracker:saved','animetracker:restored','onebase:anime-added'].forEach(ev=>addEventListener(ev,()=>setTimeout(render,0)));window.OneBasePages={navigate,refresh:render}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();