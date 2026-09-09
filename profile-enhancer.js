/* AnimeTracker persistence engine v6
 * Block 4: durable local vault + account isolation + working logout/auth + cloud sync
 */
(function(){
'use strict';

const SUPABASE_URL='https://djfjqecahztogacliavh.supabase.co';
const SUPABASE_KEY='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const LIB='anime_tracker_v6';
const META='anime_tracker_persistence_v2';
const PROFILE='anime_tracker_profile_v1';
const VAULT_DB='AnimeTrackerVault_v1';
const VAULT_STORE='states';
const VAULT_MIRROR='anime_tracker_vault_mirror_v1';

const $=id=>document.getElementById(id);
const safeParse=(s,f)=>{try{return JSON.parse(s)}catch{return f}};
const now=()=>Date.now();
const uuid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
const toast=m=>window.toast?window.toast(m):console.info('[AnimeTracker]',m);

const sb=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
if(!sb){console.error('[AnimeTracker] Supabase client unavailable');return}

function getMeta(){return safeParse(localStorage.getItem(META)||'{}',{})||{}}
function setMeta(v){try{localStorage.setItem(META,JSON.stringify(v))}catch(e){console.warn(e)}}
function ensureMeta(){const m=getMeta();if(!m.deviceId)m.deviceId=uuid();if(!Number.isFinite(m.revision))m.revision=0;if(!Number.isFinite(m.savedAt))m.savedAt=0;if(!('owner' in m))m.owner='';setMeta(m);return m}
function library(){const a=safeParse(localStorage.getItem(LIB)||'[]',[]);return Array.isArray(a)?a.filter(x=>x&&typeof x==='object'&&String(x.anime||'').trim()):[]}
function normalizeItem(x){
  const n=typeof window.normalizeItem==='function'?window.normalizeItem.bind(window):null;
  if(n){try{return n(x)}catch(e){}}
  return {...x,anime:String(x?.anime||''),watched:String(x?.watched||''),total:String(x?.total||''),favorite:Boolean(x?.favorite),updatedAt:Number(x?.updatedAt)||Number(x?.addedAt)||now(),addedAt:Number(x?.addedAt)||now()};
}
function cleanList(v){return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&String(x.anime||'').trim()).map(normalizeItem):[]}
function writeLocalList(list,{render=true}={}){
  const clean=cleanList(list);
  try{localStorage.setItem(LIB,JSON.stringify(clean));}catch(e){console.error('[AnimeTracker] local library write',e);return false}
  try{
    if(typeof data!=='undefined'){
      data=clean.map(normalizeItem);
      if(render&&typeof window.render==='function')window.render();
    }
  }catch(e){console.warn('[AnimeTracker] app render after restore',e)}
  window.dispatchEvent(new CustomEvent('animetracker:restored',{detail:{source:'vault',count:clean.length}}));
  return true;
}

/* ---------- durable local vault ---------- */
let vaultDbPromise=null;
function openVault(){
  if(vaultDbPromise)return vaultDbPromise;
  vaultDbPromise=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(new Error('INDEXED_DB_UNAVAILABLE'));return}
    const req=indexedDB.open(VAULT_DB,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(VAULT_STORE))req.result.createObjectStore(VAULT_STORE,{keyPath:'key'})};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('INDEXED_DB_OPEN'));
  }).catch(e=>{vaultDbPromise=null;throw e});
  return vaultDbPromise;
}
function mirrorKey(owner){return owner||'guest'}
async function putVault(owner,list){
  const clean=cleanList(list),key=mirrorKey(owner),record={key,updatedAt:now(),library:clean};
  try{localStorage.setItem(`${VAULT_MIRROR}:${key}`,JSON.stringify(record));}catch(e){}
  try{
    const db=await openVault();
    await new Promise((resolve,reject)=>{const tx=db.transaction(VAULT_STORE,'readwrite');tx.objectStore(VAULT_STORE).put(record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error||new Error('INDEXED_DB_WRITE'))});
  }catch(e){console.warn('[AnimeTracker] IndexedDB vault write fallback to mirror',e)}
}
async function getVault(owner){
  const key=mirrorKey(owner);
  try{
    const db=await openVault();
    const record=await new Promise((resolve,reject)=>{const tx=db.transaction(VAULT_STORE,'readonly');const r=tx.objectStore(VAULT_STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error||new Error('INDEXED_DB_READ'))});
    if(record?.library) return cleanList(record.library);
  }catch(e){console.warn('[AnimeTracker] IndexedDB vault read fallback to mirror',e)}
  const mirror=safeParse(localStorage.getItem(`${VAULT_MIRROR}:${key}`)||'null',null);
  return cleanList(mirror?.library||[]);
}
async function saveCurrentVault(owner){try{await putVault(owner,library())}catch(e){console.warn(e)}}

