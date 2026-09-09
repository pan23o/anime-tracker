(()=>{'use strict';
const SUPABASE_URL='https://djfjqecahztogacliav.supabase.co';
const SUPABASE_KEY='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const LIB='anime_tracker_v6';
const PROFILE='anime_tracker_profile_v1';
const SETTINGS='anime_tracker_settings_v1';
const LAST_SAVE='anime_tracker_last_save';
const BACKUP='anime_tracker_resilient_backup_v2';
const MODE='anime_tracker_mode_v1';
const STATE_KEYS=[LIB,PROFILE,SETTINGS,'anime_tracker_activity','anime_tracker_v6_unlocked_achievements','anime_tracker_trash_v1','anime_tracker_backups_v1','anime_tracker_theme','anime_tracker_custom_theme',LAST_SAVE];
const sb=window.supabase?.createClient(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
if(!sb)return;
const $=id=>document.getElementById(id);
const toast=m=>window.toast?window.toast(m):console.info('[AnimeTracker]',m);
const read=(k,f=null)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch{return f}};
const library=()=>{const a=read(LIB,[]);return Array.isArray(a)?a.filter(x=>String(x?.anime||'').trim()):[]};
const stableName=s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase();
const snapshot=()=>{const out={};for(const k of STATE_KEYS){const v=localStorage.getItem(k);if(v!==null)out[k]=v}return out};
const parseLibrary=state=>{try{const a=JSON.parse(state?.[LIB]||'[]');return Array.isArray(a)?a.filter(x=>String(x?.anime||'').trim()):[]}catch{return[]}};
const stamp=()=>Number(localStorage.getItem(LAST_SAVE)||0)||0;
const setStamp=()=>localStorage.setItem(LAST_SAVE,String(Date.now()));
function backup(){const a=library();if(!a.length)return;try{const old=read(BACKUP,null);const now=Date.now();if(old?.savedAt&&now-old.savedAt<250)return;localStorage.setItem(BACKUP,JSON.stringify({version:2,savedAt:now,state:snapshot()}))}catch(e){console.warn('[AnimeTracker] backup',e)}}
function restoreLocalBackup(){const b=read(BACKUP,null);const a=parseLibrary(b?.state);if(!a.length||library().length)return false;const bs=Number(b.savedAt||0);if(stamp()&&stamp()>=bs)return false;for(const [k,v] of Object.entries(b.state||{}))localStorage.setItem(k,v);return true}
function mergeLibrary(local,cloud){const map=new Map();for(const x of cloud||[])map.set(stableName(x.anime),x);for(const x of local||[])map.set(stableName(x.anime),x);return [...map.values()]}
function sameLibrary(a,b){if(a.length!==b.length)return false;const norm=x=>({anime:String(x?.anime||''),watched:x?.watched||0,favorite:!!x?.favorite,rating:x?.rating??'',status:x?.status??'',notes:x?.notes??'',episodes:x?.episodes??x?.totalEpisodes??''});for(let i=0;i<a.length;i++){if(JSON.stringify(norm(a[i]))!==JSON.stringify(norm(b[i])))return false}return true}
async function currentUser(){return (await sb.auth.getUser()).data?.user||null}
async function cloudRow(user){if(!user)return null;const {data,error}=await sb.from('tracker_state').select('state,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data||null}
async function push(user){if(!user)return;const state=snapshot();const {error}=await sb.from('tracker_state').upsert({user_id:user.id,state,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;setStamp()}
async function reconcile(reason='auto'){
  const user=await currentUser();
  if(!user){backup();return {ok:true,mode:'local'}};
  backup();
  let row=await cloudRow(user);
  let local=library();
  let cloud=parseLibrary(row?.state);

  // NEVER replace a non-empty browser library with an empty cloud row.
  // Local data is the source of truth during a refresh; cloud is the mirror.
  if(local.length===0){
    const b=read(BACKUP,null), ba=parseLibrary(b?.state);
    if(cloud.length){
      local=cloud;
      localStorage.setItem(LIB,JSON.stringify(local));
      for(const [k,v] of Object.entries(row.state||{})) if(localStorage.getItem(k)===null) localStorage.setItem(k,v);
      setStamp();
      backup();
      return {ok:true,mode:'restored-cloud',reloaded:true};
    }
    if(ba.length){
      restoreLocalBackup();
      return {ok:true,mode:'restored-backup',reloaded:true};
    }
  }

  const merged=mergeLibrary(local,cloud);
  if(!sameLibrary(local,merged)){
    localStorage.setItem(LIB,JSON.stringify(merged));
    setStamp();
    backup();
    // Push the merged local-first state. Never pull blindly.
    row=await cloudRow(user);
    await push(user);
    window.dispatchEvent(new CustomEvent('animetracker:restored'));
    return {ok:true,mode:'merged'};
  }

  // A missing cloud row, an older/shorter cloud library, or a normal local save
  // means the browser state must be mirrored to the account.
  if(!row || merged.length>cloud.length || stamp()===0){await push(user)}
  backup();
  return {ok:true,mode:'synced'};
}
function hideDuplicateProfile(){document.querySelectorAll('.cloud-account-btn').forEach(x=>x.style.display='none')}
function wireAuth(){
  const login=$('cloudLogin'),register=$('cloudRegister'),sync=$('cloudSyncBtn'),logout=$('cloudLogoutBtn');
  if(login)login.onclick=async()=>{const email=$('cloudEmail')?.value.trim()||'',password=$('cloudPassword')?.value||'',box=$('cloudStatus');if(!email||!password){if(box)box.textContent='Escribe correo y contraseña.';return}if(box)box.textContent='Iniciando sesión...';const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){if(box)box.textContent=error.message;return}if(box)box.textContent='Sesión iniciada.';$('cloudAuthOverlay')?.classList.remove('show');try{const r=await reconcile('login');if(r.reloaded)setTimeout(()=>location.reload(),80)}catch(e){console.error(e);toast('No se pudo sincronizar; tus datos locales siguen intactos')}};
  if(register)register.onclick=async()=>{const email=$('cloudEmail')?.value.trim()||'',password=$('cloudPassword')?.value||'',name=$('cloudName')?.value.trim()||'',box=$('cloudStatus');if(!email||!password){if(box)box.textContent='Escribe correo y contraseña.';return}if(password.length<6){if(box)box.textContent='La contraseña debe tener al menos 6 caracteres.';return}localStorage.setItem('anime_tracker_pending_signup_name',name.slice(0,32));if(box)box.textContent='Creando cuenta...';const {data,error}=await sb.auth.signUp({email,password,options:{data:{username:name},emailRedirectTo:location.origin+location.pathname}});if(error){if(box)box.textContent=error.message;return}if(data?.session&&data.user){try{await reconcile('signup')}catch(e){console.error(e)}$('cloudAuthOverlay')?.classList.remove('show');if(box)box.textContent='Cuenta creada.'}else if(box)box.textContent='Cuenta creada. Revisa tu correo para confirmar el email.'};
  if(sync)sync.onclick=async()=>{try{const r=await reconcile('manual');if(r.reloaded)setTimeout(()=>location.reload(),80);else toast('☁️ Sincronización completada')}catch(e){console.error(e);toast('No se pudo sincronizar; la lista local no se ha borrado')}};
  if(logout)logout.onclick=async()=>{if(!confirm('¿Cerrar sesión? Tus datos locales permanecerán guardados.'))return;backup();await sb.auth.signOut();localStorage.removeItem(MODE);toast('Sesión cerrada')};
}
async function boot(){
  hideDuplicateProfile();
  wireAuth();
  // Local storage is intentionally allowed to initialize the app first.
  // If it disappears between scripts, the backup restores it before any cloud pull.
  if(restoreLocalBackup()){setTimeout(()=>location.reload(),80);return}
  if(library().length)backup();
  try{const r=await reconcile('boot');if(r.reloaded)setTimeout(()=>location.reload(),80)}catch(e){console.warn('[AnimeTracker] cloud boot',e)}
}
let last='';let timer=0;
function watch(){try{const a=library();const fp=JSON.stringify(a);if(a.length&&fp!==last){last=fp;backup();clearTimeout(timer);timer=setTimeout(()=>{currentUser().then(u=>u?push(u):null).catch(()=>{})},350)}if(!a.length&&last){if(restoreLocalBackup()){toast('♻️ Biblioteca recuperada');setTimeout(()=>location.reload(),80)}}}catch{}}
window.addEventListener('animetracker:saved',()=>{backup();clearTimeout(timer);timer=setTimeout(()=>{reconcile('saved').catch(e=>console.warn('[AnimeTracker] save sync',e))},250)});
window.addEventListener('beforeunload',backup);
sb.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_IN'&&session?.user){setTimeout(()=>reconcile('auth').then(r=>{if(r.reloaded)setTimeout(()=>location.reload(),80)}).catch(console.warn),120)}});
window.AnimeTrackerCloud={sync:()=>reconcile('manual')};
window.addEventListener('load',()=>{boot().catch(console.error);setInterval(watch,700)});
})();
