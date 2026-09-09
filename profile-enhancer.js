/* AnimeTracker persistence engine v2 - local-first + durable cloud snapshots */
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
const sb=window.supabase?.createClient?.(SUPABASE_URL,SUPABASE_KEY);
if(!sb){console.error('[AnimeTracker] Supabase client unavailable');return}

const safeParse=(s,f)=>{try{return JSON.parse(s)}catch{return f}};
const now=()=>Date.now();
const uuid=()=>crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
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
let user=null, timer=null, syncing=false, queued=false, lastSeen='';

async function getUser(){const {data:{user:u},error}=await sb.auth.getUser();if(error)return null;return u||null}
async function loadRemote(){if(!user)return null;const {data,error}=await sb.from('tracker_state').select('state,revision,checksum,device_id,saved_at,updated_at').eq('user_id',user.id).maybeSingle();if(error)throw error;return data||null}
async function saveRemote(force=false){
 if(!user)return false;
 const st=state();
 if(!hasAnime()&&!force)return true;
 const nextRevision=st.revision+1;
 const savedAt=now();
 const {error}=await sb.from('tracker_state').upsert({
   user_id:user.id,state:st.snapshot,revision:nextRevision,checksum:st.checksum,device_id:st.deviceId,saved_at:new Date(savedAt).toISOString(),updated_at:new Date(savedAt).toISOString()
 },{onConflict:'user_id'});
 if(error)throw error;
 setLocalRevision(nextRevision,savedAt);
 return true;
}
async function bootstrap(){
 user=await getUser();
 if(!user)return;
 const remote=await loadRemote();
 const local=state();
 if(!remote){
   if(Object.keys(local.snapshot).length) await saveRemote(true);
   return;
 }
 const cloudSnap=remote.state&&typeof remote.state==='object'?remote.state:{};
 const cloudHas=Array.isArray(safeParse(cloudSnap[LIB]||'[]',[]))&&safeParse(cloudSnap[LIB]||'[]',[]).some(x=>String(x?.anime||'').trim());
 const localHas=hasAnime();
 if(!localHas&&cloudHas){
   restore(cloudSnap);
   setLocalRevision(Number(remote.revision)||0,Date.parse(remote.saved_at||remote.updated_at)||now());
   lastSeen=JSON.stringify(animeList());
   window.dispatchEvent(new CustomEvent('animetracker:restored'));
   return;
 }
 if(localHas&&!cloudHas){await saveRemote(true);return}
 if(localHas&&cloudHas){
   const merged=mergeSnapshots(local.snapshot,cloudSnap);
   restore(merged);
   lastSeen=JSON.stringify(animeList());
   const localChanged=JSON.stringify(merged)!==JSON.stringify(cloudSnap);
   if(localChanged)await saveRemote(true);
 }
}
async function sync(){
 if(syncing){queued=true;return}
 syncing=true;
 try{await saveRemote(false)}
 catch(e){console.error('[AnimeTracker] cloud save failed',e)}
 finally{syncing=false;if(queued){queued=false;sync()}}
}
function schedule(){clearTimeout(timer);timer=setTimeout(sync,700)}
function observe(){
 lastSeen=JSON.stringify(animeList());
 window.setInterval(()=>{
   const cur=JSON.stringify(animeList());
   if(cur!==lastSeen){lastSeen=cur;schedule()}
 },350);
 window.addEventListener('animetracker:saved',schedule);
 window.addEventListener('beforeunload',()=>{if(user&&hasAnime())sync()});
}
async function saveProfile(){
 if(!user)return;
 const p=safeParse(localStorage.getItem(PROFILE)||'{}',{});
 const {error}=await sb.from('profiles').upsert({id:user.id,username:String(p.name||'Usuario').slice(0,32),avatar_data:String(p.avatar||''),updated_at:new Date().toISOString()},{onConflict:'id'});
 if(error)console.warn('[AnimeTracker] profile save',error);
}
sb.auth.onAuthStateChange(async(_event,session)=>{
 user=session?.user||null;
 if(user){try{await bootstrap();await saveProfile()}catch(e){console.error('[AnimeTracker] bootstrap',e)}}
});
(async()=>{try{await bootstrap();observe()}catch(e){console.error('[AnimeTracker] persistence init',e)}})();
})();