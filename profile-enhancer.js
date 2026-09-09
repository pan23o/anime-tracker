/* AnimeTracker persistence engine v3 - block 1: reliable account/session UI + local-first cloud state */
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
function restore(s){if(!s||typeof s!=='object')return false;for(const k of ALL){if(typeof s[k]==='string')localStorage.setItem(k,s[k])}return true}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(16)}
function state(){const m=ensureMeta(),snap=snapshot(),json=JSON.stringify(snap);return {snapshot:snap,checksum:hash(json),revision:m.revision||0,savedAt:m.savedAt||0,deviceId:m.deviceId}}
function setLocalRevision(revision,savedAt){const m=ensureMeta();m.revision=revision;m.savedAt=savedAt;setMeta(m)}
function key(x){return String(x?.anime||'').trim().toLocaleLowerCase('es-ES')}
function itemTime(x){return Number(x?.updatedAt||x?.addedAt||0)}
function mergeLists(a,b){const m=new Map();for(const x of [...a,...b]){const k=key(x);if(!k)continue;const old=m.get(k);if(!old||itemTime(x)>=itemTime(old))m.set(k,x)}return [...m.values()]}
function mergeSnapshots(local,cloud){const out={...cloud,...local};const la=safeParse(local[LIB]||'[]',[]),ca=safeParse(cloud[LIB]||'[]',[]);out[LIB]=JSON.stringify(mergeLists(Array.isArray(ca)?ca:[],Array.isArray(la)?la:[]));return out}

let user=null,timer=null,syncing=false,queued=false,lastSeen='';
let accountUiBound=false;

function accountInitials(name){return String(name||'Usuario').trim().split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()||'AT'}
function profileLocal(){return safeParse(localStorage.getItem(PROFILE)||'{}',{})||{}}
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
  .at-account-btn-text{display:flex;align-items:center;justify-content:space-between;gap:8px}
  .at-account-chip{display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:999px;border:1px solid rgba(103,223,138,.25);color:#67df8a;font-size:9px;font-weight:900}
  .at-account-chip.local{border-color:rgba(180,180,180,.18);color:#999}
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
      const state=document.createElement('div');state.className='at-account-state';state.textContent='● SESIÓN INICIADA';
      const name=document.createElement('div');name.className='at-account-name';name.textContent=p.name||'Cuenta';
      const email=document.createElement('div');email.className='at-account-email';email.textContent=user.email||p.email||'';
      head.append(state,name,email);
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
function openAccountUi(){
  if(user){$('cloudUserMenu')?.classList.toggle('show');return}
  $('cloudAuthOverlay')?.classList.add('show');
}
function bindAccountUi(){
  if(accountUiBound)return;accountUiBound=true;ensureAccountUiStyle();
  const btn=$('cloudAccountBtn'),close=$('cloudClose'),overlay=$('cloudAuthOverlay');
  if(btn)btn.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();openAccountUi()});
  if(close)close.addEventListener('click',()=>overlay?.classList.remove('show'));
  if(overlay)overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.classList.remove('show')});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){overlay?.classList.remove('show');$('cloudUserMenu')?.classList.remove('show')}},{passive:true});
}

async function getUser(){try{const{data,error}=await sb.auth.getUser();if(error)return null;return data?.user||null}catch{return null}}
async function loadRemote(){if(!user)return null;const{data,error}=await sb.from('tracker_state').select('state,revision,checksum,device_id,saved_at,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data||null}
async function saveRemote(force=false){
  if(!user)return false;
  const st=state();if(!hasAnime()&&!force)return true;
  const nextRevision=st.revision+1,savedAt=now();
  const{error}=await sb.from('tracker_state').upsert({user_id:user.id,state:st.snapshot,revision:nextRevision,checksum:st.checksum,device_id:st.deviceId,saved_at:new Date(savedAt).toISOString(),updated_at:new Date(savedAt).toISOString()},{onConflict:'user_id'});
  if(error)throw error;setLocalRevision(nextRevision,savedAt);return true;
}
async function bootstrap(){
  const found=await getUser();if(found)user=found;else return;
  updateAccountUi();
  const remote=await loadRemote(),local=state();
  if(!remote){if(Object.keys(local.snapshot).length)await saveRemote(true);return}
  const cloudSnap=remote.state&&typeof remote.state==='object'?remote.state:{};
  const cloudHas=Array.isArray(safeParse(cloudSnap[LIB]||'[]',[]))&&safeParse(cloudSnap[LIB]||'[]',[]).some(x=>String(x?.anime||'').trim());
  const localHas=hasAnime();
  if(!localHas&&cloudHas){restore(cloudSnap);setLocalRevision(Number(remote.revision)||0,Date.parse(remote.saved_at||remote.updated_at)||now());lastSeen=JSON.stringify(animeList());window.dispatchEvent(new CustomEvent('animetracker:restored'));return}
  if(localHas&&!cloudHas){await saveRemote(true);return}
  if(localHas&&cloudHas){const merged=mergeSnapshots(local.snapshot,cloudSnap);restore(merged);lastSeen=JSON.stringify(animeList());if(JSON.stringify(merged)!==JSON.stringify(cloudSnap))await saveRemote(true)}
  updateAccountUi();
}
async function sync(){if(syncing){queued=true;return}syncing=true;try{await saveRemote(false)}catch(e){console.error('[AnimeTracker] cloud save failed',e);toast('No se pudo guardar en la nube. La biblioteca local permanece intacta.')}finally{syncing=false;if(queued){queued=false;sync()}}}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
function observe(){lastSeen=JSON.stringify(animeList());window.setInterval(()=>{const cur=JSON.stringify(animeList());if(cur!==lastSeen){lastSeen=cur;schedule()}},350);window.addEventListener('animetracker:saved',schedule);window.addEventListener('beforeunload',()=>{if(user&&hasAnime())sync()})}

async function saveProfile(){if(!user)return;const p=safeParse(localStorage.getItem(PROFILE)||'{}',{});const{error}=await sb.from('profiles').upsert({id:user.id,username:String(p.name||'Usuario').slice(0,32),avatar_data:String(p.avatar||''),updated_at:new Date().toISOString()},{onConflict:'id'});if(error)console.warn('[AnimeTracker] profile save',error)}

sb.auth.onAuthStateChange(async(event,session)=>{
  user=session?.user||null;updateAccountUi();
  if(event==='SIGNED_IN'&&user){try{await bootstrap();await saveProfile();updateAccountUi();toast('✓ Sesión iniciada')}catch(e){console.error('[AnimeTracker] sign-in sync',e);updateAccountUi()}}
  if(event==='SIGNED_OUT'){user=null;updateAccountUi();}
});

async function boot(){
  ensureAccountUiStyle();bindAccountUi();updateAccountUi();
  try{await bootstrap();}catch(e){console.error('[AnimeTracker] persistence init',e)}
  updateAccountUi();observe();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
window.AnimeTrackerCloud={sync:async()=>user?sync():openAccountUi(),refresh:updateAccountUi,open:openAccountUi};
})();