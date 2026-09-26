/* ONEBASE Lootboxes 2.0
 * Original case-inspired UI, three recommendation modes, lock-on-pick,
 * animated open/close flow and taste/novelty scoring.
 */
(function(){
'use strict';

const KEY='onebase_loot_v2_mode';
const HISTORY='onebase_lootbox_history_v2';
const ROLL='onebase_loot_v2_roll_v1';
const MODES={
  personalized:{label:'PERSONALIZADO',sub:'Se adapta a ti'},
  random:{label:'ALEATORIO',sub:'Sin preferencias'},
  opposite:{label:'LO CONTRARIO',sub:'Explora lo que no ves'}
};
const GENRES=['Action','Adventure','Comedy','Drama','Ecchi','Fantasy','Horror','Mahou Shoujo','Mecha','Music','Mystery','Psychological','Romance','Sci-Fi','Slice of Life','Sports','Supernatural','Thriller','Cars','Demons','Game','Historical','Martial Arts','Military','Parody','School','Space','Vampire','Samurai'];
const ADULT=['Ecchi'];
const THEMES={
  boxing:['boxing','boxeo'],magic:['magic','magia','wizard','witch','hechic'],vampire:['vampire','vampiro'],pirates:['pirate','pirata'],ninja:['ninja'],samurai:['samurai'],martial:['martial arts','artes marciales'],football:['football','soccer','futbol'],basketball:['basketball','baloncesto'],baseball:['baseball','beisbol'],racing:['racing','race','carreras'],idols:['idol','idols'],detective:['detective','mystery','misterio'],survival:['survival','supervivencia'],school:['school','escuela'],space:['space','espacio'],robots:['mecha','robot','robots'],military:['military','militar'],cooking:['cooking','cocina'],time:['time travel','viaje en el tiempo'],demons:['demon','demonio','demonios']
};

let mode=localStorage.getItem(KEY)||'personalized';
if(!MODES[mode])mode='personalized';
let roll=null,busy=false,selected=null,resolved=new Set(),openingTimer=0,closeTimer=0,loadError='';
function loadSavedRoll(){try{const v=JSON.parse(localStorage.getItem(ROLL)||'null');if(!v||v.mode!==mode||!Array.isArray(v.roll)||v.roll.length!==5)return null;if(!v.roll.every(x=>x&&Number(x.id)>0&&String(x.title||'').trim()))return null;return{roll:v.roll,resolved:new Set(Array.isArray(v.resolved)?v.resolved.map(Number).filter(Number.isInteger):[])}}catch(_){return null}}
function persistRoll(){if(!Array.isArray(roll)||roll.length!==5)return;try{localStorage.setItem(ROLL,JSON.stringify({mode,roll,resolved:[...resolved],createdAt:Date.now()}))}catch(_){}
}
function clearPersistedRoll(){try{localStorage.removeItem(ROLL)}catch(_){}
}
const cachedRoll=loadSavedRoll();if(cachedRoll){roll=cachedRoll.roll;resolved=cachedRoll.resolved;}

const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const text=v=>String(v??'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
const list=()=>Array.isArray(window.__ONEBASE_DATA__)?window.__ONEBASE_DATA__.filter(x=>x&&String(x.anime||'').trim()):[];
const ids=()=>new Set(list().map(x=>Number(x.aniId||x.anilistId)).filter(Number.isFinite).filter(x=>x>0));
function loadHistory(){try{const v=JSON.parse(localStorage.getItem(HISTORY)||'[]');return new Set(Array.isArray(v)?v.map(Number).filter(Number.isFinite):[])}catch(_){return new Set()}}
function saveHistory(s){try{localStorage.setItem(HISTORY,JSON.stringify([...s].slice(-1000)))}catch(_){}}
function profile(){
  const gs=new Map(),ts=new Map(),seen=new Map(),themes=new Map();
  list().forEach(x=>{
    const score=Number(x.score), quality=Number.isFinite(score)?Math.max(.25,score/10):.65;
    const interest=quality+(x.favorite?1.35:0)+(Number(x.watched)>0?0.45:0)+(x.state==='viendo'?0.35:0)+(x.state==='terminado'?0.6:0);
    const blob=String(x.anime||'')+' '+String(x.description||'')+' '+(Array.isArray(x.tags)?x.tags.map(t=>typeof t==='string'?t:t?.name||'').join(' '):'');
    const lower=blob.toLowerCase();
    Object.entries(THEMES).forEach(([theme,words])=>{if(words.some(w=>lower.includes(w)))themes.set(theme,(themes.get(theme)||0)+interest)});
    (Array.isArray(x.genres)?x.genres:[]).forEach(g=>{const k=String(g).trim();if(k&&!ADULT.includes(k))gs.set(k,(gs.get(k)||0)+interest)});
    (Array.isArray(x.tags)?x.tags:[]).forEach(t=>{const k=typeof t==='string'?t:String(t?.name||'').trim();if(k)ts.set(k,(ts.get(k)||0)+interest)});
    (Array.isArray(x.genres)?x.genres:[]).forEach(g=>{const k=String(g).trim();if(k)seen.set(k,(seen.get(k)||0)+1)});
  });
  return{genres:gs,tags:ts,seen,themes};
}
function top(map,n=8){return [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,n).map(x=>x[0])}
function oppositeGenres(p){
  const exposure=new Map(GENRES.map(g=>[g,Number(p.seen.get(g)||0)]));
  return [...exposure.entries()].sort((a,b)=>a[1]-b[1]||Math.random()-.5).slice(0,6).map(x=>x[0]);
}
function reasonFor(x,p,opposite){
  const gs=(x.genres||[]).filter(g=>p.genres.has(g));
  const ts=(x.tags||[]).map(t=>typeof t==='string'?t:t?.name).filter(Boolean).filter(t=>p.tags.has(t));
  if(opposite){const g=(x.genres||[]).find(g=>opposite.includes(g));return g?'Explora un género que casi no aparece en tu biblioteca: '+g:'Sale de tus gustos habituales para ampliar la colección.'}
  if(gs.length||ts.length)return 'Encaja con '+[...gs.slice(0,2),...ts.slice(0,1)].join(' · ');
  return 'Nueva apuesta dentro de tus preferencias generales.';
}
function scoreCandidate(x,p,mode,targets){
  const genres=Array.isArray(x.genres)?x.genres:[];
  const tags=(Array.isArray(x.tags)?x.tags:[]).map(t=>typeof t==='string'?t:t?.name).filter(Boolean);
  const blob=(String(x.title?.userPreferred||x.title?.english||x.title?.romaji||'')+' '+String(x.description||'')+' '+tags.join(' ')).toLowerCase();
  const themeMatch=Object.entries(THEMES).reduce((s,[theme,words])=>s+(words.some(w=>blob.includes(w))?(p.themes.get(theme)||0):0),0);
  const gMatch=genres.reduce((s,g)=>s+(p.genres.get(g)||0),0);
  const tMatch=tags.reduce((s,t)=>s+(p.tags.get(t)||0),0);
  const pop=Math.min(10,Math.log10(Math.max(1,Number(x.popularity)||1))*2.1);
  const quality=Number(x.averageScore)||0;
  const novelty=Math.random()*8;
  if(mode==='random')return 10+pop*.35+quality/35+novelty;
  if(mode==='opposite'){
    const target=genres.reduce((s,g)=>s+(targets.includes(g)?6:0),0);
    const familiar=genres.reduce((s,g)=>s+(p.genres.has(g)?p.genres.get(g)*.16:0),0);
    const unknownTags=tags.reduce((s,t)=>s+(p.tags.has(t)?0:1),0);
    return target*5+unknownTags*1.5-themeMatch*.18-familiar+quality/45+novelty;
  }
  return gMatch*2.2+tMatch*3.2+themeMatch*3.8+pop*.55+quality/30+novelty;
}
function pick(candidates,p,mode,targets){
  const hist=loadHistory(),owned=ids();
  const pool=candidates.filter(x=>x&&Number(x.id)>0&&!owned.has(Number(x.id))&&!hist.has(Number(x.id)));
  const ranked=pool.map(x=>({x,s:scoreCandidate(x,p,mode,targets)})).sort((a,b)=>b.s-a.s);
  const chosen=[];
  while(chosen.length<5&&ranked.length){
    const topPool=ranked.splice(0,Math.min(8,ranked.length));
    const total=topPool.reduce((s,o)=>s+Math.max(.1,o.s),0);
    let r=Math.random()*total,pick=topPool[topPool.length-1];
    for(const o of topPool){r-=Math.max(.1,o.s);if(r<=0){pick=o;break}}
    chosen.push(pick.x);
    const idx=ranked.findIndex(o=>Number(o.x.id)===Number(pick.x.id));if(idx>=0)ranked.splice(idx,1);
  }
  return chosen.map(x=>({
    id:Number(x.id),
    title:x.title?.userPreferred||x.title?.english||x.title?.romaji||'Anime recomendado',
    cover:x.coverImage?.extraLarge||x.coverImage?.large||x.coverImage?.medium||'',
    banner:String(x.bannerImage||''),
    genres:Array.isArray(x.genres)?x.genres.slice(0,6):[],
    tags:Array.isArray(x.tags)?x.tags.slice(0,8):[],
    description:text(x.description||''),
    episodes:Number(x.episodes)||0,duration:Number(x.duration)||0,
    status:String(x.status||''),score:Number(x.averageScore)||0,popularity:Number(x.popularity)||0,siteUrl:String(x.siteUrl||''),
    reason:reasonFor(x,p,mode==='opposite'?targets:null)
  }));
}
async function fetchRoll(){
  const p=profile(),taste=top(p.genres,8),targets=mode==='opposite'?oppositeGenres(p):[];
  const hist=loadHistory(),owned=[...ids()];
  const exclude=[...new Set([...hist,...owned])].filter(Number.isFinite).slice(-10000);
  const body={mode,genres:taste,targetGenres:targets,excludeIds:exclude,page:1+Math.floor(Math.random()*8)};
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),9000):null;
  try{
    const r=await fetch('/api/lootbox-recommendations-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller?.signal});
    const payload=await r.json().catch(()=>null);
    if(!r.ok||!payload?.ok)throw new Error(payload?.error||'No se pudieron preparar las cajas.');
    const candidates=Array.isArray(payload.results)?payload.results:[];
    const picked=pick(candidates,p,mode,targets);
    if(picked.length<5)throw new Error('No hay 5 recomendaciones nuevas disponibles para esta tirada.');
    return picked;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('AniList tardó demasiado en responder. Pulsa Reintentar en unos segundos.');
    throw error;
  }finally{if(timer)clearTimeout(timer)}
}
function modeLabel(){return MODES[mode].label}
function boxMarkup(x,i){
  const locked=selected!==null&&selected!==i;
  const done=resolved.has(i);
  const opened=done&&selected===i;
  return '<article class="lv2-case '+(locked?'locked ':'')+(done?'resolved ':'')+(opened?'opened ':'')+(selected===i?'selected ':'')+'" style="--lv2-i:'+i+'">'+
    '<button class="lv2-case-button" data-lv2-open="'+i+'" '+(locked||done||busy?'disabled':'')+' aria-label="'+(locked?'Caja bloqueada':opened?'Caja abierta':'Abrir caja '+(i+1))+'">'+
      '<span class="lv2-case-shell"><span class="lv2-case-edge"></span><span class="lv2-case-band"></span><span class="lv2-case-lock"></span><span class="lv2-case-rarity"></span></span>'+
      (opened?'<span class="lv2-case-open-lid"><span>ONEBASE</span></span><span class="lv2-case-open-glow"></span>':'')+
      '<span class="lv2-case-number">CASE '+String(i+1).padStart(2,'0')+'</span><span class="lv2-case-label">'+(opened?'✓ ABIERTA':locked?'🔒 BLOQUEADA':'ABRIR CAJA')+'</span><span class="lv2-case-sub">'+(opened?'DROP RESUELTO':locked?'HAZ REROLL PARA OTRA TIRADA':'DROP DISPONIBLE')+'</span><span class="lv2-case-glint"></span>'+
    '</button></article>';
}
function shell(){
  const disabled=busy||selected!==null;
  const cases=roll?'<div class="lv2-cases">'+roll.map((x,i)=>boxMarkup(x,i)).join('')+'</div>':'';
  return '<div class="onebase-loot-v2">'+
    '<div class="lv2-top"><div><div class="lv2-kicker">ONEBASE · DESCUBRIMIENTOS</div><h3>Tu próximo anime está dentro.</h3><p>Elige una de las 5 cajas. Se abrirá por arriba y descubrirás un anime sorpresa. Después podrás guardarlo o descartarlo.</p></div>'+
    '<div class="lv2-modes">'+Object.entries(MODES).map(([k,v])=>'<button class="lv2-mode '+(mode===k?'active':'')+'" data-lv2-mode="'+k+'">'+v.label+'<small>'+v.sub+'</small></button>').join('')+'</div></div>'+
    '<div class="lv2-rollbar"><span>'+modeLabel()+' · '+(busy?'ANALIZANDO PERFIL…':selected!==null?'1 CAJA ELEGIDA · 4 BLOQUEADAS':'5 CAJAS DISPONIBLES')+'</span><button class="lv2-reroll" data-lv2-reroll '+(busy?'disabled':'')+'>↻ REROLL · NUEVA TIRADA</button></div>'+
    (loadError?'<div class="lv2-empty lv2-error" role="alert"><div><b>No se pudieron cargar las cajas</b><small>'+esc(loadError)+'</small><button type="button" data-lv2-reroll>Reintentar</button></div></div>':'')+
    (busy?'<div class="lv2-empty"><div><div class="lv2-spinner"></div><b>Construyendo tu tirada</b><small>Comparando géneros, temas, novedad y lo que ya tienes…</small></div></div>':cases)+
    (!roll&&!busy&&!loadError?'<div class="lv2-empty"><div><b>Preparando tus cajas…</b><small>La primera tirada se genera automáticamente.</small></div></div>':'')+
    (selected!==null&&roll?.[selected]&&!resolved.has(selected)?detail(roll[selected],selected):'')+
    (selected!==null?'<div class="lv2-reroll-note">Las otras cajas no se vuelven a abrir en esta tirada. Usa REROLL para generar 5 nuevas.</div>':'')+
  '</div>';
}
function rarity(x){
  const s=Number(x.score)||0;
  if(s>=85)return ['SECRETA','red'];
  if(s>=78)return ['RESTRINGIDA','purple'];
  if(s>=70)return ['MIL-SPEC','blue'];
  return ['ESTÁNDAR','blue'];
}
function detail(x,i){
  const r=rarity(x);
  return '<section class="lv2-reveal '+(resolved.has(i)?'is-closing':'')+'"><div class="lv2-reveal-inner">'+
    '<div class="lv2-reveal-cover">'+(x.cover?'<img src="'+esc(x.cover)+'" alt="Portada de '+esc(x.title)+'">':'')+'</div>'+
    '<div class="lv2-reveal-copy"><span class="lv2-reveal-rarity">◆ '+r[0]+'</span><h4>'+esc(x.title)+'</h4><div class="lv2-reveal-meta">'+esc((x.genres||[]).join(' · ')||'Anime')+(x.episodes?' · '+x.episodes+' episodios':'')+'</div><div class="lv2-reveal-score">★ '+(x.score?(x.score/10).toFixed(1):'—')+' / 10</div><p class="lv2-reveal-desc">'+esc(x.description||'Sin descripción disponible.')+'</p><div class="lv2-actions"><button class="lv2-save" data-lv2-save="'+i+'">＋ GUARDAR COMO PENDIENTE</button><button class="lv2-skip" data-lv2-skip="'+i+'">♻ DESCARTAR</button></div><div class="lv2-reason">'+esc(x.reason)+'</div></div></div></section>';
}
function playLootSound(kind='open'){
  try{
    const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;
    lootAudioContext=lootAudioContext||new AC();
    const ctx=lootAudioContext;if(ctx.state==='suspended')void ctx.resume();
    const now=ctx.currentTime,notes=kind==='reveal'?[220,330,495,660]:[110,165,220];
    notes.forEach((freq,n)=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),t=now+n*.09;osc.type=n===notes.length-1?'triangle':'sine';osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(kind==='reveal'?.07:.045,t+.015);gain.gain.exponentialRampToValueAtTime(.0001,t+.16);osc.connect(gain);gain.connect(ctx.destination);osc.start(t);osc.stop(t+.18)});
  }catch(_){}
}
function opening(i){
  const x=roll?.[i];if(!x)return;
  playLootSound('open');
  document.getElementById('lv2Opening')?.remove();
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const el=document.createElement('div');el.id='lv2Opening';el.className='lv2-opening lv3-opening';
  el.innerHTML='<div class="lv3-arena" role="dialog" aria-modal="true" aria-label="Abriendo caja de anime">'+
    '<div class="lv3-stage-label">ONEBASE · DESCUBRE TU PRÓXIMO ANIME</div>'+
    '<div class="lv3-stage" aria-hidden="true"><div class="lv3-floor"></div><div class="lv3-light"></div><div class="lv3-chest">'+
      '<div class="lv3-chest-lid"><span>ONEBASE</span></div>'+
      '<div class="lv3-chest-inside"></div><div class="lv3-chest-body"><span class="lv3-chest-logo">◈</span><span class="lv3-chest-brand">ONEBASE</span></div>'+
    '</div><div class="lv3-prize"><img src="'+esc(x.cover)+'" alt=""><span>ANIME DESCUBIERTO</span></div></div>'+
    '<p class="lv3-stage-status" aria-live="polite">Preparando tu descubrimiento…</p>'+
    '<div class="lv3-result" hidden>'+detail(x,i)+'</div>'+
    '</div>';
  document.body.appendChild(el);
  const status=el.querySelector('.lv3-stage-status'),result=el.querySelector('.lv3-result');
  const reveal=()=>{
    if(!el.isConnected)return;
    playLootSound('reveal');
    el.classList.add('lv3-revealed');
    if(status)status.textContent='¡Has descubierto un anime!';
    if(result){result.hidden=false;result.querySelector('[data-lv2-save]')?.addEventListener('click',()=>{el.remove();save(i)});result.querySelector('[data-lv2-skip]')?.addEventListener('click',()=>{el.remove();skip(i)})}
    // The reward stays visible until the user explicitly saves or discards it.
  };
  requestAnimationFrame(()=>el.classList.add('lv3-start'));
  setTimeout(()=>{if(el.isConnected&&status)status.textContent='Abriendo la caja…'},reduce?150:700);
  setTimeout(()=>{if(el.isConnected)el.classList.add('lv3-open')},reduce?200:1100);
  setTimeout(reveal,reduce?450:2500);
}
function choose(i){
  if(busy||selected!==null||!roll?.[i]||resolved.has(i))return;
  selected=i;
  renderLoot();
  opening(i);
}
function markHistory(id){const h=loadHistory();h.add(Number(id));saveHistory(h)}
function closeDropThen(fn){
  const reveal=$('.lv2-reveal');if(!reveal){fn();return}
  reveal.classList.add('is-closing');clearTimeout(closeTimer);closeTimer=setTimeout(fn,340);
}
function save(i){
  const x=roll?.[i];if(!x)return;
  const owned=list().some(o=>Number(o.aniId||o.anilistId)===x.id||String(o.anime||'').toLowerCase()===x.title.toLowerCase());
  if(owned){markHistory(x.id);resolved.add(i);return closeDropThen(()=>{renderLoot();window.toast?.('Ese anime ya estaba en tu biblioteca.');})}
  const d=window.__ONEBASE_DATA__;
  if(!Array.isArray(d))return;
  d.push({anime:x.title,watched:'0',total:x.episodes?String(x.episodes):'',duration:x.duration?String(x.duration):'',durationMin:x.duration||0,state:'pendiente',score:'',favorite:false,cover:x.cover,coverImage:x.cover,bannerImage:x.banner,description:x.description,genres:x.genres,tags:x.tags,apiStatus:x.status,anilistStatus:x.status,apiScore:x.score?x.score/10:0,aniId:x.id,anilistId:x.id,knownTotal:x.episodes?String(x.episodes):'',plannedEpisodes:x.episodes?String(x.episodes):'',newEpisodes:0,siteUrl:x.siteUrl,source:'onebase-lootbox-v2',addedAt:Date.now(),updatedAt:Date.now()});
  try{window.save?.({skipBackup:true})}catch(_){try{window.save?.()}catch(__){}}
  markHistory(x.id);resolved.add(i);persistRoll();
  closeDropThen(()=>{renderLoot();window.toast?.('✓ Anime guardado como pendiente.')});
}
function skip(i){
  const x=roll?.[i];if(!x)return;
  markHistory(x.id);resolved.add(i);persistRoll();
  closeDropThen(()=>{renderLoot();window.toast?.('Drop descartado.');});
}
async function reroll(){
  if(busy)return;
  const previous=Array.isArray(roll)&&roll.length===5?roll:null;
  if(roll)roll.forEach(x=>markHistory(x.id));
  selected=null;resolved.clear();roll=null;loadError='';clearPersistedRoll();busy=true;renderLoot();
  try{roll=await fetchRoll();persistRoll()}
  catch(e){if(previous){roll=previous;loadError=String(e?.message||e);persistRoll()}else{roll=[];loadError=String(e?.message||e)}window.toast?.(loadError)}
  finally{busy=false;renderLoot()}
}
function bind(){
  const app=$('#onebasePageApp');if(!app)return;
  app.querySelectorAll('[data-lv2-mode]').forEach(b=>b.onclick=async()=>{const next=b.dataset.lv2Mode;if(next===mode)return;mode=next;localStorage.setItem(KEY,mode);await reroll()});
  app.querySelectorAll('[data-lv2-reroll]').forEach(b=>b.onclick=()=>void reroll());
  app.querySelectorAll('[data-lv2-open]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.lv2Open)));
  app.querySelectorAll('[data-lv2-save]').forEach(b=>b.onclick=()=>save(Number(b.dataset.lv2Save)));
  app.querySelectorAll('[data-lv2-skip]').forEach(b=>b.onclick=()=>skip(Number(b.dataset.lv2Skip)));
}
function renderLoot(){
  const app=$('#onebasePageApp');if(!app)return;
  app.innerHTML=shell();bind();
  if(!roll&&!busy&&!loadError)void reroll();
}
function inLoot(){return location.hash.slice(1)==='loot'}
function enter(){
  if(!inLoot())return;
  setTimeout(()=>{
    const app=$('#onebasePageApp');if(!app)return;
    renderLoot();
    if(!roll&&!busy&&!loadError)void reroll();
  },80);
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-page="loot"]'))setTimeout(enter,60)});
addEventListener('popstate',()=>setTimeout(enter,60));
addEventListener('hashchange',()=>setTimeout(enter,60));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enter,{once:true});else setTimeout(enter,150);

window.OneBaseLootV2={reroll,render:renderLoot,clear:()=>{roll=null;resolved.clear();selected=null;clearPersistedRoll();renderLoot()}};
addEventListener('onebase:page-changed',e=>{if(e.detail?.page==='loot')setTimeout(renderLoot,0)});
})();