/* ---------- account UI ---------- */
let user=null,bootPromise=null,syncTimer=null,syncing=false,syncQueued=false,ownerSwitching=false,profileTimer=null,profileSyncing=false;
let lastLibraryFingerprint='',lastProfileFingerprint='';
let accountUiBound=false;

function profileLocal(){return safeParse(localStorage.getItem(PROFILE)||'{}',{})||{}}
function initials(name){return String(name||'Usuario').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'AT'}
function normalizeProfile(p){return {name:String(p?.name||'Usuario').trim().slice(0,32)||'Usuario',email:String(user?.email||p?.email||'').trim().slice(0,120),avatar:String(p?.avatar||''),createdAt:Number(p?.createdAt)||now()}}
function updateProfileDom(p){
  const n=$('profileName');if(n)n.value=p.name||'Usuario';
  const e=$('profileEmail');if(e)e.value=p.email||'';
  const d=$('profileDisplayName');if(d)d.textContent=p.name||'Usuario';
  const ed=$('profileEmailDisplay');if(ed)ed.textContent=p.email||'Sin correo configurado';
  for(const id of ['profileAvatar','profileTopBtn']){const el=$(id);if(!el)continue;el.innerHTML=p.avatar?`<img src="${p.avatar}" alt="Foto de perfil">`:initials(p.name)}
}
function ensureUiStyle(){
  if($('atAccountUiStyle'))return;
  const s=document.createElement('style');s.id='atAccountUiStyle';s.textContent=`
  .cloud-account-btn{z-index:10020!important;position:fixed!important;transition:transform .18s ease,box-shadow .18s ease,border-color .18s ease!important}
  .cloud-account-btn:hover{transform:scale(1.05)}
  .cloud-account-btn[data-at-session="1"]{border-color:rgba(103,223,138,.55)!important;box-shadow:0 0 0 2px rgba(103,223,138,.18),0 0 26px rgba(103,223,138,.10)!important}
  .cloud-account-btn[data-at-session="1"]::after{content:"";position:absolute;right:1px;bottom:1px;width:10px;height:10px;border-radius:50%;background:#67df8a;border:2px solid #111;box-shadow:0 0 8px rgba(103,223,138,.55)}
  .cloud-user-menu{z-index:10021!important;min-width:270px!important;padding:10px!important}
  .cloud-user-menu.show{display:block!important}
  .at-account-head{padding:10px 10px 12px;margin-bottom:8px;border-bottom:1px solid rgba(255,255,255,.08);cursor:default}
  .at-account-state{font-size:10px;font-weight:900;letter-spacing:.5px;color:#67df8a}
  .at-account-name{margin-top:5px;font-size:13px;font-weight:900;color:#f4f4f4;overflow:hidden;text-overflow:ellipsis}
  .at-account-email{margin-top:2px;font-size:10px;color:#777;overflow:hidden;text-overflow:ellipsis}
  .at-local-state{padding:10px;color:#aaa;font-size:10px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}
  .cloud-logout-busy{opacity:.6!important;pointer-events:none!important}
  `;document.head.appendChild(s);
}
function updateAccountUi(){
  ensureUiStyle();
  const btn=$('cloudAccountBtn'),menu=$('cloudUserMenu'),syncBtn=$('cloudSyncBtn'),logoutBtn=$('cloudLogoutBtn'),status=$('cloudStatus');
  const p=profileLocal();
  if(user){
    if(btn){btn.textContent='👤';btn.dataset.atSession='1';btn.title='Cuenta conectada: '+(user.email||'');btn.setAttribute('aria-label','Cuenta conectada')}
    if(menu){menu.dataset.atSession='1';menu.querySelector('.at-local-state')?.remove();let head=menu.querySelector('.at-account-head');if(!head){head=document.createElement('div');head.className='at-account-head';menu.prepend(head)}head.innerHTML=`<div class="at-account-state">● SESIÓN INICIADA</div><div class="at-account-name"></div><div class="at-account-email"></div>`;head.querySelector('.at-account-name').textContent=p.name||'Cuenta';head.querySelector('.at-account-email').textContent=user.email||p.email||''}
    if(syncBtn)syncBtn.style.display='';if(logoutBtn){logoutBtn.style.display='';logoutBtn.disabled=false;logoutBtn.classList.remove('cloud-logout-busy')}
    if(status)status.textContent='✓ Sesión iniciada'+(p.name?' como '+p.name:'');document.documentElement.dataset.atSession='1';
  }else{
    if(btn){btn.textContent='☁️';delete btn.dataset.atSession;btn.title='Modo local · abrir cuenta';btn.setAttribute('aria-label','Abrir cuenta')}
    if(menu){menu.dataset.atSession='0';menu.querySelector('.at-account-head')?.remove();let local=menu.querySelector('.at-local-state');if(!local){local=document.createElement('div');local.className='at-local-state';menu.prepend(local)}local.textContent='● MODO LOCAL · no has iniciado sesión'}
    if(syncBtn)syncBtn.style.display='none';if(logoutBtn){logoutBtn.style.display='none';logoutBtn.disabled=false;logoutBtn.classList.remove('cloud-logout-busy')}
    if(status)status.textContent='Modo local. Pulsa la nube para iniciar sesión.';delete document.documentElement.dataset.atSession;
  }
}
function openAccountUi(){if(user){$('cloudUserMenu')?.classList.toggle('show');return}$('cloudAuthOverlay')?.classList.add('show')}
function bindAccountUi(){
  if(accountUiBound)return;accountUiBound=true;ensureUiStyle();
  $('cloudAccountBtn')?.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openAccountUi()});
  $('cloudClose')?.addEventListener('click',()=>{$('cloudAuthOverlay')?.classList.remove('show')});
  $('cloudAuthOverlay')?.addEventListener('click',e=>{if(e.target===$('cloudAuthOverlay'))$('cloudAuthOverlay').classList.remove('show')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('cloudAuthOverlay')?.classList.remove('show');$('cloudUserMenu')?.classList.remove('show')}},{passive:true});
  $('cloudSyncBtn')?.addEventListener('click',()=>syncNow(true));
  $('cloudLogoutBtn')?.addEventListener('click',logout);
  $('cloudLogin')?.addEventListener('click',login);
  $('cloudRegister')?.addEventListener('click',register);
  $('cloudReset')?.addEventListener('click',resetPassword);
}
function authMessage(m){const el=$('cloudStatus');if(el)el.textContent=m;}
async function login(){
  const email=String($('cloudEmail')?.value||'').trim(),password=String($('cloudPassword')?.value||'');
  if(!email||!password){authMessage('Escribe correo y contraseña.');return}
  authMessage('Iniciando sesión…');
  try{
    const{data,error}=await sb.auth.signInWithPassword({email,password});
    if(error)throw error;
    user=data?.user||null;
    $('cloudAuthOverlay')?.classList.remove('show');
    await bootstrap();
    updateAccountUi();
    toast('✓ Sesión iniciada');
  }catch(e){console.error('[AnimeTracker] login',e);authMessage(e?.message||'No se pudo iniciar sesión.')}
}
async function register(){
  const name=String($('cloudName')?.value||'').trim().slice(0,32)||'Usuario',email=String($('cloudEmail')?.value||'').trim(),password=String($('cloudPassword')?.value||'');
  if(!email||!password){authMessage('Escribe correo y contraseña.');return}
  if(password.length<6){authMessage('La contraseña debe tener al menos 6 caracteres.');return}
  authMessage('Creando cuenta…');
  try{
    const{data,error}=await sb.auth.signUp({email,password,data:{username:name}});if(error)throw error;
    if(data?.user){user=data.user;const p={name,email,avatar:'',createdAt:now()};localStorage.setItem(PROFILE,JSON.stringify(p));await bootstrap()}
    $('cloudAuthOverlay')?.classList.remove('show');updateAccountUi();toast(data?.session?'✓ Cuenta creada y sesión iniciada':'✓ Cuenta creada. Revisa tu correo para confirmar.');
  }catch(e){console.error('[AnimeTracker] register',e);authMessage(e?.message||'No se pudo crear la cuenta.')}
}
async function resetPassword(){
  const email=String($('cloudEmail')?.value||'').trim();if(!email){authMessage('Escribe tu correo para recuperar la contraseña.');return}
  authMessage('Enviando correo de recuperación…');
  try{const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.href});if(error)throw error;authMessage('✓ Revisa tu correo para restablecer la contraseña.')}catch(e){console.error('[AnimeTracker] reset password',e);authMessage(e?.message||'No se pudo enviar el correo.')}
}

