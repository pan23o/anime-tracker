(()=>{'use strict';
const SUPABASE_URL='https://djfjqecahztogacliav.supabase.co';
const SUPABASE_KEY='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const LIB='anime_tracker_v6',PROFILE='anime_tracker_profile_v1',SETTINGS='anime_tracker_settings_v1',LAST_SAVE='anime_tracker_last_save',MODE='anime_tracker_mode_v2',INIT='anime_tracker_local_initialized_v1',VAULT='anime_tracker_persistent_v1';
const KEYS=[LIB,PROFILE,SETTINGS,'anime_tracker_activity','anime_tracker_v6_unlocked_achievements','anime_tracker_trash_v1','anime_tracker_backups_v1','anime_tracker_theme','anime_tracker_custom_theme',LAST_SAVE];
const sb=window.__animeTrackerSupabase||(window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}));
window.__animeTrackerSupabase=sb;if(!sb)return;
const $=id=>document.getElementById(id),toast=m=>window.toast?window.toast(m):console.info('[AnimeTracker]',m);
const read=(k,f=null)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch{return f}};
const lib=()=>{const a=read(LIB,[]);return Array.isArray(a)?a.filter(x=>String(x?.anime||'').trim()):[]};
const name=s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase(),stamp=()=>Number(localStorage.getItem(LAST_SAVE)||0)||0;
const snapshot=()=>{const o={};for(const k of KEYS){const v=localStorage.getItem(k);if(v!==null)o[k]=v}return o};
const parseLib=s=>{try{const a=JSON.parse(s?.[LIB]||'[]');return Array.isArray(a)?a.filter(x=>String(x?.anime||'').trim()):[]}catch{return[]}};
function same(a,b){if(a.length!==b.length)return false;const c=x=>({anime:String(x?.anime||''),watched:x?.watched??0,favorite:!!x?.favorite,rating:x?.rating??'',status:x?.status??'',notes:x?.notes??'',episodes:x?.episodes??x?.totalEpisodes??''});for(let i=0;i<a.length;i++)if(JSON.stringify(c(a[i]))!==JSON.stringify(c(b[i])))return false;return true}
function merge(local,cloud){const m=new Map();for(const x of cloud||[])m.set(name(x.anime),x);for(const x of local||[])m.set(name(x.anime),x);return [...m.values()]}
function saveVault(){const a=lib();if(!a.length)return false;localStorage.setItem(VAULT,JSON.stringify({version:2,savedAt:Date.now(),lastSave:stamp()||Date.now(),state:snapshot()}));return true}
function restoreVault(){const v=read(VAULT,null),a=parseLib(v?.state);if(!a.length||lib().length)return false;for(const [k,val] of Object.entries(v.state||{}))localStorage.setItem(k,val);if(!stamp())localStorage.setItem(LAST_SAVE,String(v.lastSave||Date.now()));localStorage.setItem(INIT,'1');return true}
function markInitialized(){localStorage.setItem(INIT,'1')}
function mode(){return localStorage.getItem(MODE)||''} function setMode(v){if(v)localStorage.setItem(MODE,v);else localStorage.removeItem(MODE)}
function overlay(show){const o=$('cloudAuthOverlay');if(!o)return;o.classList.toggle('show',!!show);o.setAttribute('aria-hidden',show?'false':'true')}
function closeTransient(){overlay(false);$('cloudUserMenu')?.classList.remove('show')}
let sessionUser=null,loginBusy=false;
function setupAuthUi(){
 const close=$('cloudClose'),loginBtn=$('cloudLogin'),regBtn=$('cloudRegister'),resetBtn=$('cloudReset'),account=$('cloudAccountBtn');
 if(close)close.onclick=closeTransient;
 const o=$('cloudAuthOverlay');if(o&&!o.dataset.bound){o.dataset.bound='1';o.addEventListener('click',e=>{if(e.target===o)closeTransient()})}
 if(!document.documentElement.dataset.atEscape){document.documentElement.dataset.atEscape='1';document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTransient()},{passive:true})}
 if(account)account.onclick=()=>{if(sessionUser)$('cloudUserMenu')?.classList.toggle('show');else overlay(true)};
 if(loginBtn)loginBtn.onclick=async()=>{
  if(loginBusy)return;if(sessionUser){closeTransient();return}
  const email=$('cloudEmail')?.value.trim()||'',password=$('cloudPassword')?.value||'',box=$('cloudStatus');if(!email||!password){if(box)box.textContent='Escribe correo y contraseña.';return}
  loginBusy=true;if(box)box.textContent='Iniciando sesión…';
  const {data,error}=await sb.auth.signInWithPassword({email,password});loginBusy=false;
  if(error){if(box)box.textContent=error.message;return}
  sessionUser=data?.user||null;setMode('account');closeTransient();updateUi();
 };
 if(regBtn)regBtn.onclick=async()=>{
  if(loginBusy)return;const email=$('cloudEmail')?.value.trim()||'',password=$('cloudPassword')?.value||'',nv=$('cloudName')?.value.trim()||'',box=$('cloudStatus');if(!email||!password){if(box)box.textContent='Escribe correo y contraseña.';return}if(password.length<6){if(box)box.textContent='La contraseña debe tener al menos 6 caracteres.';return}
  loginBusy=true;if(box)box.textContent='Creando cuenta…';localStorage.setItem('anime_tracker_pending_signup_name',nv.slice(0,32));const {data,error}=await sb.auth.signUp({email,password,options:{data:{username:nv},emailRedirectTo:location.origin+location.pathname}});loginBusy=false;
  if(error){if(box)box.textContent=error.message;return}if(data?.session&&data.user){sessionUser=data.user;setMode('account');closeTransient();updateUi()}else if(box)box.textContent='Cuenta creada. Revisa tu correo para confirmar el email.';
 };
 if(resetBtn)resetBtn.onclick=async()=>{const email=$('cloudEmail')?.value.trim()||'';if(!email){$('cloudStatus').textContent='Escribe tu correo primero.';return}const {error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});$('cloudStatus').textContent=error?'No se pudo enviar el correo.':'Te hemos enviado un correo para restablecer la contraseña.'};
}
async function getSession(){try{const {data,error}=await sb.auth.getSession();if(error){console.warn('[AnimeTracker] session',error);return null}return data?.session?.user||null}catch(e){console.warn('[AnimeTracker] session',e);return null}}
async function cloudRow(user){const {data,error}=await sb.from('tracker_state').select('state,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data||null}
async function push(user){const {error}=await sb.from('tracker_state').upsert({user_id:user.id,state:snapshot(),updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;localStorage.setItem(LAST_SAVE,String(Date.now()))}
async function profile(user){try{const {data}=await sb.from('profiles').select('username,avatar_data,created_at').eq('id',user.id).maybeSingle();const p=read(PROFILE,{})||{};if(data)localStorage.setItem(PROFILE,JSON.stringify({...p,name:data.username||p.name||'Usuario',email:user.email||'',avatar:data.avatar_data||p.avatar||'',createdAt:p.createdAt||Date.parse(data.created_at||'')||Date.now()}));else{const pending=localStorage.getItem('anime_tracker_pending_signup_name');if(pending){await sb.from('profiles').upsert({id:user.id,username:pending.slice(0,32),updated_at:new Date().toISOString()},{onConflict:'id'});localStorage.removeItem('anime_tracker_pending_signup_name')}}}catch(e){console.warn('[AnimeTracker] profile',e)}}
async function reconcile(){if(!sessionUser)return;const local=lib(),row=await cloudRow(sessionUser),cloud=parseLib(row?.state);
 if(!local.length&&!localStorage.getItem(INIT)&&cloud.length){localStorage.setItem(LIB,JSON.stringify(cloud));localStorage.setItem(LAST_SAVE,String(Date.now()));markInitialized();saveVault();window.dispatchEvent(new CustomEvent('animetracker:restored'));return}
 if(!row){if(local.length)await push(sessionUser);saveVault();return}
 if(!local.length&&localStorage.getItem(INIT))return;
 const merged=merge(local,cloud);
 if(!same(local,merged)){localStorage.setItem(LIB,JSON.stringify(merged));localStorage.setItem(LAST_SAVE,String(Date.now()));markInitialized();saveVault();await push(sessionUser);window.dispatchEvent(new CustomEvent('animetracker:restored'));return}
 if(!same(cloud,local))await push(sessionUser);saveVault();
}
async function finishSession(){if(!sessionUser)return;setMode('account');saveVault();try{await profile(sessionUser);await reconcile();updateUi()}catch(e){console.error('[AnimeTracker] account sync',e);toast('Sesión iniciada. Tus datos locales siguen intactos.')}}
async function manualSync(){if(!sessionUser){setMode('account');overlay(true);return}try{await reconcile();toast('☁️ Sincronización completada')}catch(e){console.error(e);toast('No se pudo sincronizar; la lista local sigue intacta')}}
async function logout(){if(!sessionUser)return;if(!confirm('¿Cerrar sesión? Tus datos locales permanecerán guardados.'))return;saveVault();await sb.auth.signOut();sessionUser=null;setMode('');closeTransient();updateUi();showChoice(true);toast('Sesión cerrada')}
function updateUi(){document.querySelectorAll('.cloud-account-btn').forEach(x=>x.style.display='none');if($('cloudUserLabel'))$('cloudUserLabel').textContent=sessionUser?.email||'';if($('cloudAccountBtn'))$('cloudAccountBtn').textContent=sessionUser?'👤':'☁️';if($('cloudSyncBtn'))$('cloudSyncBtn').style.display=sessionUser?'':'none';if($('cloudLogoutBtn'))$('cloudLogoutBtn').style.display=sessionUser?'':'none';if($('cloudStatus')&&sessionUser)$('cloudStatus').textContent='Sesión activa'}
function showChoice(force=false){if(sessionUser)return;if(!force&&mode())return;let o=$('animeModeChoice');if(!o){o=document.createElement('div');o.id='animeModeChoice';o.innerHTML=`<div class="modeBackdrop"></div><div class="modeCard"><span class="modeKicker">ANIMETRACKER</span><h2>¿Cómo quieres usar tu biblioteca?</h2><p>Elige una vez. Esta elección no volverá a aparecer al recargar la página.</p><div class="modeOptions"><button id="modeLocal" class="modeOption"><strong>💾 Continuar en local</strong><span>Sin cuenta. Todo queda en este navegador.</span></button><button id="modeAccount" class="modeOption featured"><strong>☁️ Usar una cuenta</strong><span>Guarda tu biblioteca, progreso y perfil en tu cuenta.</span><em>Recomendado</em></button></div><button id="modeLater" class="modeLater">Seguir sin decidir</button></div>`;document.body.appendChild(o);$('modeLocal').onclick=()=>{setMode('local');markInitialized();o.remove();updateUi()};$('modeAccount').onclick=()=>{setMode('account');o.remove();overlay(true)};$('modeLater').onclick=()=>{setMode('local');markInitialized();o.remove();updateUi()}}o.style.display='grid'}
function setupProfileShortcut(){const b=$('profileTopBtn');if(b&&!b.dataset.v6){b.dataset.v6='1';b.onclick=()=>{const m=$('settingsModal');if(m)m.classList.remove('hidden');else overlay(!sessionUser)}}}
async function boot(){setupAuthUi();setupProfileShortcut();updateUi();const hadLocal=lib().length>0;if(!hadLocal)restoreVault();const restored=lib().length>0;if(restored)markInitialized();sessionUser=await getSession();if(sessionUser){setMode('account');updateUi();await finishSession()}else{if(!mode()&&restored===false)showChoice(false);else if(mode()==='account')showChoice(false);}}
let fp='',timer=0;function watch(){try{const a=lib(),f=JSON.stringify(a);if(a.length&&f!==fp){fp=f;markInitialized();saveVault();clearTimeout(timer);if(sessionUser)timer=setTimeout(()=>push(sessionUser).catch(console.warn),600)}if(!a.length&&fp){if(restoreVault()){toast('♻️ Biblioteca local recuperada');window.dispatchEvent(new CustomEvent('animetracker:restored'))}}}catch(e){console.warn('[AnimeTracker] watcher',e)}}
window.addEventListener('animetracker:saved',()=>{if(!lib().length)return;markInitialized();saveVault();if(sessionUser){clearTimeout(timer);timer=setTimeout(()=>push(sessionUser).catch(console.warn),400)}});
window.addEventListener('beforeunload',saveVault);
sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user&&!loginBusy){sessionUser=session.user;setMode('account');updateUi();setTimeout(()=>finishSession().catch(console.warn),0)}if(event==='SIGNED_OUT'){sessionUser=null;setMode('');updateUi()}});
window.AnimeTrackerCloud={sync:manualSync,refresh:updateUi};
window.addEventListener('load',()=>{boot().catch(console.error);setInterval(watch,500);const s=$('cloudSyncBtn');if(s)s.onclick=manualSync;const l=$('cloudLogoutBtn');if(l)l.onclick=logout});
})();