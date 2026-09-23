/* ONEBASE Lootboxes 2.0
 * Original case-inspired UI, three recommendation modes, lock-on-pick,
 * animated open/close flow and taste/novelty scoring.
 */
(function(){
'use strict';

const KEY='onebase_loot_v2_mode';
const HISTORY='onebase_lootbox_history_v2';
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
let roll=null,busy=false,selected=null,resolved=new Set(),openingTimer=0,closeTimer=0;

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
  const body={mode,genres:taste,targetGenres:targets,excludeIds:exclude,page:1+Math.floor(Math.random()*7)};
  const r=await fetch('/api/lootbox-recommendations-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const payload=await r.json().catch(()=>null);
  if(!r.ok||!payload?.ok)throw new Error(payload?.error||'No se pudieron preparar las cajas.');
  let candidates=Array.isArray(payload.results)?payload.results:[];
  let picked=pick(candidates,p,mode,targets);
  if(picked.length<5){
    const fallback=await fetch('/api/lootbox-recommendations-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,mode:'random',page:Math.floor(Math.random()*7)+1})});
    const fp=await fallback.json().catch(()=>null);
    if(fallback.ok&&fp?.ok)picked=pick([...(candidates||[]),...(fp.results||[])],p,mode,targets);
  }
  if(picked.length<5)throw new Error('No hay 5 recomendaciones nuevas disponibles para esta tirada.');
  return picked;
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
    '<div class="lv2-top"><div><div class="lv2-kicker">ONEBASE · LOOTBOXES 2.0</div><h3>Abre tu próxima obsesión.</h3><p>5 cajas por tirada. Una elección bloquea las demás. El sistema elimina lo que ya tienes y ajusta cada drop a tu historial.</p></div>'+
    '<div class="lv2-modes">'+Object.entries(MODES).map(([k,v])=>'<button class="lv2-mode '+(mode===k?'active':'')+'" data-lv2-mode="'+k+'">'+v.label+'<small>'+v.sub+'</small></button>').join('')+'</div></div>'+
    '<div class="lv2-rollbar"><span>'+modeLabel()+' · '+(busy?'ANALIZANDO PERFIL…':selected!==null?'1 CAJA ELEGIDA · 4 BLOQUEADAS':'5 CAJAS DISPONIBLES')+'</span><button class="lv2-reroll" data-lv2-reroll '+(busy?'disabled':'')+'>↻ REROLL · NUEVA TIRADA</button></div>'+
    (busy?'<div class="lv2-empty"><div><div class="lv2-spinner"></div><b>Construyendo tu tirada</b><small>Comparando géneros, temas, novedad y lo que ya tienes…</small></div></div>':cases)+
    (!roll&&!busy?'<div class="lv2-empty"><div><b>Preparando tus cajas…</b><small>La primera tirada se genera automáticamente.</small></div></div>':'')+
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
function opening(i){
  const x=roll?.[i];if(!x)return;
  const el=document.createElement('div');
  el.className='lv2-opening';
  el.id='lv2Opening';
  el.innerHTML='<div class="lv2-opening-card" role="dialog" aria-modal="true" aria-label="Abriendo lootbox"><div class="lv2-opening-kicker">ONEBASE CASE · '+String(i+1).padStart(2,'0')+'</div><div class="lv2-opening-warning">SECURE CONTAINER · LOCKED</div><div class="lv2-opening-stage"><div class="lv2-opening-scan"></div><div class="lv2-opening-case"><span class="lv2-opening-beam"></span><span class="lv2-opening-sparks"></span><span class="lv2-opening-shell"><span class="lv2-opening-case-edge"></span><span class="lv2-opening-case-band"></span><span class="lv2-opening-case-lock"></span><span class="lv2-opening-case-rarity"></span></span><span class="lv2-opening-lid"><span>ONEBASE</span></span></div></div><div class="lv2-opening-status">CASE LOCKED</div><div class="lv2-opening-count">03</div><div class="lv2-opening-progress"><i></i></div></div>';
  document.body.appendChild(el);

  const card=el.querySelector('.lv2-opening-card');
  const stage=el.querySelector('.lv2-opening-stage');
  const box=el.querySelector('.lv2-opening-case');
  const lid=el.querySelector('.lv2-opening-lid');
  const lock=el.querySelector('.lv2-opening-case-lock');
  const beam=el.querySelector('.lv2-opening-beam');
  const sparks=el.querySelector('.lv2-opening-sparks');
  const status=el.querySelector('.lv2-opening-status');
  const count=el.querySelector('.lv2-opening-count');
  const progress=el.querySelector('.lv2-opening-progress i');
  const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Lootboxes keep the full cinematic sequence even when the OS requests reduced motion.
  // The user explicitly expects a visible opening/tension sequence here.
  requestAnimationFrame(()=>{
    card?.animate(
      [{opacity:0,transform:'translateY(35px) scale(.84)'},{opacity:1,transform:'translateY(0) scale(1.02)',offset:.72},{opacity:1,transform:'scale(1)'}],
      {duration:700,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}
    );
    stage?.animate(
      [{transform:'scale(.62) rotateX(14deg)',opacity:0},{transform:'scale(1.04) rotateX(0)',opacity:1,offset:.7},{transform:'scale(1)'}],
      {duration:900,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}
    );
    box?.animate(
      [
        {transform:'translateY(0) scale(1) rotateZ(0)'},
        {transform:'translateY(-5px) scale(1.02) rotateZ(-.6deg)',offset:.22},
        {transform:'translateY(3px) scale(1.015) rotateZ(.7deg)',offset:.36},
        {transform:'translateY(-2px) scale(1.01) rotateZ(-.5deg)',offset:.52},
        {transform:'translateY(0) scale(1) rotateZ(0)',offset:.68},
        {transform:'translateY(0) scale(1.045)',offset:.82},
        {transform:'translateY(0) scale(1)'}
      ],
      {duration:3600,easing:'cubic-bezier(.2,.8,.2,1)',fill:'both'}
    );
    lock?.animate(
      [
        {transform:'translate(-50%,-50%) scale(1)',filter:'brightness(1)',opacity:1},
        {transform:'translate(-50%,-50%) scale(1.12)',filter:'brightness(1.5)',opacity:1,offset:.32},
        {transform:'translate(-50%,-50%) scale(1.38)',filter:'brightness(3)',opacity:1,offset:.43},
        {transform:'translate(-50%,-50%) scale(.5)',filter:'brightness(4)',opacity:0}
      ],
      {duration:850,delay:1450,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}
    );
    lid?.animate(
      [
        {transform:'rotateX(0) translateY(0) translateZ(0)',filter:'brightness(.75)'},
        {transform:'rotateX(-5deg) translateY(-1px) translateZ(2px)',filter:'brightness(1)',offset:.18},
        {transform:'rotateX(-9deg) translateY(-2px) translateZ(4px)',filter:'brightness(1.1)',offset:.28},
        {transform:'rotateX(-82deg) translateY(-30px) translateZ(42px)',filter:'brightness(1.8)',offset:.62},
        {transform:'rotateX(-74deg) translateY(-26px) translateZ(36px)',filter:'brightness(1.35)'}
      ],
      {duration:1750,delay:2050,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}
    );
    beam?.animate(
      [
        {opacity:0,transform:'translate(-50%,-50%) scale(.12)'},
        {opacity:.18,transform:'translate(-50%,-50%) scale(.35)',offset:.38},
        {opacity:1,transform:'translate(-50%,-50%) scale(.8)',offset:.63},
        {opacity:.72,transform:'translate(-50%,-50%) scale(1.35)'}
      ],
      {duration:1500,delay:2200,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}
    );
    sparks?.animate(
      [
        {opacity:0,transform:'scale(.3) rotate(0deg)'},
        {opacity:1,transform:'scale(1.2) rotate(80deg)',offset:.45},
        {opacity:0,transform:'scale(2.2) rotate(180deg)'}
      ],
      {duration:1100,delay:2500,easing:'cubic-bezier(.16,1,.3,1)',fill:'both'}
    );
    progress?.animate([{width:'0%'},{width:'100%'}],{duration:4300,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
  });

  const say=(ms,textValue)=>setTimeout(()=>{if(status)status.textContent=textValue},ms);
  say(700,'ANALYZING DROP…');
  say(1350,'LOCK SEQUENCE ARMED');
  say(1780,'UNLOCKING…');
  say(2100,'03');
  setTimeout(()=>{if(count)count.textContent='02'},2550);
  setTimeout(()=>{if(count)count.textContent='01'},3000);
  say(3450,'OPENING CASE…');
  setTimeout(()=>{el.classList.add('drop-flash');if(count)count.textContent='DROP'},3650);
  say(3820,'DROP FOUND');
  clearTimeout(openingTimer);
  openingTimer=setTimeout(()=>{
    el.classList.add('closing');
    setTimeout(()=>{el.remove();renderLoot()},520);
  },4350);
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
  markHistory(x.id);resolved.add(i);
  closeDropThen(()=>{renderLoot();window.toast?.('✓ Anime guardado como pendiente.')});
}
function skip(i){
  const x=roll?.[i];if(!x)return;
  markHistory(x.id);resolved.add(i);
  closeDropThen(()=>{renderLoot();window.toast?.('Drop descartado.');});
}
async function reroll(){
  if(busy)return;
  if(roll)roll.forEach(x=>markHistory(x.id));
  selected=null;resolved.clear();roll=null;busy=true;renderLoot();
  try{roll=await fetchRoll()}catch(e){roll=[];window.toast?.(String(e?.message||e))}finally{busy=false;renderLoot()}
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
}
function inLoot(){return location.hash.slice(1)==='loot'}
function enter(){
  if(!inLoot())return;
  setTimeout(()=>{
    const app=$('#onebasePageApp');if(!app)return;
    renderLoot();
    if(!roll&&!busy)void reroll();
  },80);
}
document.addEventListener('click',e=>{if(e.target.closest?.('[data-page="loot"]'))setTimeout(enter,60)});
addEventListener('popstate',()=>setTimeout(enter,60));
addEventListener('hashchange',()=>setTimeout(enter,60));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enter,{once:true});else setTimeout(enter,150);

window.OneBaseLootV2={reroll,render:renderLoot};
})();