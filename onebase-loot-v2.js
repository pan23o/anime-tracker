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
let roll=null,busy=false,selected=null,resolved=new Set(),openingTimer=0,closeTimer=0,loadError='';

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
  const unique=new Map(candidates.filter(x=>x&&Number(x.id)>0).map(x=>[Number(x.id),x]));
  const pool=[...unique.values()].filter(x=>!owned.has(Number(x.id))&&!hist.has(Number(x.id)));
  const ranked=pool.map(x=>({x,s:scoreCandidate(x,p,mode,targets)})).sort((a,b)=>b.s-a.s);
  const chosen=[];
  while(chosen.length<5&&ranked.length){
    const topPool=ranked.splice(0,Math.min(8,ranked.length));
    const total=topPool.reduce((s,o)=>s+Math.max(.1,o.s),0);
    let r=Math.random()*total,pick=topPool[topPool.length-1];
    for(const o of topPool){r-=Math.max(.1,o.s);if(r<=0){pick=o;break}}
    chosen.push(pick.x);
    // A weighted candidate may be selected from topPool; return the other
    // candidates to the pool so the same anime cannot appear twice.
    ranked.push(...topPool.filter(o=>Number(o.x.id)!==Number(pick.x.id)));
    ranked.sort((a,b)=>b.s-a.s);
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
  const body={mode,genres:taste,targetGenres:targets,excludeIds:exclude.slice(-350),page:1+Math.floor(Math.random()*4)};
  const controller=typeof AbortController==='undefined'?null:new AbortController();
  const timer=controller?setTimeout(()=>controller.abort(),9000):null;
  try{
    const r=await fetch('/api/lootbox-recommendations-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller?.signal});
    const payload=await r.json().catch(()=>null);
    if(!r.ok||!payload?.ok)throw new Error(payload?.error||'No se pudieron preparar las cajas.');
    let picked=pick(Array.isArray(payload.results)?payload.results:[],p,mode,targets);
    if(picked.length<5){
      const fallback=await fetch('/api/lootbox-recommendations-v2',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...body,mode:'random',page:1}),signal:controller?.signal});
      const fp=await fallback.json().catch(()=>null);
      if(fallback.ok&&fp?.ok)picked=pick([...(payload.results||[]),...(fp.results||[])],p,mode,targets);
    }
    if(picked.length<5)throw new Error('No hay 5 animes nuevos disponibles. Prueba otro modo o genera otra tirada.');
    return picked;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('AniList tardó demasiado en responder. Pulsa Reintentar.');
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
function opening(i){
  const x=roll?.[i];if(!x)return;
  document.getElementById('onebase-loot-cinema')?.remove();
  // Self-contained component: its styles travel with its script. This avoids
  // stale CSS, inherited lv2/lv3/lv4/lv5/lv6 rules and animation overrides.
  if(!document.getElementById('onebase-loot-cinema-style')){
    const style=document.createElement('style');style.id='onebase-loot-cinema-style';
    style.textContent=`
#onebase-loot-cinema{position:fixed!important;inset:0!important;z-index:2147483640!important;display:block!important;overflow:auto!important;overscroll-behavior:contain;background:radial-gradient(ellipse at 50% 43%,#322411 0%,#111115 54%,#08080b 100%)!important;color:#f8f2e9!important;font-family:system-ui,-apple-system,sans-serif!important}
#onebase-loot-cinema *{box-sizing:border-box}
#onebase-loot-cinema .obc-stage{position:relative;width:min(1320px,97vw);height:min(800px,96dvh);min-height:560px;margin:auto;isolation:isolate}
#onebase-loot-cinema .obc-top{position:absolute;top:5%;left:0;right:0;text-align:center;color:#f0c66d;font-size:12px;font-weight:900;letter-spacing:3px}
#onebase-loot-cinema .obc-caption{position:absolute;bottom:5%;left:0;right:0;text-align:center;color:#e6c88e;font-size:15px;font-weight:800;letter-spacing:.6px}
#onebase-loot-cinema .obc-box{position:absolute;left:50%;top:46%;width:270px;height:260px;transform:translate(-50%,-50%);perspective:900px;z-index:3}
#onebase-loot-cinema .obc-chest{position:absolute;left:50%;top:32%;width:220px;height:155px;transform:translateX(-50%);transform-origin:50% 65%}
#onebase-loot-cinema .obc-lid{position:absolute;top:0;left:-7px;width:234px;height:60px;border:3px solid #f1c66d;border-radius:17px 17px 7px 7px;background:linear-gradient(140deg,#6e5024,#171820 54%,#7b5b2d);display:grid;place-items:center;z-index:5;color:#ffe0a0;font-size:13px;font-weight:950;letter-spacing:3px;transform-origin:50% 100%;box-shadow:0 0 25px #e7ac5355}
#onebase-loot-cinema .obc-inside{position:absolute;inset:40px 8px 15px;background:#050508;box-shadow:inset 0 0 30px #ffd57e}
#onebase-loot-cinema .obc-base{position:absolute;inset:42px 0 0;border:3px solid #d6a64f;border-radius:7px 7px 16px 16px;background:linear-gradient(145deg,#50381c,#101116 55%,#59401e);display:grid;place-items:center;color:#f7cc75;font-size:51px;box-shadow:0 18px 45px #000b}
#onebase-loot-cinema .obc-light{position:absolute;left:50%;top:0;width:280px;height:280px;transform:translateX(-50%) scale(.35);opacity:0;background:radial-gradient(ellipse,#ffe099dd 0%,#f5bb624d 35%,transparent 73%);filter:blur(17px);pointer-events:none}
#onebase-loot-cinema .obc-reward{position:absolute;inset:0;z-index:6;pointer-events:none}
#onebase-loot-cinema .obc-card{position:absolute;left:50%;top:46%;width:270px;height:390px;transform:translate(-50%,110px) scale(.5);opacity:0;border:3px solid #f6cb75;border-radius:14px;overflow:hidden;background:#322618;box-shadow:0 0 38px #efbd5c88,0 22px 65px #000d;z-index:10}
#onebase-loot-cinema .obc-card img{width:100%;height:100%;object-fit:cover;display:block}
#onebase-loot-cinema .obc-panel{position:absolute;left:calc(50% - 190px);top:46%;width:min(850px,64vw);transform:translateY(-50%);opacity:0;clip-path:inset(0 100% 0 0);z-index:8;pointer-events:none}
#onebase-loot-cinema .obc-content{padding:36px 42px 36px 42px;min-height:400px;border:1px solid #a87d3b;border-radius:19px;background:linear-gradient(130deg,#292117,#131317 70%);box-shadow:0 20px 65px #000b}
#onebase-loot-cinema .obc-tag{color:#edc478;font-size:10px;font-weight:900;letter-spacing:1px}
#onebase-loot-cinema .obc-title{font-size:clamp(25px,2.35vw,38px);line-height:1.16;margin:14px 0 12px;font-weight:950;color:#fff}
#onebase-loot-cinema .obc-meta{font-size:14px;color:#d1b991}
#onebase-loot-cinema .obc-desc{font-size:15px;line-height:1.75;color:#d4d0c8;max-height:170px;overflow:auto}
#onebase-loot-cinema .obc-actions{display:flex;gap:14px;flex-wrap:wrap;margin-top:24px}
#onebase-loot-cinema .obc-actions button{font-size:13px;font-weight:900;border-radius:10px;padding:16px 20px;cursor:pointer}
#onebase-loot-cinema .obc-save{background:#eac36f;color:#1a150b;border:1px solid #ffdf92}
#onebase-loot-cinema .obc-discard{background:#221d1d;color:#ffaaa6;border:1px solid #ad6661}
#onebase-loot-cinema .obc-replay{position:absolute;right:18px;top:16px;background:#1d1b19;color:#f0c675;border:1px solid #977340;border-radius:9px;padding:10px 14px;cursor:pointer;font-size:12px;z-index:20}
#onebase-loot-cinema.obc-done .obc-reward,#onebase-loot-cinema.obc-done .obc-panel{pointer-events:auto}
@media(max-width:760px){#onebase-loot-cinema .obc-stage{height:auto;min-height:950px;width:100%}#onebase-loot-cinema .obc-box{top:260px;transform:translate(-50%,-50%) scale(.75)}#onebase-loot-cinema .obc-card{top:325px;width:145px;height:210px}#onebase-loot-cinema .obc-panel{top:605px;left:4%;width:92%}#onebase-loot-cinema .obc-card{width:175px;height:255px}#onebase-loot-cinema .obc-content{padding:26px 22px;min-height:320px}#onebase-loot-cinema .obc-desc{font-size:14px;max-height:210px}#onebase-loot-cinema .obc-actions{flex-direction:column}#onebase-loot-cinema .obc-actions button{width:100%}#onebase-loot-cinema .obc-caption{bottom:12px}#onebase-loot-cinema .obc-top{top:65px}}
`;
    document.head.appendChild(style);
  }
  const el=document.createElement('div');el.id='onebase-loot-cinema';
  el.innerHTML='<div class="obc-stage" role="dialog" aria-modal="true" aria-label="Abriendo lootbox">'+
    '<button class="obc-replay" type="button">↻ Repetir animación</button>'+
    '<div class="obc-top">ONEBASE · RECOMPENSA MISTERIOSA</div>'+
    '<div class="obc-box"><div class="obc-light"></div><div class="obc-chest"><div class="obc-lid">ONEBASE</div><div class="obc-inside"></div><div class="obc-base">◈</div></div></div>'+
    '<div class="obc-reward"><div class="obc-card">'+(x.cover?'<img src="'+esc(x.cover)+'" alt="Portada de '+esc(x.title)+'">':'◈')+'</div>'+
    '<div class="obc-panel"><div class="obc-content"><div class="obc-tag">◆ RECOMPENSA DESCUBIERTA</div>'+
    '<h2 class="obc-title">'+esc(x.title)+'</h2><div class="obc-meta">'+esc((x.genres||[]).join(' · ')||'Anime')+(x.episodes?' · '+x.episodes+' episodios':'')+(x.score?' · ★ '+(x.score/10).toFixed(1):'')+'</div>'+
    '<p class="obc-desc">'+esc(x.description||'Sin descripción disponible.')+'</p>'+
    '<div class="obc-actions"><button type="button" class="obc-save">＋ GUARDAR ANIME</button><button type="button" class="obc-discard">DESCARTAR</button></div></div></div></div>'+
    '<div class="obc-caption" aria-live="polite">La caja está lista…</div></div>';
  document.body.appendChild(el);
  const q=s=>el.querySelector(s),chest=q('.obc-chest'),lid=q('.obc-lid'),box=q('.obc-box'),light=q('.obc-light'),card=q('.obc-card'),panel=q('.obc-panel'),caption=q('.obc-caption');
  let runId=0,animations=[];
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const move=async(node,frames,duration,id)=>{
    if(runId!==id||!el.isConnected)return false;
    // Explicit inline frames avoid global CSS animation/transition collisions.
    const anim=node.animate(frames,{duration,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
    animations.push(anim);
    try{await anim.finished}catch(_){return false}
    if(runId!==id||!el.isConnected)return false;
    const last=frames[frames.length-1];
    for(const key of ['transform','opacity','clipPath'])if(last[key]!==undefined)node.style[key]=last[key];
    anim.cancel();
    return true;
  };
  const finish=()=>{el.classList.add('obc-done');caption.textContent='¡Has descubierto un anime!';};
  const reset=()=>{
    animations.forEach(a=>a.cancel());animations=[];
    el.classList.remove('obc-done');
    chest.style.transform='translateX(-50%)';lid.style.transform='none';box.style.opacity='1';light.style.opacity='0';light.style.transform='translateX(-50%) scale(.35)';
    card.style.opacity='0';card.style.transform='translate(-50%,110px) scale(.5)';
    panel.style.opacity='0';panel.style.clipPath='inset(0 100% 0 0)';
  };
  async function play(){
    const id=++runId;reset();
    caption.textContent='La caja está lista…';await wait(700);
    if(runId!==id)return;
    for(let n=1;n<=3;n++){
      caption.textContent='Temblor '+n+' de 3';
      const d=10+n*6;
      if(!await move(chest,[{transform:'translateX(-50%) rotate(0deg)'},{transform:'translateX(calc(-50% - '+d+'px)) rotate(-'+(n+1)+'deg)',offset:.25},{transform:'translateX(calc(-50% + '+d+'px)) rotate('+(n+1)+'deg)',offset:.6},{transform:'translateX(-50%) rotate(0deg)'}],650,id))return;
      await wait(250);if(runId!==id)return;
    }
    caption.textContent='¡La caja se abre!';
    if(!(await Promise.all([move(lid,[{transform:'none'},{transform:'translateY(-105px) rotateX(-80deg)'}],950,id),move(light,[{opacity:0,transform:'translateX(-50%) scale(.35)'},{opacity:1,transform:'translateX(-50%) scale(1.3)'}],950,id)])).every(Boolean))return;
    caption.textContent='La caja desciende…';
    if(!await move(chest,[{transform:'translateX(-50%)'},{transform:'translateX(-50%) translateY(265px) scale(.65)'}],1050,id))return;
    caption.textContent='La tarjeta aparece…';
    if(!(await Promise.all([move(card,[{opacity:0,transform:'translate(-50%,110px) scale(.5)'},{opacity:1,transform:'translate(-50%,-50%) scale(1)'}],1250,id),move(box,[{opacity:1},{opacity:0}],1050,id)])).every(Boolean))return;
    await wait(650);if(runId!==id)return;
    caption.textContent='La tarjeta se desplaza…';
    const mobile=innerWidth<760;
    if(!await move(card,[{transform:'translate(-50%,-50%)'},{transform:mobile?'translate(-50%,-50%) scale(.85)':'translate(calc(-50% - 365px),-50%)'}],1500,id))return;
    caption.textContent='Abriendo los detalles…';
    if(!await move(panel,[{opacity:0,clipPath:'inset(0 100% 0 0)'},{opacity:1,clipPath:'inset(0 0 0 0)'}],1700,id))return;
    finish();
  }
  q('.obc-replay').onclick=()=>void play();
  q('.obc-save').onclick=()=>{if(!el.classList.contains('obc-done'))return;el.remove();save(i)};
  q('.obc-discard').onclick=()=>{if(!el.classList.contains('obc-done'))return;el.remove();skip(i)};
  // Opening a box is an explicit request to see the reveal. Run exactly the
  // same proven timeline as the Replay button on the first opening.
  // Keep a skip control for users who prefer not to watch the sequence.
  const skipButton=document.createElement('button');
  skipButton.type='button';
  skipButton.className='obc-replay';
  skipButton.style.right='auto';
  skipButton.style.left='18px';
  skipButton.textContent='Saltar animación';
  el.querySelector('.obc-stage').appendChild(skipButton);
  skipButton.onclick=()=>{
    ++runId;
    animations.forEach(animation=>animation.cancel());
    animations=[];
    lid.style.transform='translateY(-105px) rotateX(-80deg)';
    box.style.opacity='0';
    card.style.opacity='1';
    card.style.transform=innerWidth<760?'translate(-50%,-50%) scale(.85)':'translate(calc(-50% - 365px),-50%)';
    panel.style.opacity='1';
    panel.style.clipPath='inset(0 0 0 0)';
    finish();
  };
  void play();
}

function choose(i){
  if(busy||selected!==null||!roll?.[i]||resolved.has(i))return;
  selected=i;
  // Do not render the underlying detail panel here. The result must remain
  // inside the cinematic overlay until the reveal sequence has completed.
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
  if(!Array.isArray(d)){window.toast?.('La biblioteca no está lista. Vuelve a intentarlo.');return;}
  d.push({anime:x.title,watched:'0',total:x.episodes?String(x.episodes):'',duration:x.duration?String(x.duration):'',durationMin:x.duration||0,state:'pendiente',score:'',favorite:false,cover:x.cover,coverImage:x.cover,bannerImage:x.banner,description:x.description,genres:x.genres,tags:x.tags,apiStatus:x.status,anilistStatus:x.status,apiScore:x.score?x.score/10:0,aniId:x.id,anilistId:x.id,knownTotal:x.episodes?String(x.episodes):'',plannedEpisodes:x.episodes?String(x.episodes):'',newEpisodes:0,siteUrl:x.siteUrl,source:'onebase-lootbox-v2',addedAt:Date.now(),updatedAt:Date.now()});
  try{if(typeof window.save==='function')window.save({skipBackup:true});else {localStorage.setItem('anime_tracker_v6',JSON.stringify(d));window.dispatchEvent(new Event('animetracker:saved'));}}catch(error){window.toast?.('No se pudo guardar: '+String(error?.message||error));return;}
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
  const previous=Array.isArray(roll)&&roll.length===5?roll:null;
  selected=null;resolved.clear();loadError='';busy=true;renderLoot();
  try{
    const next=await fetchRoll();
    if(previous)previous.forEach(x=>markHistory(x.id));
    roll=next;
  }catch(e){
    roll=previous;
    loadError=String(e?.message||e);
    window.toast?.(loadError);
  }finally{busy=false;renderLoot()}
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
  if(!inLoot())return;
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

window.OneBaseLootV2={reroll,render:renderLoot};
window.dispatchEvent(new CustomEvent('onebase:loot-v2-ready'));
})();