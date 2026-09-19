(function(){
'use strict';
const SUPABASE_URL='https://djfjqecahztogacliavh.supabase.co';
const SUPABASE_KEY='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const $=s=>document.querySelector(s);
const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const params=new URLSearchParams(location.search),id=params.get('id');
async function load(){
  if(!id){showError('Perfil no especificado','Necesitas un enlace público de OneBase para abrir este perfil.');return}
  try{
    const url=SUPABASE_URL+'/rest/v1/profiles?select=id,username,avatar_data,bio,public_stats,created_at&id=eq.'+encodeURIComponent(id)+'&public_enabled=eq.true&limit=1';
    const r=await fetch(url,{headers:{apikey:SUPABASE_KEY,Authorization:'Bearer '+SUPABASE_KEY,Accept:'application/json'},cache:'no-store'});
    const rows=await r.json().catch(()=>[]);
    if(!r.ok||!Array.isArray(rows)||!rows.length){showError('Perfil no disponible','Este perfil no existe o su propietario no lo ha marcado como público.');return}
    render(rows[0]);
  }catch(e){console.error('[ONEBASE] public profile',e);showError('No se pudo cargar','Comprueba tu conexión e inténtalo de nuevo.')}
}
function showError(title,body){
  const s=$('#state');s.innerHTML='<div><strong style="display:block;color:#fff;font-size:18px">'+esc(title)+'</strong><p>'+esc(body)+'</p><a class="back" href="/" style="display:inline-block;margin-top:10px">Volver a OneBase</a></div>';
}
function initials(name){return String(name||'Usuario').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'OB'}
function render(p){
  const st=p.public_stats&&typeof p.public_stats==='object'?p.public_stats:{};
  const name=String(p.username||'Usuario'),avatar=String(p.avatar_data||''),bio=String(p.bio||'');
  const stats=[
    ['animeCount','Animes'],['completed','Completados'],['chapters','Capítulos vistos'],['favorites','Favoritos'],['active','Activos']
  ];
  const profile=$('#profile');
  profile.innerHTML='<div class="profile-hero">'+ '<div class="avatar">'+(avatar?'<img src="'+esc(avatar)+'" alt="Avatar de '+esc(name)+'">':esc(initials(name)))+'</div><div class="hero-copy"><div class="kicker">ONEBASE · PERFIL PÚBLICO</div><h1 class="name">'+esc(name)+'</h1>'+(bio?'<p class="bio">'+esc(bio)+'</p>':'')+'</div></div><div class="content"><div class="stats">'+stats.map(x=>'<div class="stat"><b>'+fmt(st[x[0]])+'</b><span>'+x[1]+'</span></div>').join('')+'<div class="stat"><b>'+(Number(st.avgScore)>0?Number(st.avgScore).toFixed(1):'—')+'</b><span>Nota media personal</span></div></div><h2 class="section-title">Favoritos destacados</h2><div class="highlights" id="highlights"></div></div>';
  const highlights=Array.isArray(st.highlights)?st.highlights:[];
  const h=$('#highlights');
  h.innerHTML=highlights.length?highlights.map(x=>'<article class="anime"><div class="anime-cover">'+(x.cover?'<img loading="lazy" src="'+esc(x.cover)+'" alt="">':'')+'</div><div class="anime-body"><div class="anime-title" title="'+esc(x.title||'')+'">'+esc(x.title||'Anime')+'</div><div class="anime-score">'+(x.score===null||x.score===undefined?'Sin nota':Number(x.score).toFixed(1)+'/10')+'</div></div></article>').join(''):'<div class="empty" style="grid-column:1/-1">No hay favoritos destacados publicados todavía.</div>';
  document.title=name+' · ONEBASE';
  $('#state').classList.add('hidden');profile.classList.remove('hidden');
}
function fmt(n){return new Intl.NumberFormat('es-ES').format(Number(n)||0)}
load();
})();