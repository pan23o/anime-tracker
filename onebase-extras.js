/* ONEBASE extras v1
 * - Sonidos (Web Audio, sin archivos externos) con botón para silenciar.
 * - Botón de eliminar anime visible también en móvil/táctil.
 * - Elimina la función "Planificar temporada" de la interfaz.
 * - Arreglos del buscador de AniList: Escape global, bloqueo de scroll y portadas rotas.
 * Sin MutationObserver global: reintentos acotados + eventos existentes.
 */
(function(){'use strict';
const SOUND_KEY='onebase_sound_v1';
let soundOn=localStorage.getItem(SOUND_KEY)!=='off';
let ctx=null;
function ac(){if(!ctx){const C=window.AudioContext||window.webkitAudioContext;if(!C)return null;ctx=new C()}if(ctx.state==='suspended')ctx.resume().catch(()=>{});return ctx}
function tone(freq,dur,type,vol,delay){const a=ac();if(!a)return;const t=a.currentTime+(delay||0);const o=a.createOscillator(),g=a.createGain();o.type=type||'sine';o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(vol||0.05,t+0.012);g.gain.exponentialRampToValueAtTime(0.0001,t+dur);o.connect(g).connect(a.destination);o.start(t);o.stop(t+dur+0.02)}
const SOUNDS={
 click:()=>tone(880,0.05,'triangle',0.025),
 open:()=>{tone(520,0.09,'sine',0.035);tone(780,0.12,'sine',0.03,0.05)},
 close:()=>{tone(620,0.08,'sine',0.03);tone(420,0.1,'sine',0.025,0.04)},
 add:()=>{tone(660,0.12,'sine',0.05);tone(880,0.12,'sine',0.05,0.08);tone(1320,0.2,'sine',0.04,0.16)},
 remove:()=>{tone(330,0.14,'triangle',0.05);tone(220,0.2,'triangle',0.045,0.08)},
 success:()=>{tone(784,0.1,'sine',0.045);tone(1046,0.18,'sine',0.04,0.07)},
 error:()=>{tone(200,0.18,'square',0.025);tone(160,0.22,'square',0.02,0.1)}
};
function play(n){if(!soundOn)return;try{SOUNDS[n]?.()}catch(_){}}
window.OneBaseSound={play,isOn:()=>soundOn,set:v=>{soundOn=!!v;localStorage.setItem(SOUND_KEY,soundOn?'on':'off');updateToggle()}};

function updateToggle(){const b=document.getElementById('onebase-sound-toggle');if(b){b.textContent=soundOn?'🔊':'🔇';b.title=soundOn?'Silenciar sonidos':'Activar sonidos';b.setAttribute('aria-pressed',String(soundOn))}}
function injectToggle(){if(document.getElementById('onebase-sound-toggle'))return;const c=document.querySelector('.controls');if(!c)return;const b=document.createElement('button');b.type='button';b.id='onebase-sound-toggle';b.className='btn icon';b.addEventListener('click',e=>{e.stopPropagation();window.OneBaseSound.set(!soundOn);if(soundOn)play('success')});c.appendChild(b);updateToggle()}

// Sonidos por interacción
document.addEventListener('click',e=>{const b=e.target?.closest?.('button,a,.animeLink,.eye');if(!b||b.id==='onebase-sound-toggle')return;if(b.classList.contains('clearAnime')){const row=b.closest('.row');const name=row?.querySelector('.animeLink')?.textContent?.trim();if(name)setTimeout(()=>{const still=[...document.querySelectorAll('.animeLink')].some(l=>l.textContent.trim()===name);if(!still)play('remove')},60);return}if(b.matches('.close,.ob-al-close,[data-ob-back]')){play('close');return}if(b.matches('.infoBtn,.animeLink,#onebase-anilist-add-btn'))return play('open');if(b.disabled)return;play('click')},true);
window.addEventListener('onebase:anime-added',()=>play('add'));

// Toast de error/éxito -> sonido
function hookToast(){const t=window.toast;if(typeof t!=='function'||t.__obSound)return;const w=function(msg){try{const s=String(msg||'').toLowerCase();if(/no se ha podido|error|no se pudo|fall/.test(s))play('error')}catch(_){}return t.apply(this,arguments)};w.__obSound=true;window.toast=w}

// Quitar "Planificar temporada"
const PLAN_RE=/planificar\s+(la\s+)?temporada|planificador\s+de\s+temporada/i;
function removePlanner(){document.querySelectorAll('button,a,[role="tab"],[role="button"],li,h2,h3,section,.btn').forEach(el=>{const t=(el.textContent||'').trim();if(t.length>160||!PLAN_RE.test(t))return;const box=el.closest('section,.modal,.card,.panel,[data-section]');if(box&&box!==document.body&&(box.textContent||'').trim().length<4000&&el.matches('h2,h3,section'))box.remove();else el.remove()})}

// Estilos: borrar visible en táctil + foco accesible
function styles(){if(document.getElementById('onebase-extras-style'))return;const s=document.createElement('style');s.id='onebase-extras-style';s.textContent=`@media (hover:none),(max-width:760px){.clearAnime,.infoBtn{opacity:.75!important;visibility:visible!important;pointer-events:auto!important}.clearAnime[aria-hidden="true"]{opacity:0!important;pointer-events:none!important}.clearAnime,.infoBtn{flex-basis:28px!important;width:28px!important;height:28px!important;font-size:15px!important}}.clearAnime:hover{color:#ff6b6b!important;background:rgba(255,80,80,.12)!important}.clearAnime:focus-visible,.infoBtn:focus-visible{opacity:1!important;visibility:visible!important;pointer-events:auto!important;outline:2px solid #888}#onebase-sound-toggle{min-width:40px}`;document.head.appendChild(s)}

// Arreglos buscador AniList (externos al módulo)
let prevOverflow=null;
function alModal(){return document.getElementById('onebase-anilist-modal')}
function syncScrollLock(){const m=alModal();const open=!!m?.classList.contains('open');if(open&&prevOverflow===null){prevOverflow=document.documentElement.style.overflow;document.documentElement.style.overflow='hidden'}else if(!open&&prevOverflow!==null){document.documentElement.style.overflow=prevOverflow;prevOverflow=null}}
function watchModal(){const m=alModal();if(!m||m.__obWatched)return;m.__obWatched=true;new MutationObserver(syncScrollLock).observe(m,{attributes:true,attributeFilter:['class']})}
document.addEventListener('keydown',e=>{if(e.key!=='Escape')return;const m=alModal();if(m?.classList.contains('open')){window.OneBaseAniListSearch?.close?.();play('close')}});
document.addEventListener('error',e=>{const i=e.target;if(i?.tagName==='IMG'&&i.closest?.('#onebase-anilist-modal,.infoCard'))i.style.visibility='hidden'},true);

function pass(){styles();injectToggle();hookToast();removePlanner();watchModal()}
function boot(){pass();[300,1000,2500,5000].forEach(ms=>setTimeout(pass,ms));window.addEventListener('animetracker:restored',pass);const r=window.render;if(typeof r==='function'&&!r.__obExtras){const w=function(){const out=r.apply(this,arguments);try{removePlanner()}catch(_){}return out};w.__obExtras=true;window.render=w}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else setTimeout(boot,0);
})();
