/* AnimeTracker persistence engine v5 - block 3: library is account-scoped and merge-safe */
(function(){
'use strict';
const SUPABASE_URL='https://djfjqecahztogacliavh.supabase.co';
const SUPABASE_KEY='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const LIB='anime_tracker_v6';
const META='anime_tracker_persistence_v2';
const PROFILE='anime_tracker_profile_v1';
const SETTINGS='anime_tracker_settings_v1';
const OTHER=['anime_tracker_activity','anime_tracker_v6_unlocked_achievements','anime_tracker_trash_v1','anime_tracker_backups_v1','anime_tracker_theme','anime_tracker_custom_theme'];
const ALL=[LIB,PROFILE,SETTINGS,...OTHER];
const sb=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
if(!sb){console.error('[AnimeTracker] Supabase client unavailable');return}

const safeParse=(s,f)=>{try{return JSON.parse(s)}catch{return f}};
const now=()=>Date.now();
const uuid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
const $=id=>document.getElementById(id);
const toast=m=>window.toast?window.toast(m):console.info('[AnimeTracker]',m);
function meta(){return safeParse(localStorage.getItem(META),'')||{}}
function setMeta(m){localStorage.setItem(META,JSON.stringify(m))}
function ensureMeta(){const m=meta();if(!m.deviceId)m.deviceId=uuid();if(!Number.isFinite(m.revision))m.revision=0;if(!Number.isFinite(m.savedAt))m.savedAt=0;setMeta(m);return m}
function animeList(){const a=safeParse(localStorage.getItem(LIB)||'[]',[]);return Array.isArray(a)?a:[]}
function hasAnime(){return animeList().some(x=>String(x?.anime||'').trim())}
function snapshot(){const out={};for(const k of ALL){const v=localStorage.getItem(k);if(v!==null)out[k]=v}return out}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function state(){const m=ensureMeta(),snap=snapshot(),json=JSON.stringify(snap);return {snapshot:snap,checksum:hash(json),revision:m.revision||0,savedAt:m.savedAt||0,deviceId:m.deviceId}}
function setLocalRevision(revision,savedAt){const m=ensureMeta();m.revision=revision;m.savedAt=savedAt;setMeta(m)}
function titleKey(title){return String(title||'').trim().toLocaleLowerCase('es-ES').replace(/\s+/g,' ')}
function key(x){const aniId=String(x?.aniId||'').trim();return aniId?`id:${aniId}`:`title:${titleKey(x?.anime)}`}
function itemTime(x){const updated=Number(x?.updatedAt);if(Number.isFinite(updated)&&updated>0)return updated;const added=Number(x?.addedAt);return Number.isFinite(added)?added:0}
function cleanList(value){return Array.isArray(value)?value.filter(x=>x&&typeof x==='object'&&String(x.anime||'').trim()):[]}
function mergeLists(cloudList,localList){
  const merged=new Map();
  for(const source of [cloudList,localList]){
    for(const raw of cleanList(source)){
      const x={...raw};
      const k=key(x);if(k==='title:')continue;
      const old=merged.get(k);
      if(!old||itemTime(x)>=itemTime(old))merged.set(k,x);
    }
  }
  return [...merged.values()];
}
function serializeList(list){return JSON.stringify(cleanList(list))}

function profileLocal(){return safeParse(localStorage.getItem(PROFILE)||'{}',{})||{}}
function normalizeProfile(p,user){
  return {
    name:String(p?.name||'Usuario').trim().slice(0,32)||'Usuario',
    email:String(user?.email||p?.email||'').trim().slice(0,120),
    avatar:String(p?.avatar||''),
    createdAt:Number(p?.createdAt)||Date.now()
  };
}
function accountInitials(name){return String(name||'Usuario').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'AT'}
function ensureAccountUiStyle(){
  if($('atAccountUiStyle'))return;
  const s=document.createElement('style');s.id='atAccountUiStyle';
  s.textContent=`
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
  `;document.head.appendChild(s);
}
function updateAccountUi(){
  ensureAccountUiStyle();
  const btn=$('cloudAccountBtn'),menu=$('cloudUserMenu'),syncBtn=$('cloudSyncBtn'),logoutBtn=$('cloudLogoutBtn'),status=$('cloudStatus');
  const p=profileLocal();
  if(user){
    if(btn){btn.textContent='👤';btn.dataset.atSession='1';btn.title='Cuenta conectada: '+(user.email||'');btn.setAttribute('aria-label','Cuenta conectada');}
    if(menu){
      menu.dataset.atSession='1';
      let head=menu.querySelector('.at-account-head');
      if(!head){head=document.createElement('div');head.className='at-account-head';menu.prepend(head)}
      head.innerHTML='';
      const st=document.createElement('div');st.className='at-account-state';st.textContent='● SESIÓN INICIADA';
      const nm=document.createElement('div');nm.className='at-account-name';nm.textContent=p.name||'Cuenta';
      const em=document.createElement('div');em.className='at-account-email';em.textContent=user.email||p.email||'';
      head.append(st,nm,em);
    }
    if(syncBtn)syncBtn.style.display='';
    if(logoutBtn)logoutBtn.style.display='';
    if(status)status.textContent='✓ Sesión iniciada'+(p.name?' como '+p.name:'');
    document.documentElement.dataset.atSession='1';
  }else{
    if(btn){btn.textContent='☁️';delete btn.dataset.atSession;btn.title='Modo local · abrir cuenta';btn.setAttribute('aria-label','Abrir cuenta');}
    if(menu){menu.dataset.atSession='0';menu.querySelector('.at-account-head')?.remove();let local=menu.querySelector('.at-local-state');if(!local){local=document.createElement('div');local.className='at-local-state';menu.prepend(local)}local.textContent='● MODO LOCAL · no has iniciado sesión';}
    if(syncBtn)syncBtn.style.display='none';
    if(logoutBtn)logoutBtn.style.display='none';
    if(status)status.textContent='Modo local. Pulsa la nube para iniciar sesión.';
    delete document.documentElement.dataset.atSession;
  }
}
function openAccountUi(){if(user){$('cloudUserMenu')?.classList.toggle('show');return}$('cloudAuthOverlay')?.classList.add('show')}
function bindAccountUi(){
  if(accountUiBound)return;accountUiBound=true;ensureAccountUiStyle();
  const btn=$('cloudAccountBtn'),close=$('cloudClose'),overlay=$('cloudAuthOverlay');
  if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openAccountUi()});
  if(close)close.addEventListener('click',()=>overlay?.classList.remove('show'));
  if(overlay)overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){overlay?.classList.remove('show');$('cloudUserMenu')?.classList.remove('show')}},{passive:true});
}

