const {URL}=require('node:url');
const dns=require('node:dns').promises;
const net=require('node:net');

function isPrivateIPv4(address){
  const parts=String(address||'').split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
  const[a,b,c]=parts;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===192&&b===0&&c===2)||(a===192&&b===88&&c===99)||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113);
}
function privateHost(hostname){
  const h=String(hostname||'').toLowerCase().replace(/^\[|\]$/g,'').split('%')[0];
  if(h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local'))return true;
  const ip=net.isIP(h);
  if(ip===4)return isPrivateIPv4(h);
  if(ip===6){
    if(h==='::'||h==='::1'||h.startsWith('::ffff:')||h.startsWith('::ffff:0:'))return true;
    if(h.startsWith('fc')||h.startsWith('fd')||/^fe[89ab]/.test(h)||h.startsWith('ff'))return true;
    if(!/^[23]/.test(h)||h.startsWith('2001:db8:')||h.startsWith('2001:10:')||h.startsWith('2001:20:')||h.startsWith('2001:0:')||h.startsWith('2002:'))return true;
    return false;
  }
  return false;
}
async function safe(value){
  const u=new URL(value);
  if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new Error('Solo se permiten URLs HTTP o HTTPS sin credenciales.');
  const hostname=u.hostname.replace(/^\[|\]$/g,'');
  if(privateHost(hostname))throw new Error('No se puede acceder a una dirección privada.');
  if(net.isIP(hostname))return u;
  try{
    const records=await dns.lookup(hostname,{all:true,verbatim:true});
    if(!records.length||records.some(record=>privateHost(record.address)))throw new Error('La dirección apunta a una red privada.');
  }catch(error){
    if(/privad/i.test(String(error?.message||'')))throw error;
    throw new Error('No se pudo validar el destino externo.');
  }
  return u;
}
async function fetchSafe(value,options={}){
  let current=await safe(value);
  for(let hop=0;hop<=5;hop++){
    const response=await fetch(current,{...options,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))return{response,url:current};
    const location=response.headers.get('location');
    try{await response.body?.cancel()}catch(_){}
    if(!location)throw new Error('Redirección sin destino.');
    if(hop===5)throw new Error('Demasiadas redirecciones.');
    current=await safe(new URL(location,current).toString());
  }
  throw new Error('No se pudo validar la redirección.');
}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function words(q){return norm(q).split(' ').filter(x=>x.length>=2)}
function titleOk(text,q){const w=words(q),n=norm(text);return w.length===0||w.filter(x=>n.includes(x)).length>=Math.max(1,Math.ceil(w.length*.55))}
function spanish(text){return /(?:spanish|español|espanol|sub\s*esp|subtitulos?\s*esp|\bspa\b|\besp\b|\[spa(?:-[a-z]+)?\]|\[esp(?:-[a-z]+)?\])/i.test(String(text||''))}
function multiSubs(text){return /(?:multi[\s-]*subs?|multi[\s-]*subtitles?|multi[\s-]*sub\b)/i.test(String(text||''))}
function stripHtml(s){return norm(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '))}
function links(html,base){const out=[],re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1].replace(/&amp;/g,'&'),base);const text=stripHtml(m[2]);const start=Math.max(0,m.index-1800),end=Math.min(html.length,m.index+m[0].length+2600);out.push({url:u.toString(),text,context:stripHtml(html.slice(start,end))})}catch(_){}}return out}
async function page(url){const{response:r,url:final}=await fetchSafe(url,{headers:{'user-agent':'OneBase/SpanishSearch/2.0','accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const type=r.headers.get('content-type')||'';if(!type.includes('text/html'))throw new Error('No HTML');return{url:final,html:(await r.text()).slice(0,2200000)}}
function episodeLabel(value){const raw=String(value||'').trim(),season=raw.match(/^s(\d+)e(\d+)$/i);if(season)return`s${Number(season[1])}e${String(Number(season[2])).padStart(2,'0')}`;return Number(raw)>0?`E${Number(raw)}`:''}
function candidates(q,episode){const ep=episodeLabel(episode)?` ${episodeLabel(episode)}`:'';return[{term:`${q}${ep} Spanish`,kind:'spanish'},{term:`${q}${ep} Español`,kind:'spanish'},{term:`${q}${ep} [SPA]`,kind:'spanish'},{term:`${q}${ep} [ESP]`,kind:'spanish'},{term:`${q}${ep} Multi-Subs`,kind:'multi-subs'},{term:`${q}${ep} MultiSubs`,kind:'multi-subs'}]}
function nyaaUrl(home,q){const u=new URL('/',home);u.searchParams.set('f','0');u.searchParams.set('c','0_0');u.searchParams.set('q',q);return u.toString()}
function extUrl(home,q){const u=new URL('/browse/',home);u.searchParams.set('q',q);return u.toString()}
function findResult(html,base,q,kind){const marker=kind==='spanish'?spanish:multiSubs;return links(html,base).find(x=>titleOk(x.context,q)&&marker(x.context))||null}
async function searchSite(host,home,q,episode){
  // Nyaa has a stable public query URL. Do not try to infer Spanish/Multi-Subs
  // from the rendered HTML: that made valid searches look like failures when
  // Nyaa changed its markup. We hand the user the real Nyaa result page.
  if(host==='nyaa.si'){
    const ep=episodeLabel(episode)?` ${episodeLabel(episode)}`:'';
    const target=nyaaUrl(home,`${q}${ep}`);
    return{url:target,languageFound:true,multiSubsFound:false,languageQuery:q,verification:'search-url'};
  }
  for(const candidate of candidates(q,episode)){
    try{const u=extUrl(home,candidate.term),p=await page(u),hit=findResult(p.html,p.url,q,candidate.kind);if(hit)return{url:p.url,languageFound:candidate.kind==='spanish',multiSubsFound:candidate.kind==='multi-subs',languageQuery:candidate.term,verification:'checked'}}catch(_){}
  }
  const ep=episodeLabel(episode)?` ${episodeLabel(episode)}`:'';return{url:extUrl(home,`${q}${ep}`),languageFound:false,multiSubsFound:false,languageQuery:null,verification:'checked'}
}
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método no permitido.'});const raw=String(req.query?.url||'').trim(),q=String(req.query?.query||'').trim(),episode=String(req.query?.episode||'').trim();if(!raw||!q)return res.status(400).json({ok:false,error:'Faltan la URL o el anime.'});if(q.length>200||episode.length>12||episode&&!/^(?:\d{1,4}|s\d{1,2}e\d{1,3})$/i.test(episode))return res.status(400).json({ok:false,error:'La búsqueda o el episodio no son válidos.'});try{const home=await safe(raw),host=home.hostname.replace(/^www\./,'').toLowerCase();if(host!=='nyaa.si'&&host!=='ext.to')return res.status(400).json({ok:false,error:'Esta búsqueda solo admite Nyaa y EXT.to.'});const r=await searchSite(host,home,q,episode);return res.status(200).json({ok:true,url:r.url,fallbackUrl:host==='nyaa.si'?nyaaUrl(home,`${q}${episodeLabel(episode)?` ${episodeLabel(episode)}`:''}`):extUrl(home,`${q}${episodeLabel(episode)?` ${episodeLabel(episode)}`:''}`),found:true,languageFound:r.languageFound,multiSubsFound:r.multiSubsFound,languageQuery:r.languageQuery,verification:r.verification,query:q,episode:episode||null,language:'spanish'})}catch(e){return res.status(200).json({ok:true,url:null,fallbackUrl:null,found:false,languageFound:false,multiSubsFound:false,verification:'error',error:String(e.message||'No se ha podido completar la búsqueda.')})}};