/* ---------- cloud state ---------- */
async function getUser(){try{const{data,error}=await sb.auth.getUser();if(error)return null;return data?.user||null}catch{return null}}
async function loadRemote(){if(!user)return null;const{data,error}=await sb.from('tracker_state').select('state,revision,checksum,device_id,saved_at,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data||null}
async function writeRemoteState(nextState,remote=null){
  if(!user)return false;
  const m=ensureMeta(),nextRevision=Math.max(Number(remote?.revision)||0,Number(m.revision)||0)+1,savedAt=now(),json=JSON.stringify(nextState);
  const{error}=await sb.from('tracker_state').upsert({user_id:user.id,state:nextState,revision:nextRevision,checksum:String(json.length)+':'+hash(json),device_id:m.deviceId,saved_at:new Date(savedAt).toISOString(),updated_at:new Date(savedAt).toISOString()},{onConflict:'user_id'});
  if(error)throw error;setMeta({...m,revision:nextRevision,savedAt,owner:`account:${user.id}`});return true;
}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return(h>>>0).toString(16)}
function titleKey(t){return String(t||'').trim().toLocaleLowerCase('es-ES').replace(/\s+/g,' ')}
function itemKey(x){const id=String(x?.aniId||'').trim();return id?`id:${id}`:`title:${titleKey(x?.anime)}`}
function itemTime(x){const u=Number(x?.updatedAt),a=Number(x?.addedAt);return Number.isFinite(u)&&u>0?u:(Number.isFinite(a)?a:0)}
function mergeLists(cloudList,localList){
  const map=new Map();
  for(const source of [cloudList,localList])for(const raw of cleanList(source)){
    const x={...raw},k=itemKey(x);if(k==='title:')continue;const old=map.get(k);if(!old||itemTime(x)>=itemTime(old))map.set(k,x);
  }
  return [...map.values()];
}

/* ---------- account-scoped owner switching ---------- */
async function switchOwner(targetOwner,{allowMigration=true}={}){
  if(ownerSwitching)return;
  ownerSwitching=true;
  try{
    const m=ensureMeta(),currentOwner=String(m.owner||'');
    if(currentOwner===targetOwner){
      const backup=await getVault(targetOwner);if(!library().length&&backup.length)writeLocalList(backup);return;
    }
    if(currentOwner){await putVault(currentOwner,library())}
    const current=library();
    const canMigrate=allowMigration&&!currentOwner&&current.length;
    if(targetOwner===''){
      const guest=await getVault('');
      const next=guest.length?guest:(canMigrate?current:[]);
      writeLocalList(next);
      setMeta({...m,owner:''});
    }else{
      // Changing account must not merge the previous account's local library into the new one.
      const accountVault=await getVault(targetOwner);
      writeLocalList(accountVault,{render:true});
      setMeta({...m,owner:targetOwner});
      if(canMigrate) await putVault(targetOwner,current);
    }
  }finally{ownerSwitching=false}
}

async function reconcileAccount(){
  if(!user)return;
  const target=`account:${user.id}`;
  const m=ensureMeta();
  const currentOwner=String(m.owner||'');
  let local=library();
  // First-ever login: keep the anonymous local library as a deliberate migration candidate.
  const migrationCandidate=!currentOwner&&local.length>0;
  if(currentOwner!==target){
    if(currentOwner)await putVault(currentOwner,local);
    const accountVault=await getVault(target);
    local=accountVault.length?accountVault:(migrationCandidate?local:[]);
    writeLocalList(local);
    setMeta({...m,owner:target});
  }else if(!local.length){
    const backup=await getVault(target);if(backup.length){local=backup;writeLocalList(local)}
  }

  const remote=await loadRemote();
  const cloud=cleanList(safeParse(remote?.state?.[LIB]||'[]',[]));
  const before=JSON.stringify(local);
  if(!remote){
    if(local.length)await writeRemoteState({...((remote?.state)||{}),[LIB]:JSON.stringify(local)},null);
  }else if(!local.length&&cloud.length){
    writeLocalList(cloud);local=cloud;
    setMeta({...ensureMeta(),revision:Number(remote.revision)||0,savedAt:Date.parse(remote.saved_at||remote.updated_at)||now(),owner:target});
  }else if(local.length&&cloud.length){
    const merged=mergeLists(cloud,local),after=JSON.stringify(merged);
    if(after!==before)writeLocalList(merged);
    if(after!==JSON.stringify(cloud))await writeRemoteState({...remote.state,[LIB]:after},remote);
  }else if(local.length&&!cloud.length){
    await writeRemoteState({...((remote?.state)||{}),[LIB]:JSON.stringify(local)},remote);
  }
  await putVault(target,library());
  lastLibraryFingerprint=JSON.stringify(library());
}

/* ---------- profile ---------- */
async function getCloudProfile(){if(!user)return null;const{data,error}=await sb.from('profiles').select('username,avatar_data,created_at,updated_at').eq('id',user.id).maybeSingle();if(error)throw error;return data||null}
async function putCloudProfile(p){if(!user)return;const n=normalizeProfile(p);const{error}=await sb.from('profiles').upsert({id:user.id,username:n.name,avatar_data:n.avatar,updated_at:new Date().toISOString()},{onConflict:'id'});if(error)throw error}
async function syncProfileFromAccount(){
  if(!user||profileSyncing)return;profileSyncing=true;
  try{
    const local=profileLocal(),cloud=await getCloudProfile();
    if(cloud){const p=normalizeProfile({name:cloud.username||'Usuario',avatar:cloud.avatar_data||'',createdAt:Date.parse(cloud.created_at||'')||local.createdAt||now()});localStorage.setItem(PROFILE,JSON.stringify(p));updateProfileDom(p)}
    else{const p=normalizeProfile(local);localStorage.setItem(PROFILE,JSON.stringify(p));updateProfileDom(p);await putCloudProfile(p)}
  }catch(e){console.error('[AnimeTracker] profile sync',e)}finally{profileSyncing=false}
}
function scheduleProfileSync(){if(!user||profileSyncing)return;clearTimeout(profileTimer);profileTimer=setTimeout(async()=>{try{await putCloudProfile(profileLocal())}catch(e){console.warn(e)}},500)}

/* ---------- save/sync ---------- */
async function syncNow(force=false){
  if(!user)return false;
  if(syncing){syncQueued=true;return false}
  syncing=true;
  try{
    await putVault(`account:${user.id}`,library());
    const remote=await loadRemote(),list=library(),base=remote?.state&&typeof remote.state==='object'?remote.state:{};
    if(!list.length&&!force)return true;
    const serialized=JSON.stringify(list);
    if(remote&&String(base[LIB]||'')===serialized)return true;
    await writeRemoteState({...base,[LIB]:serialized},remote);
    return true;
  }catch(e){console.error('[AnimeTracker] cloud library sync',e);toast('No se pudo guardar la biblioteca en la nube. El respaldo local sigue guardado.');return false}
  finally{syncing=false;if(syncQueued){syncQueued=false;void syncNow(false)}}
}
function scheduleSync(){
  const owner=user?`account:${user.id}`:'';
  void putVault(owner,library());
  clearTimeout(syncTimer);if(!user)return;syncTimer=setTimeout(()=>void syncNow(false),700);
}
function observe(){
  lastLibraryFingerprint=JSON.stringify(library());lastProfileFingerprint=localStorage.getItem(PROFILE)||'';
  setInterval(()=>{
    const cur=JSON.stringify(library());
    if(cur!==lastLibraryFingerprint){lastLibraryFingerprint=cur;const owner=user?`account:${user.id}`:'';void putVault(owner,library());scheduleSync()}
    const pf=localStorage.getItem(PROFILE)||'';
    if(pf!==lastProfileFingerprint){lastProfileFingerprint=pf;updateAccountUi();scheduleProfileSync()}
  },250);
  window.addEventListener('animetracker:saved',scheduleSync);
  window.addEventListener('beforeunload',()=>{const owner=user?`account:${user.id}`:'';void putVault(owner,library());if(user)void syncNow(false)});
}

/* ---------- logout ---------- */
async function logout(e){
  e?.preventDefault?.();
  const btn=$('cloudLogoutBtn');if(btn){btn.disabled=true;btn.classList.add('cloud-logout-busy');btn.textContent='Cerrando sesión…'}
  try{
    const oldUser=user,owner=oldUser?`account:${oldUser.id}`:'',current=library();
    if(owner)await putVault(owner,current);
    // Keep a clean guest/local context. The old account data remains in its own vault and cloud row.
    await sb.auth.signOut();
    user=null;
    setMeta({...ensureMeta(),owner:''});
    const guest=await getVault('');writeLocalList(guest,{render:true});
    $('cloudUserMenu')?.classList.remove('show');updateAccountUi();toast('✓ Sesión cerrada');
  }catch(err){
    console.error('[AnimeTracker] logout',err);toast('No se pudo cerrar la sesión.');if(btn){btn.disabled=false;btn.classList.remove('cloud-logout-busy');btn.textContent='Cerrar sesión'}
  }
}

async function bootstrap(){
  if(bootPromise)return bootPromise;
  bootPromise=(async()=>{
    const found=await getUser();
    if(!found){user=null;ensureMeta();await switchOwner('',{allowMigration:false});updateAccountUi();return}
    user=found;updateAccountUi();
    await reconcileAccount();
    await syncProfileFromAccount();
    updateAccountUi();
  })();
  try{return await bootPromise}finally{bootPromise=null}
}

sb.auth.onAuthStateChange((event,session)=>{
  user=session?.user||null;updateAccountUi();
  if(event==='SIGNED_IN'&&user){void bootstrap()}
  if(event==='SIGNED_OUT'){user=null;updateAccountUi()}
});

async function boot(){
  ensureMeta();ensureUiStyle();bindAccountUi();updateAccountUi();
  try{await bootstrap()}catch(e){console.error('[AnimeTracker] bootstrap',e)}
  updateAccountUi();observe();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AnimeTrackerCloud={sync:async()=>user?syncNow(true):openAccountUi(),refresh:updateAccountUi,open:openAccountUi,logout};
})();