async function getUser(){try{const{data,error}=await sb.auth.getUser();if(error)return null;return data?.user||null}catch{return null}}
async function loadRemote(){
  if(!user)return null;
  const{data,error}=await sb.from('tracker_state').select('state,revision,checksum,device_id,saved_at,updated_at').eq('user_id',user.id).maybeSingle();
  if(error)throw error;
  return data||null;
}
async function writeRemoteState(nextState,baseRemote=null){
  if(!user)return false;
  const baseRevision=Number(baseRemote?.revision)||0;
  const localRevision=Number(ensureMeta().revision)||0;
  const nextRevision=Math.max(baseRevision,localRevision)+1;
  const savedAt=now();
  const json=JSON.stringify(nextState);
  const payload={user_id:user.id,state:nextState,revision:nextRevision,checksum:hash(json),device_id:ensureMeta().deviceId,saved_at:new Date(savedAt).toISOString(),updated_at:new Date(savedAt).toISOString()};
  const{error}=await sb.from('tracker_state').upsert(payload,{onConflict:'user_id'});
  if(error)throw error;
  setLocalRevision(nextRevision,savedAt);
  return true;
}
async function saveLibraryRemote(force=false){
  if(!user)return false;
  const localList=animeList();
  if(!localList.length&&!force)return true;
  const remote=await loadRemote();
  const base=remote&&remote.state&&typeof remote.state==='object'?remote.state:{};
  const next={...base,[LIB]:serializeList(localList)};
  if(remote&&String(base[LIB]||'')===next[LIB])return true;
  return writeRemoteState(next,remote);
}

function getCloudProfile(){
  if(!user)return Promise.resolve(null);
  return sb.from('profiles').select('username,avatar_data,created_at,updated_at').eq('id',user.id).maybeSingle().then(({data,error})=>{if(error)throw error;return data||null});
}
async function putCloudProfile(p){
  if(!user)return;
  const normalized=normalizeProfile(p,user);
  const{error}=await sb.from('profiles').upsert({id:user.id,username:normalized.name,avatar_data:normalized.avatar,updated_at:new Date().toISOString()},{onConflict:'id'});
  if(error)throw error;
}
function applyProfileLocal(p){
  const next=normalizeProfile(p,user);
  localStorage.setItem(PROFILE,JSON.stringify(next));
  const n=$('profileName');if(n)n.value=next.name;
  const e=$('profileEmail');if(e)e.value=next.email;
  const d=$('profileDisplayName');if(d)d.textContent=next.name;
  const ed=$('profileEmailDisplay');if(ed)ed.textContent=next.email||'Sin correo configurado';
  const s=$('profileSince');if(s&&typeof window.formatDate==='function')s.textContent=`Perfil ${user?'de cuenta':'local'} desde ${window.formatDate(next.createdAt)}`;
  const initials=accountInitials(next.name);
  for(const id of ['profileTopBtn','profileAvatar']){const el=$(id);if(!el)continue;if(next.avatar)el.innerHTML=`<img src="${next.avatar}" alt="Foto de perfil">`;else el.textContent=initials}
  window.dispatchEvent(new CustomEvent('animetracker:profile-updated',{detail:next}));
  updateAccountUi();
}

