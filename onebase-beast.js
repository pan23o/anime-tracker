/* ONEBASE BEAST PREVIEW controller — UI polish only */
(function(){
'use strict';
const q=(s,r=document)=>r.querySelector(s);
function badge(){
 const controls=q('.controls'); if(!controls||q('#onebaseBeastStatus'))return;
 const b=document.createElement('div');b.id='onebaseBeastStatus';b.className='btn';b.innerHTML='<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ffd21a;box-shadow:0 0 10px #ffd21a;margin-right:7px"></span>BEAST MODE';
 b.title='ONEBASE Beast Preview';
 controls.prepend(b);
}
function enhance(){
 badge();
 document.querySelectorAll('.stat').forEach((el,i)=>el.style.setProperty('--beast-i',i));
 document.querySelectorAll('#rows .row:not(.head)').forEach((el,i)=>el.style.setProperty('--onebase-row-i',Math.min(i,18)));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance,{once:true});else enhance();
window.addEventListener('animetracker:restored',enhance);
window.addEventListener('onebase:telemetry',e=>{if(e.detail?.event_name==='app_loaded')document.documentElement.dataset.onebaseReady='1'});
})();
