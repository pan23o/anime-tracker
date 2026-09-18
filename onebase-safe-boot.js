/* ONEBASE safe boot / recovery guard. */
(function(){'use strict';
const KEY='onebase-recovery-attempt',BACKUP='/backup/';
let startup=true,errorSeen=false,redirected=false;
function recover(reason){if(redirected||!startup)return;redirected=true;try{if(sessionStorage.getItem(KEY)==='1')return;sessionStorage.setItem(KEY,'1')}catch(_){}window.location.replace(BACKUP+'?recovery=1&reason='+encodeURIComponent(String(reason||'startup-error').slice(0,120)))}
function note(reason){errorSeen=true;console.error('[ONEBASE recovery guard]',reason||'startup-error')}
window.addEventListener('error',e=>{note(e?.message||'script-error')},true);
window.addEventListener('unhandledrejection',e=>{note(e?.reason?.message||e?.reason||'unhandled-promise')},true);
window.addEventListener('load',()=>{setTimeout(()=>{startup=false;const coreReady=window.__ONEBASE_CORE_READY__===true;if(errorSeen&&!coreReady)recover('core-startup-error');try{sessionStorage.removeItem(KEY)}catch(_){}},1200)},{once:true});
window.OneBaseRecovery={recover};
})();