let user=null,timer=null,profileTimer=null,syncing=false,profileSyncing=false,queued=false,lastSeen='',lastProfileSeen='';
let accountUiBound=false,bootstrapPromise=null;

async function bootstrap(){
  if(bootstrapPromise)return bootstrapPromise;
  bootstrapPromise=(async()=>{
    const found=await getUser();
    if(!found){user=null;return}
    user=found;
    updateAccountUi();
    const remote=await loadRemote();
    const localList=animeList();
    const cloudList=cleanList(safeParse(remote?.state?.[LIB]||'[]',[]));
    const localHas=localList.length>0;
    const cloudHas=cloudList.length>0;

    if(!remote){
      if(localHas)await saveLibraryRemote(true);
    }else if(!localHas&&cloudHas){
      localStorage.setItem(LIB,serializeList(cloudList));
      setLocalRevision(Number(remote.revision)||0,Date.parse(remote.saved_at||remote.updated_at)||now());
      window.dispatchEvent(new CustomEvent('animetracker:restored',{detail:{source:'cloud',count:cloudList.length}}));
    }else if(localHas&&!cloudHas){
      await saveLibraryRemote(true);
    }else if(localHas&&cloudHas){
      const merged=mergeLists(cloudList,localList);
      const before=serializeList(localList),after=serializeList(merged);
      if(before!==after){
        localStorage.setItem(LIB,after);
        window.dispatchEvent(new CustomEvent('animetracker:restored',{detail:{source:'merge',count:merged.length}}));
      }
      if(after!==serializeList(cloudList)||before!==after)await saveLibraryRemote(true);
    }

    await syncProfileFromAccount();
    lastSeen=JSON.stringify(animeList());
    lastProfileSeen=localStorage.getItem(PROFILE)||'';
    updateAccountUi();
  })();
  try{return await bootstrapPromise}finally{bootstrapPromise=null}
}

async function syncProfileFromAccount(){
  if(!user||profileSyncing)return;
  profileSyncing=true;
  try{
    const local=profileLocal();
    const cloud=await getCloudProfile();
    if(cloud){
      const cloudProfile=normalizeProfile({name:cloud.username||'Usuario',email:user.email||'',avatar:cloud.avatar_data||'',createdAt:Date.parse(cloud.created_at||'')||local.createdAt||Date.now()},user);
      applyProfileLocal(cloudProfile);
    }else{
      const seed=normalizeProfile({...local,email:user.email||local.email||'',name:local.name||user.user_metadata?.username||'Usuario'},user);
      applyProfileLocal(seed);
      await putCloudProfile(seed);
    }
  }catch(e){
    console.error('[AnimeTracker] profile sync',e);
    toast('No se pudo sincronizar el perfil. Tus datos locales siguen intactos.');
  }finally{profileSyncing=false}
}

async function syncProfileToAccount(){
  if(!user||profileSyncing)return;
  if(profileTimer)clearTimeout(profileTimer);
  profileTimer=setTimeout(async()=>{
    profileSyncing=true;
    try{await putCloudProfile(profileLocal());lastProfileSeen=localStorage.getItem(PROFILE)||'';updateAccountUi();}
    catch(e){console.warn('[AnimeTracker] profile save',e)}
    finally{profileSyncing=false}
  },500);
}

async function sync(){
  if(syncing){queued=true;return}
  syncing=true;
  try{await saveLibraryRemote(false)}
  catch(e){console.error('[AnimeTracker] cloud library save failed',e);toast('No se pudo guardar la biblioteca en la nube. La biblioteca local permanece intacta.')}
  finally{syncing=false;if(queued){queued=false;sync()}}
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
function observe(){
  lastSeen=JSON.stringify(animeList());
  lastProfileSeen=localStorage.getItem(PROFILE)||'';
  window.setInterval(()=>{
    const cur=JSON.stringify(animeList());
    if(cur!==lastSeen){lastSeen=cur;schedule()}
    const profileNow=localStorage.getItem(PROFILE)||'';
    if(profileNow!==lastProfileSeen){lastProfileSeen=profileNow;updateAccountUi();if(user)syncProfileToAccount();}
  },350);
  window.addEventListener('animetracker:saved',schedule);
  window.addEventListener('beforeunload',()=>{if(user&&hasAnime())sync()});
}

sb.auth.onAuthStateChange(async(event,session)=>{
  user=session?.user||null;
  updateAccountUi();
  if(event==='SIGNED_IN'&&user){try{await bootstrap();toast('✓ Sesión iniciada y perfil actualizado')}catch(e){console.error('[AnimeTracker] sign-in sync',e)}}
  if(event==='SIGNED_OUT'){user=null;updateAccountUi();}
});

async function boot(){
  ensureAccountUiStyle();
  bindAccountUi();
  updateAccountUi();
  try{await bootstrap();}catch(e){console.error('[AnimeTracker] persistence init',e)}
  updateAccountUi();
  observe();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AnimeTrackerCloud={sync:async()=>user?sync():openAccountUi(),refresh:updateAccountUi,open:openAccountUi};
})();