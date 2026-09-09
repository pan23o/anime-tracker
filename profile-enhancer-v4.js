(()=>{'use strict';
const U='https://djfjqecahztogacliavh.supabase.co',K='sb_publishable_tm8Tid_HSYtu6cxXQ3ddKA_RWN15BSB';
const SK='anime_tracker_v6',PK='anime_tracker_profile_v1',ST='anime_tracker_settings_v1',LK='anime_tracker_last_save',BK='anime_tracker_resilient_backup_v1',MODE='anime_tracker_mode_v1';
const KEYS=[SK,PK,ST,'anime_tracker_activity','anime_tracker_v6_unlocked_achievements','anime_tracker_trash_v1','anime_tracker_backups_v1','anime_tracker_theme','anime_tracker_custom_theme',LK];
const sb=window.supabase?.createClient(U,K,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});if(!sb)return;
const $=id=>document.getElementById(id);const note=m=>window.toast?window.toast(m):console.info('[AnimeTracker]',m);
const json=(k,f=null)=>{try{const v=JSON.parse(localStorage.getItem(k)||'null');return v==null?f:v}catch{return f}};
const lib=()=>{const a=json(SK,[]);return Array.isArray(a)?a.filter(x=>(x?.anime||'').trim()):[]};
const parseLib=(snap)=>{try{const a=JSON.parse(snap?.[SK]||'[]');return Array.isArray(a)?a.filter(x=>(x?.anime||'').trim()):[]}catch{return[]}};
const norm=s=>String(s||'').trim().replace(/\s+/g,' ').toUpperCase();
function merge(local,remote){const map=new Map();for(const x of remote||[])map.set(norm(x.anime),x);for(const x of local||[])map.set(norm(x.anime),x);return [...map.values()];}
function snapshot(){const o={};for(const k of KEYS){const v=localStorage.getItem(k);if(v!==null)o[k]=v}return o}
function saveBackup(){const a=lib();if(!a.length)return;try{localStorage.setItem(BK,JSON.stringify({savedAt:Date.now(),state:snapshot()}))}catch(e){console.warn('backup',e)}}
function restoreBackup(){const b=json(BK,null),a=parseLib(b?.state);if(!a.length)return false;if(lib().length)return false;for(const [k,v] of Object.entries(b.state||{}))localStorage.setItem(k,v);return true}
function localStamp(){const x=localStorage.getItem(LK)||'',n=Number(x),t=Date.parse(x);return Number.isFinite(n)&&n>0?n:(Number.isFinite(t)?t:0)}
function writeStamp(){localStorage.setItem(LK,String(Date.now()))}
function setTop(){document.querySelectorAll('.cloud-account-btn').forEach(x=>x.style.display='none')}
async function remote(){const u=(await sb.auth.getUser()).data?.user;if(!u)return {user:null,row:null};const {data,error}=await sb.from('tracker_state').select('state,updated_at').eq('user_id',u.id).maybeSingle();if(error)throw error;return {user:u,row:data||null}}
async function push(u,state){const {error}=await sb.from('tracker_state').upsert({user_id:u.id,state,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;writeStamp()}
async function reconcile(){const r=await remote();if(!r.user)return;const local=lib();const backup=json(BK,null);const bLib=parseLib(backup?.state);let cloud=parseLib(r.row?.state);if(!local.length&&bLib.length){restoreBackup();note('☁️ Biblioteca local recuperada');return reconcile()}const merged=merge(lib(),cloud);if(!merged.length&&!bLib.length)return;if(bLib.length)for(const x of bLib){if(!merged.some(y=>norm(y.anime)===norm(x.anime)))merged.push(x)}
const current=lib();const changed=merged.length!==current.length || merged.some((x,i)=>norm(x.anime)!==norm(current[i]?.anime));
if(changed){localStorage.setItem(SK,JSON.stringify(merged));writeStamp();saveBackup();window.dispatchEvent(new CustomEvent('animetracker:restored'));setTimeout(()=>location.reload(),120);return}
const needsPush=!r.row || merged.length>cloud.length || localStamp()==0;if(needsPush)await push(r.user,snapshot());
saveBackup()}
function migrateBackupToAccount(u){try{const b=json(BK,null);if(b?.state&&u)localStorage.setItem(BK,JSON.stringify({...b,userId:u.id}))}catch{}}
async function boot(){setTop();let restored=false;for(let i=0;i<8;i++){if(!lib().length)restored=restoreBackup()||restored;if(lib().length)saveBackup();await new Promise(r=>setTimeout(r,80))}try{const r=await remote();if(r.user){migrateBackupToAccount(r.user);await reconcile()}else if(lib().length)saveBackup()}catch(e){console.warn('sync boot',e)} }
let timer=0;window.addEventListener('animetracker:saved',()=>{saveBackup();clearTimeout(timer);timer=setTimeout(()=>reconcile().catch(console.warn),900)});
window.addEventListener('beforeunload',saveBackup);
window.addEventListener('load',()=>boot().catch(console.warn));
sb.auth.onAuthStateChange((event,s)=>{if(event==='SIGNED_IN'&&s?.user){migrateBackupToAccount(s.user);setTimeout(()=>reconcile().catch(console.warn),150)}if(event==='SIGNED_OUT')setTop()});
window.AnimeTrackerCloud={...(window.AnimeTrackerCloud||{}),sync:()=>reconcile()};
})();
