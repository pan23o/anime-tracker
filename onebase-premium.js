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
let booted=false,originalRender=null,pendingInfoIndex=null,episodeIndex=null,episodePage=0,episodeTotalPages=1,airingTimer=0,publicTimer=0;window.__ONEBASE_DISCOVER_GENRE__=window.__ONEBASE_DISCOVER_GENRE__||'all';
let publicState=loadLocalPublic();
let supa=null;

const $=s=>document.querySelector(s);
function modalScrollLock(){
  if(!window.OneBaseModalScrollLock){
    const owners=new Set();let previous=null;
    window.OneBaseModalScrollLock={
      lock(owner){
        if(owners.has(owner))return;
        if(!owners.size)previous={bodyOverflow:document.body.style.overflow,htmlOverflow:document.documentElement.style.overflow,bodyOverscroll:document.body.style.overscrollBehavior,htmlOverscroll:document.documentElement.style.overscrollBehavior};
        owners.add(owner);document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';document.body.style.overscrollBehavior='none';document.documentElement.style.overscrollBehavior='none';
      },
      unlock(owner){
        if(!owners.delete(owner)||owners.size||!previous)return;
        document.body.style.overflow=previous.bodyOverflow;document.documentElement.style.overflow=previous.htmlOverflow;document.body.style.overscrollBehavior=previous.bodyOverscroll;document.documentElement.style.overscrollBehavior=previous.htmlOverscroll;previous=null;
      }
    };
  }
  return window.OneBaseModalScrollLock;
}
function installAnimeScrollLock(modal){
  if(modal.dataset.onebaseScrollLock==='1')return;
  modal.dataset.onebaseScrollLock='1';
  const sync=()=>modalScrollLock()[modal.classList.contains('hidden')?'unlock':'lock']('anime-info');
  new MutationObserver(sync).observe(modal,{attributes:true,attributeFilter:['class','hidden','aria-hidden']});
  sync();
}
modalScrollLock();
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
  const modal=$('#infoModal');if(!modal||modal.dataset.onebasePremium==='2')return;
  modal.dataset.onebasePremium='2';
  installAnimeScrollLock(modal);
  const card=modal.querySelector('.infoCard');if(!card)return;
  card.classList.add('onebase-premium-info','onebase-simple-info');
  const grid=card.querySelector('.infoGrid'),details=grid?.children[1];if(!grid||!details)return;
  // Keep all existing IDs and handlers: this is a layout-only redesign.
  const hero=document.createElement('div');hero.className='onebase-info-hero';hero.id='onebaseInfoHero';card.insertBefore(hero,grid);
  const overview=document.createElement('section');overview.className='ob-detail-overview';overview.innerHTML='<div class="ob-detail-eyebrow">TU SEGUIMIENTO</div><div class="onebase-info-stats" id="onebaseInfoStats"></div><div class="onebase-info-progress" id="onebaseInfoProgress"></div>';
  const actions=document.createElement('section');actions.className='ob-detail-watch';actions.innerHTML='<div class="ob-detail-eyebrow">¿QUÉ QUIERES HACER?</div><p>Continúa donde lo dejaste o busca dónde ver el siguiente capítulo.</p><div class="ob-detail-main-actions"><button type="button" class="onebase-episode-button" id="onebaseOpenEpisodes">✓ Marcar capítulos vistos</button></div>';
  const sourceBtn=$('#infoSources');if(sourceBtn){sourceBtn.textContent='▶ Buscar dónde ver';actions.querySelector('.ob-detail-main-actions').appendChild(sourceBtn)}
  const removeBtn=document.createElement('button');removeBtn.type='button';removeBtn.id='onebaseMoveToTrash';removeBtn.className='btn ghost';removeBtn.textContent='♻ Mover a papelera';removeBtn.style.marginTop='8px';removeBtn.addEventListener('click',()=>{const i=pendingInfoIndex,item=getData()[i];if(!item)return;const row=document.querySelector('.row[data-index="'+i+'"]'),remove=row?.querySelector('.clearAnime');if(!remove){window.toast?.('No se pudo encontrar la acción de papelera.');return}const identity=Number(item.anilistId||item.aniId)||String(item.anime||'').trim().toLowerCase();remove.click();const stillPresent=getData().some(x=>(identity&&Number(x.anilistId||x.aniId)===identity)||(!Number(identity)&&String(x.anime||'').trim().toLowerCase()===identity));if(!stillPresent)$('#infoClose')?.click()});actions.querySelector('.ob-detail-main-actions').appendChild(removeBtn);
  const edit=document.createElement('details');edit.className='ob-detail-edit';edit.innerHTML='<summary>⚙ Personalizar mi ficha <span>Estado, nota y favorito</span></summary><div class="ob-detail-edit-inner"></div>';
  const form=details.querySelector('.formRow'),fav=$('#infoFav')?.closest('.checkRow'),save=$('#infoSave');
  if(form)edit.querySelector('.ob-detail-edit-inner').appendChild(form);
  if(fav)edit.querySelector('.ob-detail-edit-inner').appendChild(fav);
  if(save){save.textContent='Guardar cambios';edit.querySelector('.ob-detail-edit-inner').appendChild(save)}
  const metadata=document.createElement('details');metadata.className='ob-detail-more';metadata.innerHTML='<summary>ℹ Información del anime <span>Sinopsis y datos</span></summary><div class="ob-detail-more-inner"></div>';
  const desc=document.createElement('div');desc.className='onebase-info-description';desc.id='onebaseInfoDescription';
  metadata.querySelector('.ob-detail-more-inner').appendChild(desc);
  [details.querySelector('.infoSub'),details.querySelector('#infoGenres'),...details.querySelectorAll('.infoLine'),details.querySelector('#nextAiring')].filter(Boolean).forEach(el=>metadata.querySelector('.ob-detail-more-inner').appendChild(el));
  // Move rather than clone original controls so existing event listeners remain intact.
  details.append(overview,actions,edit,metadata);
  const epBtn=$('#onebaseOpenEpisodes');epBtn?.addEventListener('click',()=>openEpisodes(pendingInfoIndex));
}
function enhanceInfo(){
  ensureInfoEnhancement();
  const i=pendingInfoIndex,item=getData()[i];if(!item)return;
  const hero=$('#onebaseInfoHero'),desc=$('#onebaseInfoDescription'),st=$('#onebaseInfoStats'),pr=$('#onebaseInfoProgress');
  if(hero){
    const cover=String(item.cover||item.coverImage||'').trim();
    hero.innerHTML=(cover?'<img class="onebase-info-hero-bg" src="'+esc(cover)+'" alt="" aria-hidden="true">':'')+'<div class="onebase-info-hero-content"><div class="onebase-info-hero-kicker">ONEBASE · TU ANIME</div><div class="onebase-info-hero-title">'+esc(item.anime)+'</div></div>';
  }
  if(desc)desc.textContent=txt(item.descriptionEs||item.description||'')||'Sin descripción disponible.';
  const watched=Number(item.watched)||0,total=Number(item.total)||0,remaining=Math.max(0,total-watched);
  if(st)st.innerHTML='<div class="onebase-info-stat"><b>Vistos</b><span>'+esc(watched)+'</span></div><div class="onebase-info-stat"><b>Restantes</b><span>'+(total?esc(remaining):'—')+'</span></div><div class="onebase-info-stat"><b>Total</b><span>'+esc(total||'—')+'</span></div>';
  if(pr){const pct=total?Math.max(0,Math.min(100,watched/total*100)):0;pr.innerHTML='<div class="onebase-info-progress-top"><span>Tu progreso</span><b>'+Math.round(pct)+'%</b></div><div class="onebase-info-progress-bar"><span style="width:'+pct+'%"></span></div>'}
}
function ensureEpisodeModal(){
  if($('#onebaseEpisodesModal'))return;
  const m=document.createElement('div');m.id='onebaseEpisodesModal';m.className='onebase-episodes-modal';m.innerHTML='<div class="onebase-episodes-card" role="dialog" aria-modal="true" aria-labelledby="onebaseEpisodesTitle" aria-describedby="onebaseEpisodesHelp"><div class="onebase-episodes-head"><div><div class="onebase-episodes-kicker">TU PROGRESO</div><h2 class="onebase-episodes-title" id="onebaseEpisodesTitle">Episodios</h2><p class="onebase-episodes-sub" id="onebaseEpisodesSub"></p></div><button type="button" class="onebase-episodes-close" aria-label="Cerrar">×</button></div><div class="onebase-episodes-progress" id="onebaseEpisodesProgress"></div><p class="onebase-episodes-help" id="onebaseEpisodesHelp">Elige un episodio para guardar tu progreso. Al marcar uno, también se marcarán como vistos todos los anteriores.</p><div class="onebase-episodes-toolbar"><label class="onebase-episode-jump"><span>Ir al episodio</span><input id="onebaseEpisodeJump" type="number" min="1" step="1" aria-label="Número de episodio" placeholder="N.º"></label><button type="button" data-ep-action="jump">Ir</button><span class="onebase-episode-toolbar-divider"></span><button type="button" data-ep-action="latest">Marcar todos vistos</button><button type="button" class="onebase-episode-reset" data-ep-action="first">Reiniciar progreso</button></div><div class="onebase-episode-legend" aria-label="Estados de episodio"><span><i class="is-watched"></i>Visto</span><span><i class="is-next"></i>Siguiente</span><span><i class="is-pending"></i>Pendiente</span></div><div class="onebase-episode-grid" id="onebaseEpisodeGrid"></div><div class="onebase-episode-pagination" id="onebaseEpisodePagination"></div><div class="onebase-episode-actions"><button type="button" class="primary" data-ep-action="source">Buscar dónde ver</button><button type="button" data-ep-action="close">Cerrar</button></div></div>';
  document.body.appendChild(m);
  m.querySelector('.onebase-episodes-close').addEventListener('click',closeEpisodes);
  m.addEventListener('click',e=>{if(e.target===m)closeEpisodes()});
  m.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();closeEpisodes()}});
  m.querySelector('#onebaseEpisodeJump').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();episodeAction('jump')}});
  m.querySelectorAll('[data-ep-action]').forEach(b=>b.addEventListener('click',()=>episodeAction(b.dataset.epAction)));
}
function openEpisodes(i){
  if(!Number.isInteger(i)||!getData()[i])return;
  episodeIndex=i;episodePage=Math.max(0,Math.floor(Math.max(0,(Number(getData()[i].watched)||0)-1)/50));ensureEpisodeModal();
  safeTransition(()=>{$('#onebaseEpisodesModal').classList.add('open')});
  renderEpisodes();
  $('#onebaseEpisodesModal .onebase-episodes-close')?.focus();
}
function closeEpisodes(){safeTransition(()=>$('#onebaseEpisodesModal')?.classList.remove('open'))}
function renderEpisodes(){
  const item=getData()[episodeIndex];if(!item)return;
  const total=Math.max(0,Number(item.total)||Number(item.knownTotal)||0),watched=Math.max(0,Number(item.watched)||0);
  $('#onebaseEpisodesTitle').textContent=item.anime||'Episodios';
  $('#onebaseEpisodesSub').textContent=total?watched+' de '+total+' episodios vistos':'Añade el total de episodios para activar el seguimiento.';
  const pct=total?Math.min(100,watched/total*100):0;
  $('#onebaseEpisodesProgress').innerHTML='<div class="onebase-episodes-progress-top"><span>Progreso guardado</span><b>'+Math.round(pct)+'%</b></div><div class="onebase-episodes-progress-bar"><span style="width:'+pct+'%"></span></div>';
  const grid=$('#onebaseEpisodeGrid'),pagination=$('#onebaseEpisodePagination');if(!grid)return;
  if(!total){grid.innerHTML='<div class="onebase-episode-empty">Abre “Personalizar mi ficha” y añade el número total de episodios para empezar.</div>';if(pagination)pagination.innerHTML='';return}
  episodeTotalPages=Math.max(1,Math.ceil(total/50));episodePage=Math.min(episodePage,episodeTotalPages-1);
  const start=episodePage*50+1,end=Math.min(total,start+49);
  grid.innerHTML=Array.from({length:end-start+1},(_,n)=>{const ep=start+n,isWatched=ep<=watched,isNext=ep===watched+1,state=isWatched?(ep===watched&&watched>0?'ÚLTIMO VISTO':'VISTO'):isNext?'SIGUIENTE':'PENDIENTE';return '<button type="button" class="onebase-episode '+(isWatched?'is-watched ':'')+(isNext?'is-next ':'')+(ep===watched&&watched>0?'is-current':'')+'" data-ep="'+ep+'" aria-label="Episodio '+ep+': '+state+'"><span class="onebase-episode-number">Episodio '+ep+'</span><span class="onebase-episode-state">'+state+'</span></button>'}).join('');
  grid.querySelectorAll('[data-ep]').forEach(b=>b.addEventListener('click',()=>setWatchedEpisode(Number(b.dataset.ep))));
  if(pagination){pagination.innerHTML=episodeTotalPages>1?'<button type="button" data-episode-page="prev" '+(episodePage===0?'disabled':'')+'>‹ Anteriores</button><span>Episodios '+start+'–'+end+' de '+total+'</span><button type="button" data-episode-page="next" '+(episodePage>=episodeTotalPages-1?'disabled':'')+'>Siguientes ›</button>':'';pagination.querySelectorAll('[data-episode-page]').forEach(b=>b.addEventListener('click',()=>{episodePage+=b.dataset.episodePage==='next'?1:-1;renderEpisodes()}))}
  const source=$('#onebaseEpisodesModal [data-ep-action="source"]'),nextEpisode=watched+1,complete=Boolean(total&&watched>=total);if(source){source.textContent=complete?'Serie completada · '+watched+' vistos':'Buscar dónde ver · episodio '+nextEpisode;source.disabled=complete;source.setAttribute('aria-label',complete?'Todos los episodios están vistos':'Buscar dónde ver el episodio '+nextEpisode)}
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
    const total=Number(item.total)||Number(item.knownTotal)||0,watched=Number(item.watched)||0;
    if(total&&watched>=total){window.toast?.('Ya has visto todos los episodios disponibles.');return}
    const ep=watched+1;
    const modal=$('#sourceModal');if(modal)modal.dataset.sourceEpisode=String(ep);
    row?.querySelector('.animeLink')?.click();closeEpisodes();return;
  }
  if(action==='latest'){const t=Number(item.total)||Number(item.knownTotal)||0;if(t)setWatchedEpisode(t);return}
  if(action==='first'){setWatchedEpisode(0);return}
  if(action==='jump'){const field=$('#onebaseEpisodeJump'),t=Number(item.total)||Number(item.knownTotal)||0;if(!t)return;const v=Math.min(t,Math.max(1,Math.floor(Number(field?.value)||1)));episodePage=Math.floor((v-1)/50);renderEpisodes();const target=$('#onebaseEpisodeGrid [data-ep="'+v+'"]');target?.focus();target?.scrollIntoView({block:'nearest'})}
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
  const library=libraryPersistenceProbe();
  const tests=[
    ['core','Núcleo OneBase',Boolean(window.__ONEBASE_CORE_READY__),'La aplicación principal ha marcado su arranque como correcto.'],
    ['library','Biblioteca',library.ok,library.detail],
    ['storage','Persistencia local',storageProbe(),'localStorage responde a lectura/escritura.'],
    ['cloud','Guardado en cuenta',document.documentElement.dataset.atSession !== '1' || window.OneBaseLibrarySync?.status !== 'failed',document.documentElement.dataset.atSession !== '1' ? 'Modo local: no hay cuenta conectada.' : window.OneBaseLibrarySync?.status === 'saved' ? 'La última escritura en la nube se confirmó.' : window.OneBaseLibrarySync?.status === 'failed' ? 'La última escritura en la nube falló: revisa la conexión o los permisos.' : 'Todavía no hay una escritura en la nube confirmada.'],
    ['render','Render',typeof window.render==='function','La función de renderizado está disponible.'],
    ['sources','Fuentes',Boolean(window.OneBaseSourceSearchV2?.search),'El módulo de búsqueda de fuentes está cargado.'],
    ['notifications','Notificaciones','serviceWorker' in navigator,'Service Worker disponible en este navegador.'],
    ['backup','Backup',await httpCheck('/backup/index.html'),'La instantánea pública de recuperación responde.'],
    ['server','API OneBase',await httpCheck('/api/onebase-health'),'El endpoint de salud del backend responde.']
  ];
  const grid=$('#onebaseHealthGrid');grid.innerHTML=tests.map(t=>'<div class="onebase-health-item '+(t[2]?'ok':'fail')+'"><span class="onebase-health-icon">'+(t[2]?'✓':'×')+'</span><span><b class="onebase-health-name">'+esc(t[1])+'</b><span class="onebase-health-detail">'+esc(t[3])+'</span></span><span class="onebase-health-state">'+(t[2]?'OK':'FALLO')+'</span></div>').join('');
  const ok=tests.filter(t=>t[2]).length;$('#onebaseHealthSummary').textContent=ok+'/'+tests.length+' pruebas superadas · '+new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
}
function libraryPersistenceProbe(){
  try{
    const live=window.__ONEBASE_DATA__;
    if(!Array.isArray(live))return {ok:false,detail:'El núcleo todavía no ha expuesto la biblioteca en memoria.'};
    const raw=localStorage.getItem('anime_tracker_v6');
    if(raw===null)return {ok:false,detail:'No existe una copia local de la biblioteca. Guarda un cambio para crearla.'};
    const stored=JSON.parse(raw);
    if(!Array.isArray(stored))return {ok:false,detail:'La copia local no contiene una biblioteca válida.'};
    const relevant=list=>list.filter(x=>x&&String(x.anime||'').trim()).map(x=>({
      id:String(x.aniId||x.anilistId||x.anime).trim().toLowerCase(),
      name:String(x.anime||'').trim().toLowerCase(),
      watched:Number(x.watched)||0,
      total:Number(x.total)||0,
      state:String(x.state||'')
    })).sort((a,b)=>a.id.localeCompare(b.id));
    const memory=relevant(live),disk=relevant(stored);
    if(JSON.stringify(memory)===JSON.stringify(disk))return {ok:true,detail:memory.length+' animes: capítulos y estados coinciden con la copia local.'};
    const changed=memory.filter((x,i)=>JSON.stringify(x)!==JSON.stringify(disk[i]));
    const example=changed[0];
    return {ok:false,detail:'Hay cambios aún no reflejados en el almacenamiento ('+memory.length+' en memoria / '+disk.length+' guardados).'+(example?' Revisa: '+example.name+'.':'')+' Espera unos segundos y repite la prueba.'};
  }catch(e){return {ok:false,detail:'Error leyendo la copia local: '+String(e?.message||e)}}
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
  document.addEventListener('click',e=>{const b=e.target?.closest?.('[data-epopen]');if(!b)return;e.preventDefault();e.stopImmediatePropagation();openEpisodes(Number(b.dataset.epopen))},true);
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
  const link=document.createElement('link');link.rel='stylesheet';link.href='/onebase-premium.css?v=15';document.head.appendChild(link);
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
let page='home',q='',st='all',genre='all',sort='recent',score='all',progress='all',fav=false,libraryKind='all',booted=false;
let lootRoll=null,lootBusy=false,lootResolved=new Set(),lootHistory=loadLootHistory();
const items=()=>data().map((x,i)=>({x,i})).filter(o=>o.x&&String(o.x.anime||'').trim());
const screenItems=()=>window.OneBaseScreenLibrary?.items?.()||[];
const unifiedItems=()=>[...items().map(o=>({kind:'anime',key:o.i,x:o.x,title:o.x.anime,cover:o.x.cover||o.x.coverImage||'',state:o.x.state||'pendiente',genres:o.x.genres||[],score:o.x.score,watched:Number(o.x.watched)||0,total:Number(o.x.total)||0})),...screenItems().map(x=>({kind:x.type==='tv'?'series':'movie',key:x.id,x,title:x.title||x.name||'Sin título',cover:x.posterPath?'https://image.tmdb.org/t/p/w500'+x.posterPath:'',state:x.state||'pendiente',genres:x.genres||[],score:x.score,watched:0,total:0}))];
const stats=()=>{const a=items().map(o=>o.x),m=screenItems(),w=a.reduce((s,x)=>s+(Number(x.watched)||0),0),t=a.reduce((s,x)=>s+(Number(x.total)||0),0),c=a.filter(x=>x.total!==''&&Number(x.watched)>=Number(x.total)).length,r=a.filter(x=>x.score!==''&&Number.isFinite(Number(x.score))),h=a.reduce((s,x)=>s+(Number(x.watched)||0)*(Number(x.durationMin||x.duration)||0)/60,0);return{a,w,t,c,r,h,p:a.reduce((s,x)=>s+Math.max(0,(Number(x.total)||0)-(Number(x.watched)||0)),0),f:a.filter(x=>x.favorite).length+m.filter(x=>x.favorite).length,active:a.filter(x=>x.state==='viendo').length+m.filter(x=>x.state==='viendo').length,m,movies:m.filter(x=>x.type==='movie'),series:m.filter(x=>x.type==='tv'),total:a.length+m.length,completed:c+m.filter(x=>x.state==='terminado').length,allRated:[...r,...m.filter(x=>x.score!==''&&Number.isFinite(Number(x.score)))],allGenres:[...a,...m].flatMap(x=>x.genres||[]),favorites:a.filter(x=>x.favorite).length+m.filter(x=>x.favorite).length}};
const fmt=n=>new Intl.NumberFormat('es-ES').format(Math.round(Number(n)||0));
const transition=fn=>{if(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||!document.startViewTransition){fn();return}try{document.startViewTransition(fn)}catch(_){fn()}};
function setup(){
 if($('#onebasePageApp'))return;
 const main=$('main');if(!main)return;
 const app=document.createElement('section');app.id='onebasePageApp';app.className='onebase-page-app';main.prepend(app);
 app.addEventListener('click',e=>{
  const b=e.target?.closest?.('[data-go],[data-ob-add],[data-open],[data-epopen],[data-discover-genre],[data-discover-roll],[data-discover-open]');if(!b)return;
  if(b.matches('[data-discover-genre]')){e.preventDefault();window.__ONEBASE_DISCOVER_GENRE__=b.dataset.discoverGenre;rollDiscovery();return}
  if(b.matches('[data-discover-roll]')){e.preventDefault();rollDiscovery();return}
  if(b.matches('[data-discover-open]')){e.preventDefault();openInfo(Number(b.dataset.discoverOpen));return}
  if(b.matches('[data-epopen]')){e.preventDefault();window.OneBasePremium?.openEpisodes?.(Number(b.dataset.epopen));return}
  if(b.matches('[data-go]')){e.preventDefault();navigate(b.dataset.go);return}
  if(b.matches('[data-ob-add]')){e.preventDefault();if(window.OneBaseLibraryAdd?.open)window.OneBaseLibraryAdd.open();else document.querySelector('#ob-library-add-chooser')?.classList.add('open');return}
  if(b.matches('[data-open]')){e.preventDefault();openInfo(Number(b.dataset.open))}
 });
 const side=document.createElement('aside');side.id='onebaseSidebar';side.className='onebase-sidebar';
 side.innerHTML='<div class="onebase-sidebar-brand"><span>◉</span><b>ONEBASE 2.0</b></div><nav><button data-page="home"><i>⌂</i><span>Inicio</span></button><button data-page="library"><i>▦</i><span>Biblioteca</span></button><button data-page="episodes"><i>▶</i><span>Episodios</span></button><button data-page="stats"><i>◈</i><span>Estadísticas</span></button><button data-page="profile"><i>♙</i><span>Perfil</span></button><button data-page="loot"><i>◇</i><span>Lootboxes</span></button></nav><div class="onebase-sidebar-bottom"><button data-page="health"><i>🛡</i><span>Health</span></button><button data-page="settings"><i>⚙</i><span>Ajustes</span></button><button type="button" id="onebaseToolsToggle" aria-controls="onebaseToolsMenu" aria-expanded="false"><i>•••</i><span>Más</span></button></div>';
 side.addEventListener('click',e=>{const b=e.target?.closest?.('[data-page]');if(b)navigate(b.dataset.page)});
 document.body.appendChild(side);
 const tools=document.createElement('div');tools.id='onebaseToolsMenu';tools.className='onebase-tools-menu';tools.hidden=true;
 tools.innerHTML='<div class="onebase-tools-head"><span>HERRAMIENTAS</span><button type="button" data-tools-close aria-label="Cerrar">×</button></div><button type="button" data-tool="refreshAll">↻ Actualizar datos</button><button type="button" data-tool="achBtn">✦ Logros</button><button type="button" data-tool="trashBtn">♻ Papelera</button><button type="button" data-tool="exportBtn">⇩ Exportar biblioteca</button><button type="button" data-tool="importBtn">⇧ Importar biblioteca</button><button type="button" data-tool="themeSelect">◐ Cambiar tema</button>';
 document.body.appendChild(tools);
 side.addEventListener('click',e=>{const b=e.target.closest('[data-page]');if(!b)return;navigate(b.dataset.page)});
 const toolsToggle=side.querySelector('#onebaseToolsToggle');
 const closeTools=()=>{tools.hidden=true;toolsToggle?.setAttribute('aria-expanded','false')};
 toolsToggle?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();tools.hidden=!tools.hidden;toolsToggle.setAttribute('aria-expanded',String(!tools.hidden))});
 tools.querySelector('[data-tools-close]')?.addEventListener('click',closeTools);
 tools.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>{
   const id=b.dataset.tool,el=document.getElementById(id);
   if(id==='themeSelect'&&el){try{el.showPicker?.();}catch(_){el.focus();el.click()}} else el?.click();
   closeTools();
 }));
 document.addEventListener('click',e=>{if(!tools.hidden&&!tools.contains(e.target)&&!side.contains(e.target))closeTools()});
 ['main > .dashboard','main > .toolbar','main > .table','main > .hint','main > .footerNote','main > .onebase-home-panel'].forEach(s=>$$ (s).forEach(el=>el.classList.add('onebase-legacy-hidden')));
 document.body.classList.add('onebase-pages-mode');
}
function navigate(p,push=true){
 if(p==='health'){window.OneBasePremium?.openHealth?.();return}
 if(p==='settings'){if(window.OneBaseSettings?.open){window.OneBaseSettings.open();}else{document.getElementById('settingsBtn')?.click();}return}
 if(!['home','library','episodes','stats','profile','loot'].includes(p))p='home';
 page=p;
 if(push){try{history.pushState({onebasePage:p},'',location.pathname+'#'+p)}catch(_){}}
 transition(()=>render());
}
function shell(k,t,s,b){const action=(page==='home'||page==='library')?'<button type="button" class="ob-page-add" data-ob-add>＋ Añadir a biblioteca</button>':'';return '<div class="onebase-page-head"><div><div class="onebase-page-kicker">ONEBASE · '+esc(k)+'</div><h2>'+esc(t)+'</h2><p>'+esc(s)+'</p></div>'+action+'</div><div class="onebase-page-body">'+b+'</div>'}
function card(label,value,sub){return '<article class="ob-stat-card"><span>'+esc(label)+'</span><b>'+esc(value)+'</b><small>'+esc(sub||'')+'</small></article>'}
function discoveryPool(){
 return items().filter(({x})=>{
  const watched=Math.max(0,Number(x.watched)||0),total=Math.max(0,Number(x.total)||0);
  return x.state==='pendiente'||x.state==='abandonado'||(total>0&&watched<total);
 });
}
function home(){
 const s=stats(),all=unifiedItems(),pending=all.filter(o=>o.state==='pendiente'||o.state==='viendo'||o.state==='pausa').sort((a,b)=>(Number(b.x.updatedAt)||Number(b.x.addedAt)||0)-(Number(a.x.updatedAt)||Number(a.x.addedAt)||0)).slice(0,8);
 const rows=pending.map(o=>'<button type="button" class="ob-continue-row" '+(o.kind==='anime'?'data-epopen="'+o.key+'"':'data-media-open="'+o.kind+'" data-media-type="'+(o.kind==='series'?'tv':'movie')+'" data-media-id="'+o.key+'"')+'><span class="ob-continue-row-cover">'+(o.cover?'<img loading="lazy" src="'+esc(o.cover)+'" alt="">':'')+'</span><span><strong>'+esc(o.title)+'</strong><small>'+esc(({viendo:'En curso',pendiente:'Por empezar',pausa:'En pausa'}[o.state]||'En tu biblioteca'))+(o.kind==='anime'&&o.total?' · '+o.watched+' / '+o.total+' episodios':' · '+({anime:'Anime',movie:'Película',series:'Serie'}[o.kind]))+'</small></span><span class="ob-continue-row-progress">›</span></button>').join('');
 const continueBlock=pending.length?'<section class="ob-continue-page"><div class="ob-continue-heading"><div><span>ONEBASE 2.0 · TU COLECCIÓN</span><h3>Continuar y descubrir</h3></div><button type="button" data-go="library">Biblioteca completa <b>→</b></button></div><div class="ob-continue-queue">'+rows+'</div></section>':'<section class="ob-continue-empty"><span>◈</span><h3>Tu biblioteca empieza aquí</h3><p>Añade anime, películas o series y sigue todo desde OneBase.</p><button type="button" class="ob-page-add" data-ob-add>＋ Añadir a biblioteca</button></section>';
 return shell('ONEBASE 2.0','Todo lo que sigues, en un solo lugar','Anime, películas y series conectados en tu biblioteca.', '<div class="ob-stat-grid">'+card('Todo',fmt(s.total),'en tu biblioteca')+card('Anime',fmt(s.a.length),'colección')+card('Películas',fmt(s.movies.length),'colección')+card('Series',fmt(s.series.length),'colección')+card('En curso',fmt(s.active),'para continuar')+card('Favoritos',fmt(s.favorites),'de todos los formatos')+'</div>'+continueBlock+'<div class="ob-home-actions"><button type="button" class="ob-page-add" data-go="library">Abrir biblioteca</button><button type="button" class="ob-page-add" data-go="stats">Ver estadísticas</button><button type="button" class="ob-page-add" data-go="loot">Abrir lootboxes</button></div>');
}
function library(){
 const media=window.OneBaseScreenLibrary?.items?.()||[], anime=items(), all=[...anime.map(o=>({kind:'anime',key:o.i,x:o.x})),...media.map(x=>({kind:x.type==='tv'?'series':'movie',key:x.id,x:{...x,state:x.state||'pendiente'}}))];
 const title=x=>String(x.anime||x.title||x.name||''), statusOf=x=>x.state||'pendiente', matchesKind=o=>{switch(libraryKind){case 'anime':return o.kind==='anime';case 'movies':return o.kind==='movie';case 'series':return o.kind==='series';default:return true}};
 let a=all.filter(o=>matchesKind(o)&&(!q||title(o.x).toLowerCase().includes(q.toLowerCase().trim()))&&(st==='all'||statusOf(o.x)===st)&&(genre==='all'||(Array.isArray(o.x.genres)&&o.x.genres.some(g=>String(g).toLowerCase()===genre.toLowerCase()))));
 if(libraryKind==='anime')a=a.filter(o=>{const x=o.x;if(fav&&!x.favorite)return false;if(score==='rated'&&(x.score===''||!Number.isFinite(Number(x.score))))return false;if(score==='8'&&Number(x.score)<8)return false;if(score==='9'&&Number(x.score)<9)return false;if(progress==='none'&&(Number(x.watched)||0)!==0)return false;if(progress==='active'&&!(Number(x.watched)>0&&Number(x.total)>Number(x.watched)))return false;if(progress==='complete'&&!(Number(x.total)>0&&Number(x.watched)>=Number(x.total)))return false;if(progress==='new'&&!(Number(x.newEpisodes)>0))return false;if(progress==='airing'&&String(x.apiStatus||'')!=='RELEASING')return false;return true});
 const genresFor=[...new Set(all.filter(matchesKind).flatMap(o=>Array.isArray(o.x.genres)?o.x.genres:[]).map(String).filter(Boolean))].sort((x,y)=>x.localeCompare(y,'es'));
 a.sort((x,y)=>sort==='name'?title(x.x).localeCompare(title(y.x),'es'):sort==='score'?(Number(y.x.score??y.x.voteAverage)||0)-(Number(x.x.score??x.x.voteAverage)||0):sort==='progress'?((Number(y.x.watched)||0)/(Number(y.x.total)||1))-((Number(x.x.watched)||0)/(Number(x.x.total)||1)):(Number(y.x.updatedAt||y.x.addedAt)||0)-(Number(x.x.updatedAt||x.x.addedAt)||0));
 const kinds=[['all','Todo'],['anime','Anime'],['movies','Películas'],['series','Series']].map(([v,label])=>'<button type="button" class="ob-library-tab '+(libraryKind===v?'active':'')+'" data-library-kind="'+v+'">'+label+' <span>'+all.filter(o=>v==='all'||(v==='anime'?o.kind==='anime':v==='movies'?o.kind==='movie':o.kind==='series')).length+'</span></button>').join('');
 const opts=Object.entries(status).map(([k,v])=>'<option value="'+k+'" '+(st===k?'selected':'')+'>'+v+'</option>').join('');
 const cards=a.length?a.map((o,n)=>{const x=o.x,c=o.kind==='anime'?(x.cover||x.coverImage||''):(x.posterPath?`https://image.tmdb.org/t/p/w500${x.posterPath}`:''), label=title(x), state=statusOf(x), meta=o.kind==='anime'?((Number(x.watched)||0)+' / '+(Number(x.total)||0)+' episodios'):(o.kind==='movie'?'Película':'Serie')+' · '+(String(x.releaseDate||'').slice(0,4)||'—')+(o.kind==='series'?' · '+Object.values(x.seasonProgress||{}).reduce((sum,n)=>sum+(Number(n)||0),0)+' vistos':''), rating=o.kind==='anime'?Number(x.score)||0:Number(x.voteAverage)||0;
  if(o.kind==='anime'){const w=Number(x.watched)||0,t=Number(x.total)||0,p=t?Math.min(100,w/t*100):0;return '<article class="ob-anime-card '+cardFlags(x)+'" style="--ob-card-i:'+Math.min(n,20)+'"><button class="ob-card-open" data-open="'+o.key+'"><div class="ob-card-cover">'+(c?'<img loading="lazy" src="'+esc(c)+'" alt="Portada de '+esc(label)+'">':'<span>SIN PORTADA</span>')+'</div><div class="ob-card-body"><h3>'+esc(label)+'</h3><div class="ob-card-meta"><span>'+esc(status[state]||'Sin estado')+'</span>'+(rating?'<span>★ '+rating.toFixed(1)+'</span>':'')+'</div><div class="ob-card-progress"><span style="width:'+p+'%"></span></div><div class="ob-card-foot"><small>'+esc(meta)+'</small><small>'+ (t?Math.round(p)+'%':'—')+'</small></div></div></button></article>'}
  return '<article class="ob-anime-card ob-media-card '+cardFlags({state,favorite:x.favorite})+'" style="--ob-card-i:'+Math.min(n,20)+'"><button type="button" class="ob-card-open" data-media-open="'+esc(o.kind)+'" data-media-type="'+esc(x.type)+'" data-media-id="'+esc(o.key)+'"><div class="ob-card-cover">'+(c?'<img loading="lazy" src="'+esc(c)+'" alt="Portada de '+esc(label)+'">':'<span>SIN PORTADA</span>')+'</div><div class="ob-card-body"><h3>'+esc(label)+'</h3><div class="ob-card-meta"><span>'+esc(status[state]||'Sin estado')+'</span><span>'+esc(o.kind==='movie'?'Película':'Serie')+'</span>'+(rating?'<span>TMDB '+rating.toFixed(1)+'</span>':'')+'</div><div class="ob-card-foot"><small>'+esc(meta)+'</small></div></div></button></article>'}).join(''):'<div class="ob-empty ob-empty-large">No hay contenido que coincida con estos filtros.</div>';
 const animeOnly=libraryKind==='anime';
 return shell('BIBLIOTECA','Tu biblioteca','Organiza tus animes, películas y series en un solo lugar.',
 '<div class="ob-library-tabs">'+kinds+'</div><div class="ob-library-tools"><input id="obLibSearch" value="'+esc(q)+'" placeholder="Buscar en la biblioteca…" autocomplete="off"><details class="ob-library-filters" open><summary>☷ Filtros</summary><div class="ob-library-filter-grid"><select id="obLibStatus"><option value="all">Todos los estados</option>'+opts+'</select><select id="obLibGenre"><option value="all">Todos los géneros</option>'+genresFor.map(x=>'<option value="'+esc(x)+'" '+(genre===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select><select id="obLibSort"><option value="recent" '+(sort==='recent'?'selected':'')+'>Más recientes</option><option value="name" '+(sort==='name'?'selected':'')+'>Nombre A-Z</option><option value="score" '+(sort==='score'?'selected':'')+'>Mayor nota</option></select>'+(animeOnly?'<select id="obLibScore"><option value="all">Cualquier nota</option><option value="rated" '+(score==='rated'?'selected':'')+'>Con nota personal</option><option value="8" '+(score==='8'?'selected':'')+'>Nota ≥ 8</option><option value="9" '+(score==='9'?'selected':'')+'>Nota ≥ 9</option></select><select id="obLibProgress"><option value="all">Cualquier progreso</option><option value="none" '+(progress==='none'?'selected':'')+'>Sin empezar</option><option value="active" '+(progress==='active'?'selected':'')+'>En progreso</option><option value="complete" '+(progress==='complete'?'selected':'')+'>Completados</option><option value="new" '+(progress==='new'?'selected':'')+'>Con episodios nuevos</option><option value="airing" '+(progress==='airing'?'selected':'')+'>En emisión</option></select><button id="obLibFav" class="'+(fav?'active':'')+'">☆ Favoritos</button>':'')+'</div></details></div><div class="ob-library-meta"><span>'+a.length+' de '+all.filter(matchesKind).length+' elementos</span><span>Tarjeta: abre la ficha · portada en la ficha: Wikipedia</span></div><div class="ob-library-grid">'+cards+'</div>');
}

function episodes(){
 const active=items().filter(o=>o.x.state==='viendo'&&(!(Number(o.x.total)||Number(o.x.knownTotal))||(Number(o.x.watched)||0)<(Number(o.x.total)||Number(o.x.knownTotal)))).sort((a,b)=>(Number(b.x.updatedAt)||Number(b.x.watched)||0)-(Number(a.x.updatedAt)||Number(a.x.watched)||0));
 const planned=items().filter(o=>o.x.state==='pendiente').sort((a,b)=>(Number(b.x.updatedAt)||0)-(Number(a.x.updatedAt)||0));
 const upcoming=items().filter(o=>Number(o.x.nextAiringAt)>0&&Number(o.x.nextAiringEpisode)>0&&Number(o.x.nextAiringAt)*1000>Date.now()-86400000).sort((a,b)=>Number(a.x.nextAiringAt)-Number(b.x.nextAiringAt)).slice(0,3);
 const queue=active.length?active.slice(1,6):planned.slice(1,6),featured=active[0]||planned[0];
 const x=featured?.x,cover=String(x?.cover||x?.coverImage||'').trim(),watched=Number(x?.watched)||0,total=Number(x?.total)||0,next=watched+1;
 const featuredCard=x?'<section class="ob-continue-feature"><div class="ob-continue-poster">'+(cover?'<img src="'+esc(cover)+'" alt="Portada de '+esc(x.anime)+'">':'<span>ONEBASE</span>')+'<span class="ob-continue-tag">'+(active.length?'EN CURSO':'POR EMPEZAR')+'</span></div><div class="ob-continue-copy"><div class="ob-continue-kicker">'+(active.length?'RETOMA DONDE LO DEJASTE':'TU PRÓXIMA SERIE')+'</div><h3>'+esc(x.anime)+'</h3><p>'+(total?watched+' de '+total+' episodios vistos':'Progreso listo para empezar')+'</p>'+(total?'<div class="ob-continue-progress"><span style="width:'+Math.min(100,watched/total*100)+'%"></span></div>':'')+'<button type="button" class="ob-continue-cta" data-epopen="'+featured.i+'" onclick="window.OneBasePages.openEpisodes(this.dataset.epopen)">'+(active.length?'Continuar · episodio '+Math.min(next,total||next):'Empezar a seguir')+' <span>→</span></button></div></section>':'<section class="ob-continue-empty"><span>▶</span><h3>Tu próxima sesión empieza aquí</h3><p>Elige un anime de tu biblioteca y sigue su progreso capítulo a capítulo.</p><button type="button" class="ob-page-add" data-go="library">Ir a mi biblioteca</button></section>';
 const row=o=>{const a=o.x,c=a.cover||a.coverImage||'',w=Number(a.watched)||0,t=Number(a.total)||0;return '<button type="button" class="ob-continue-row" data-epopen="'+o.i+'" onclick="window.OneBasePages.openEpisodes(this.dataset.epopen)"><span class="ob-continue-row-cover">'+(c?'<img loading="lazy" src="'+esc(c)+'" alt="">':'')+'</span><span><strong>'+esc(a.anime)+'</strong><small>'+(a.state==='viendo'?(w?('Siguiente · episodio '+(w+1)):'Sin episodios vistos'):'Pendiente de empezar')+'</small></span><span class="ob-continue-row-progress">'+(t?Math.round(w/t*100)+'%':'›')+'</span></button>'};
 return shell('EPISODIOS','Sigue por donde ibas','Una pantalla para elegir serie y continuar sin perderte entre estadísticas.',
 '<section class="ob-continue-page"><div class="ob-continue-heading"><div><span>PLAY · TU SIGUIENTE CAPÍTULO</span><h3>Continuar viendo</h3></div><button type="button" data-go="library">Ver biblioteca <b>→</b></button></div>'+featuredCard+(queue.length?'<div class="ob-continue-queue"><div class="ob-continue-queue-title">TAMBIÉN EN TU LISTA</div>'+queue.map(row).join('')+'</div>':'')+(upcoming.length?'<div class="ob-continue-air"><span>PRÓXIMOS</span>'+upcoming.map(o=>'<button type="button" data-epopen="'+o.i+'" onclick="window.OneBasePages.openEpisodes(this.dataset.epopen)"><b>'+esc(o.x.anime)+'</b><small>Ep. '+esc(o.x.nextAiringEpisode)+' · '+esc(remain(o.x.nextAiringAt))+'</small></button>').join('')+'</div>':'')+'</section>');
}
function loadLootHistory(){try{const v=JSON.parse(localStorage.getItem('onebase_lootbox_history_v1')||'[]');return new Set(Array.isArray(v)?v.map(Number).filter(Number.isFinite):[])}catch(_){return new Set()}}
function saveLootHistory(){try{localStorage.setItem('onebase_lootbox_history_v1',JSON.stringify([...lootHistory].slice(-300)))}catch(_){}}
function lootTastes(){
  const rows=items().map(o=>o.x);
  const weights={};
  rows.forEach(x=>{
    const base=x.score!==''&&Number.isFinite(Number(x.score))?1+Number(x.score)/10:.8;
    (Array.isArray(x.genres)?x.genres:[]).forEach(g=>{const k=String(g||'').trim();if(k)weights[k]=(weights[k]||0)+base});
  });
  const ranked=Object.entries(weights).sort((a,b)=>b[1]-a[1]).slice(0,8);
  return ranked.length?ranked.map(x=>x[0]):['Action','Adventure','Comedy'];
}
function lootExcludedIds(){
  const ids=new Set(lootHistory);
  items().forEach(o=>{const id=Number(o.x.aniId||o.x.anilistId);if(Number.isFinite(id)&&id>0)ids.add(id)});
  return [...ids].slice(-10000);
}
function lootTitle(x){return x?.title?.userPreferred||x?.title?.english||x?.title?.romaji||'Anime recomendado'}
function lootCover(x){return x?.coverImage?.extraLarge||x?.coverImage?.large||x?.coverImage?.medium||''}
function lootPick(candidates,tastes){
  const excludedTitles=new Set(lootExcludedTitles().map(lootTitleKey));
  const pool=candidates.filter(x=>x&&!lootHistory.has(Number(x.id))&&!excludedTitles.has(lootTitleKey(lootTitle(x))));
  const picked=[],used=new Set();
  const weights=new Map(tastes.map((g,i)=>[g.toLowerCase(),Math.max(1,tastes.length-i)]));
  while(picked.length<5&&picked.length<pool.length){
    const available=pool.filter(x=>!used.has(Number(x.id)));
    const scored=available.map(x=>{
      const overlap=(Array.isArray(x.genres)?x.genres:[]).reduce((s,g)=>s+(weights.get(String(g).toLowerCase())||0),0);
      const popularity=Math.min(10,Math.log10(Math.max(1,Number(x.popularity)||1)));
      return {x,weight:Math.max(.5,overlap*2+popularity+Math.random()*6)};
    });
    const total=scored.reduce((s,o)=>s+o.weight,0);let r=Math.random()*total,chosen=scored[0]?.x;
    for(const o of scored){r-=o.weight;if(r<=0){chosen=o.x;break}}
    if(!chosen)break;
    used.add(Number(chosen.id));picked.push(chosen);
  }
  return picked;
}
async function fetchLootRecommendations(){
  const tastes=lootTastes();
  const body={genres:tastes.slice(0,8),excludeIds:lootExcludedIds(),excludeTitles:lootExcludedTitles(),page:1+Math.floor(Math.random()*3)};
  const r=await fetch('/api/lootbox-recommendations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await r.json().catch(()=>null);
  if(!r.ok||!payload?.ok)throw new Error(payload?.error||'No se pudieron cargar las recomendaciones.');
  const picks=lootPick(Array.isArray(payload.results)?payload.results:[],tastes);
  if(picks.length<5)throw new Error('No hay suficientes recomendaciones nuevas para esta tirada.');
  return picks.map(x=>({id:Number(x.id),title:lootTitle(x),cover:lootCover(x),banner:String(x.bannerImage||''),genres:Array.isArray(x.genres)?x.genres.slice(0,6):[],description:String(x.description||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),episodes:Number(x.episodes)||0,duration:Number(x.duration)||0,status:String(x.status||''),score:Number(x.averageScore)||0,popularity:Number(x.popularity)||0,siteUrl:String(x.siteUrl||'')}));
}
function lootMeta(x){return (x.genres||[]).slice(0,3).join(' · ')||'Recomendación personalizada'}
function lootCard(x,i,locked,resolved){
  const state=resolved?'resolved':locked?'locked':'ready';
  return '<article class="ob-loot-box '+state+'" data-loot-index="'+i+'"><button type="button" class="ob-loot-box-button" data-loot-open="'+i+'" '+(locked||resolved?'disabled':'')+'><span class="ob-loot-box-rgb"></span><span class="ob-loot-box-lid"><i>◇</i></span><span class="ob-loot-box-number">'+String(i+1).padStart(2,'0')+'</span><span class="ob-loot-box-label">'+(resolved?'RESUELTA':locked?'BLOQUEADA':'ABRIR')+'</span></button></article>';
}
function lootDetail(x){
  return '<section class="ob-loot-reveal"><div class="ob-loot-reveal-media">'+(x.cover?'<img src="'+esc(x.cover)+'" alt="">':'<div class="ob-loot-no-cover">ONEBASE</div>')+'</div><div class="ob-loot-reveal-copy"><div class="onebase-page-kicker">ONEBASE · DROP PERSONALIZADO</div><h3>'+esc(x.title)+'</h3><p class="ob-loot-meta">'+esc(lootMeta(x))+'</p><div class="ob-loot-score">★ '+(x.score?Number(x.score/10).toFixed(1):'—')+' <span>AniList</span></div><p class="ob-loot-description">'+esc(x.description||'Sin descripción disponible.')+'</p><div class="ob-loot-actions"><button type="button" class="ob-loot-save" data-loot-action="save">＋ Guardar como pendiente</button><button type="button" class="ob-loot-discard" data-loot-action="discard">♻ Tirar a la basura</button></div></div></section>';
}
async function prepareLoot(){
  if(lootRoll||lootBusy)return;
  lootBusy=true;render();
  try{lootRoll=await fetchLootRecommendations();lootBusy=false;render()}
  catch(e){lootBusy=false;lootRoll=[];render();window.toast?.(String(e?.message||e))}
}
function saveLootAsPending(){
  if(!lootRoll?.[lootOpenIndex])return;
  const x=lootRoll[lootOpenIndex],existing=items().some(o=>Number(o.x.aniId||o.x.anilistId)===x.id||String(o.x.anime||'').toLowerCase()===x.title.toLowerCase());
  if(existing){lootHistory.add(x.id);saveLootHistory();lootResolved.add(lootOpenIndex);lootOpenIndex=null;render();window.toast?.('Ese anime ya está en tu biblioteca.');return}
  const d=data();
  d.push({anime:x.title,watched:'0',total:x.episodes?String(x.episodes):'',duration:x.duration?String(x.duration):'',durationMin:x.duration||0,state:'pendiente',score:'',favorite:false,cover:x.cover,coverImage:x.cover,bannerImage:x.banner,description:x.description,genres:x.genres,apiStatus:x.status,anilistStatus:x.status,apiScore:x.score?x.score/10:0,aniId:x.id,anilistId:x.id,knownTotal:x.episodes?String(x.episodes):'',plannedEpisodes:x.episodes?String(x.episodes):'',newEpisodes:0,siteUrl:x.siteUrl,source:'onebase-lootbox',addedAt:Date.now(),updatedAt:Date.now()});
  try{window.save?.()}catch(_){}
  lootHistory.add(x.id);saveLootHistory();lootResolved.add(lootOpenedIndex);lootOpenIndex=null;lootConsumed=true;window.toast?.('✓ Guardado como pendiente. Las demás cajas quedan bloqueadas hasta una nueva tirada.');render();
}
function discardLoot(){
  const x=lootRoll?.[lootOpenIndex];if(!x)return;
  lootHistory.add(x.id);saveLootHistory();lootResolved.add(lootOpenedIndex);lootOpenIndex=null;lootConsumed=true;render();window.toast?.('Recomendación descartada. Las demás cajas quedan bloqueadas hasta una nueva tirada.');
}
let lootOpenIndex=null,lootOpenedIndex=null,lootOpeningIndex=null,lootConsumed=false;
let lootAudioContext=null;
function lootboxes(){
  if(!lootRoll&&!lootBusy)void prepareLoot();
  const boxes=lootRoll||[],hasOpened=lootOpenedIndex!==null||lootConsumed;
  const body=lootBusy?'<div class="ob-loot-loading"><span></span><b>Analizando tus gustos…</b><small>ONEBASE está buscando candidatos en AniList.</small></div>':(!boxes.length?'<div class="ob-loot-loading"><b>No se pudo preparar la tirada.</b><button type="button" class="ob-page-add" data-loot-retry>↻ Reintentar</button></div>':'<div class="ob-loot-grid">'+boxes.map((x,i)=>lootCard(x,i,hasOpened&&i!==lootOpenedIndex,lootResolved.has(i),hasOpened&&i!==lootOpenedIndex,lootOpeningIndex===i)).join('')+'</div>')+(lootOpenIndex!==null&&boxes[lootOpenIndex]?lootDetail(boxes[lootOpenIndex]):'')+(hasOpened?'<div class="ob-loot-new-wrap"><p class="ob-loot-lock-note">🔒 Tirada consumida · las otras cuatro cajas quedan bloqueadas.</p><button type="button" class="ob-page-add" data-loot-new>✦ Nueva tirada de 5 cajas</button></div>':'');
  return shell('LOOTBOXES','Tu drop personalizado','Cinco cajas reales. Abres una; las otras revelan qué contenían, pero quedan selladas hasta la próxima tirada.',body);
}
function statistics(){
 const s=stats(),rated=s.allRated,avg=rated.length?rated.reduce((z,x)=>z+Number(x.score),0)/rated.length:0,g={};s.allGenres.forEach(k=>g[k]=(g[k]||0)+1);const gs=Object.entries(g).sort((a,b)=>b[1]-a[1]).slice(0,8),ratings=Array.from({length:11},(_,i)=>rated.filter(x=>Math.round(Number(x.score))===i).length);
 return shell('ESTADÍSTICAS','Tu actividad completa','Anime, películas y series forman parte de tus números.', '<div class="ob-stat-grid ob-stat-grid-large">'+card('Contenido total',fmt(s.total),'en la biblioteca')+card('Anime',fmt(s.a.length),'colección')+card('Películas',fmt(s.movies.length),'colección')+card('Series',fmt(s.series.length),'colección')+card('Completados',fmt(s.completed),'todos los formatos')+card('Favoritos',fmt(s.favorites),'todos los formatos')+card('Episodios',fmt(s.w),'anime vistos')+card('Tiempo',s.h>=24?(s.h/24).toFixed(1)+' días':s.h.toFixed(1)+' h','anime estimado')+card('Progreso anime',s.t?Math.round(s.w/s.t*100)+'%':'—','episodios')+card('Nota media',avg?avg.toFixed(1)+'/10':'—',rated.length+' valoraciones')+'</div><div class="ob-stats-columns"><section class="ob-section-card"><header><h3>Géneros · todos los formatos</h3></header><div class="ob-bars">'+(gs.length?gs.map(x=>'<div class="ob-bar-row"><span>'+esc(x[0])+'</span><div><i style="width:'+Math.round(x[1]/gs[0][1]*100)+'%"></i></div><b>'+x[1]+'</b></div>').join(''):'<div class="ob-empty">Sin géneros todavía.</div>')+'</div></section><section class="ob-section-card"><header><h3>Distribución de notas</h3></header><div class="ob-rating-bars">'+ratings.map((n,i)=>'<div><span>'+i+'</span><i style="height:'+Math.max(4,n*18)+'px"></i><b>'+n+'</b></div>').join('')+'</div></section></div>');
}
function profilePage(){
 const p=prof(),s=stats(),progression=window.OneBaseExperience?.progression?.()||{level:1,xp:0,progress:0},name=String(p.name||'Usuario'),av=String(p.avatar||''),ini=name.trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'OB';
 const favoriteRows=[...items().filter(o=>o.x.favorite).map(o=>({kind:'anime',key:o.i,title:o.x.anime,cover:o.x.cover||o.x.coverImage||''})),...screenItems().filter(x=>x.favorite).map(x=>({kind:x.type==='tv'?'series':'movie',key:x.id,title:x.title||x.name||'',cover:x.posterPath?'https://image.tmdb.org/t/p/w500'+x.posterPath:''}))].slice(0,8);
 const favorites=favoriteRows.length?favoriteRows.map(o=>'<button '+(o.kind==='anime'?'data-open="'+o.key+'"':'data-media-open="'+o.kind+'" data-media-type="'+(o.kind==='series'?'tv':'movie')+'" data-media-id="'+o.key+'"')+'><span>'+(o.cover?'<img loading="lazy" src="'+esc(o.cover)+'" alt="">':'')+'</span><strong>'+esc(o.title)+'</strong></button>').join(''):'<div class="ob-empty">Todavía no tienes favoritos.</div>';
 return shell('PERFIL','Tu perfil','Tu espacio personal en OneBase 2.0.', '<section class="ob-profile-hero"><div class="ob-profile-avatar">'+(av?'<img src="'+esc(av)+'" alt="">':esc(ini))+'</div><div><div class="onebase-page-kicker">ONEBASE 2.0 · USUARIO</div><h3>'+esc(name)+'</h3><p>Nivel '+fmt(progression.level)+' · '+fmt(progression.xp)+' XP · '+Math.round(progression.progress*100)+'% al siguiente nivel</p></div><button id="obEditProfile">Editar perfil</button></section><div class="ob-stat-grid">'+card('Biblioteca',fmt(s.total),'todo el contenido')+card('Anime',fmt(s.a.length),'colección')+card('Películas',fmt(s.movies.length),'colección')+card('Series',fmt(s.series.length),'colección')+card('Favoritos',fmt(s.favorites),'todos los formatos')+'</div><section class="ob-section-card"><header><h3>★ Favoritos</h3><button data-go="library">Biblioteca</button></header><div class="ob-favorite-grid">'+favorites+'</div></section>');
}
function refreshLibraryResults(){const input=$('#obLibSearch'),position=input?.selectionStart;render();const next=$('#obLibSearch');if(next){next.focus();if(Number.isInteger(position))next.setSelectionRange(position,position)}}
function openInfo(i){document.querySelector('.row[data-index="'+i+'"] .infoBtn')?.click()}
function bind(){
 const app=$('#onebasePageApp');if(!app)return;
 app.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>navigate(b.dataset.go));
 app.querySelectorAll('[data-ob-add]').forEach(b=>b.onclick=()=>{if(window.OneBaseLibraryAdd?.open)window.OneBaseLibraryAdd.open();else window.OneBaseAniListSearch?.open?.()});
 app.querySelectorAll('[data-open]').forEach(b=>b.onclick=e=>{e.preventDefault();openInfo(Number(b.dataset.open))});app.querySelectorAll('[data-library-kind]').forEach(b=>b.onclick=()=>{libraryKind=b.dataset.libraryKind;st='all';genre='all';score='all';progress='all';fav=false;render()});app.querySelectorAll('[data-media-open]').forEach(b=>b.onclick=()=>window.OneBaseScreenLibrary?.openItem?.(b.dataset.mediaType||b.dataset.mediaOpen,b.dataset.mediaId));
 app.querySelectorAll('[data-epopen]').forEach(b=>b.onclick=()=>window.OneBasePremium?.openEpisodes?.(Number(b.dataset.epopen)));
 app.querySelectorAll('[data-discover-genre]').forEach(b=>b.onclick=()=>{window.__ONEBASE_DISCOVER_GENRE__=b.dataset.discoverGenre;rollDiscovery()});
 app.querySelectorAll('[data-discover-roll]').forEach(b=>b.onclick=rollDiscovery);
 app.querySelectorAll('[data-discover-open]').forEach(b=>b.onclick=()=>openInfo(Number(b.dataset.discoverOpen)));
 app.querySelectorAll('[data-loot-open]').forEach(b=>b.onclick=()=>{
  const i=Number(b.dataset.lootOpen);
  if(!Number.isInteger(i)||!lootRoll?.[i]||lootResolved.has(i)||lootOpenedIndex!==null||lootConsumed)return;
  lootOpeningIndex=i;playLootOpenSound();render();
  setTimeout(()=>{lootOpeningIndex=null;lootOpenedIndex=i;lootOpenIndex=i;render()},650);
});
 app.querySelectorAll('[data-loot-action="save"]').forEach(b=>b.onclick=saveLootAsPending);
 app.querySelectorAll('[data-loot-action="discard"]').forEach(b=>b.onclick=discardLoot);
 app.querySelectorAll('[data-loot-retry]').forEach(b=>b.onclick=()=>{lootRoll=null;lootResolved.clear();lootOpenIndex=null;lootOpenedIndex=null;lootOpeningIndex=null;lootConsumed=false;void prepareLoot()});
 app.querySelectorAll('[data-loot-new]').forEach(b=>b.onclick=()=>{lootRoll=null;lootResolved.clear();lootOpenIndex=null;lootOpenedIndex=null;lootOpeningIndex=null;lootConsumed=false;void prepareLoot()});
 const qel=$('#obLibSearch');if(qel){qel.oninput=()=>{q=qel.value;refreshLibraryResults()};$('#obLibStatus').onchange=e=>{st=e.target.value;render()};$('#obLibGenre').onchange=e=>{genre=e.target.value;render()};$('#obLibScore')?.addEventListener('change',e=>{score=e.target.value;render()});$('#obLibProgress')?.addEventListener('change',e=>{progress=e.target.value;render()});$('#obLibSort').onchange=e=>{sort=e.target.value;render()};$('#obLibFav')?.addEventListener('click',()=>{fav=!fav;render()})}
 $('#obEditProfile')?.addEventListener('click',()=>document.getElementById('profileTopBtn')?.click());
}
function render(){
 setup();
 const app=$('#onebasePageApp');
 if(!app)return;
 if(page==='loot'){
   $('#onebaseSidebar')?.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
   document.title='ONEBASE · Lootboxes';
   if(window.OneBaseLootV2?.render){window.OneBaseLootV2.render();return;}
   app.innerHTML='<div class="ob-empty-large">Preparando lootboxes…</div>';
   const ready=()=>{window.OneBaseLootV2?.render?.();};
   window.addEventListener('onebase:loot-v2-ready',ready,{once:true});
   return;
 }app.innerHTML=page==='home'?home():page==='library'?library():page==='episodes'?episodes():page==='stats'?statistics():page==='loot'?lootboxes():profilePage();$('#onebaseSidebar')?.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===page));bind();document.title='ONEBASE 2.0 · '+({home:'Inicio',library:'Biblioteca',episodes:'Episodios',stats:'Estadísticas',profile:'Perfil',loot:'Lootboxes'}[page]||'');}
function publishAPI(){window.OneBasePages={navigate,refresh:render,rollDiscovery,setDiscoveryGenre(value){window.__ONEBASE_DISCOVER_GENRE__=value||'all';rollDiscovery()},openDiscoveryPick(index){openInfo(Number(index))},openEpisodes(index){window.OneBasePremium?.openEpisodes?.(Number(index))}}}
function delegatePageClick(e){
 const choice=e.target?.closest?.('#ob-library-add-chooser [data-add-kind]');if(choice){e.preventDefault();e.stopImmediatePropagation();const kind=choice.dataset.addKind;document.querySelector('#ob-library-add-chooser')?.classList.remove('open');if(kind==='anime')window.OneBaseAniListSearch?.open?.();else window.OneBaseScreenLibrary?.open?.({type:kind==='movie'?'movie':'tv'});return}
 const closeChooser=e.target?.closest?.('#ob-library-add-chooser [data-close]');if(closeChooser){e.preventDefault();e.stopImmediatePropagation();document.querySelector('#ob-library-add-chooser')?.classList.remove('open');return}
 const target=e.target?.closest?.('[data-page],[data-go],[data-ob-add],[data-open],[data-epopen],[data-discover-genre],[data-discover-roll],[data-discover-open]');if(!target)return;
 e.preventDefault();e.stopImmediatePropagation();
 if(target.matches('[data-page]')){navigate(target.dataset.page);return}
 if(target.matches('[data-discover-genre]')){window.__ONEBASE_DISCOVER_GENRE__=target.dataset.discoverGenre;rollDiscovery();return}
 if(target.matches('[data-discover-roll]')){rollDiscovery();return}
 if(target.matches('[data-discover-open]')){openInfo(Number(target.dataset.discoverOpen));return}
 if(target.matches('[data-epopen]')){window.OneBasePremium?.openEpisodes?.(Number(target.dataset.epopen));return}
 if(target.matches('[data-go]')){navigate(target.dataset.go);return}
 if(target.matches('[data-ob-add]')){if(window.OneBaseLibraryAdd?.open)window.OneBaseLibraryAdd.open();else document.querySelector('#ob-library-add-chooser')?.classList.add('open');return}
 if(target.matches('[data-open]'))openInfo(Number(target.dataset.open))
}
function installPageRuntime(){publishAPI();if(!window.__ONEBASE_PAGE_CLICK_BOUND__){window.__ONEBASE_PAGE_CLICK_BOUND__=true;document.addEventListener('click',delegatePageClick,true)}}
installPageRuntime();
function boot(){
 if(booted)return;booted=true;installPageRuntime();
 try{setup()}catch(e){console.error('[ONEBASE] page setup failed',e)}
 const h=location.hash.slice(1);page=['home','library','episodes','stats','profile','loot'].includes(h)?h:'home';try{history.replaceState({onebasePage:page},'',location.pathname+'#'+page)}catch(_){}render();addEventListener('popstate',e=>{const p=e.state?.onebasePage||location.hash.slice(1)||'home';if(['home','library','episodes','stats','profile','loot'].includes(p)){page=p;render()}});['animetracker:saved','animetracker:restored','onebase:anime-added','onebase:screen-library-changed'].forEach(ev=>addEventListener(ev,()=>setTimeout(render,0)))
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();