const {URL}=require('node:url');
const dns=require('node:dns').promises;
const net=require('node:net');


function isPrivateIPv4(address){
  const parts=String(address||'').split('.').map(Number);if(parts.length!==4||parts.some(n=>!Number.isInteger(n)||n<0||n>255))return true;
  const[a,b,c]=parts;
  return a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===0||b===168))||(a===192&&b===0&&c===2)||(a===192&&b===88&&c===99)||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113);
}
function isPrivateHostname(hostname){
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
async function assertSafeUrl(value){
  const u=new URL(value);
  if(!/^https?:$/.test(u.protocol)||u.username||u.password)throw new Error('Solo se permiten URLs HTTP o HTTPS sin credenciales.');
  const hostname=u.hostname.replace(/^\[|\]$/g,'');
  if(isPrivateHostname(hostname))throw new Error('No se puede acceder a una dirección privada.');
  if(net.isIP(hostname))return u;
  try{
    const records=await dns.lookup(hostname,{all:true,verbatim:true});
    if(!records.length||records.some(record=>isPrivateHostname(record.address)))throw new Error('La dirección apunta a una red privada.');
  }catch(error){
    if(/privad/i.test(String(error?.message||'')))throw error;
    throw new Error('No se pudo validar el destino externo.');
  }
  return u;
}
async function safeFetch(value,options={}){
  let current=await assertSafeUrl(value);
  for(let hop=0;hop<=5;hop++){
    const response=await fetch(current,{...options,redirect:'manual'});
    if(![301,302,303,307,308].includes(response.status))return{response,url:current};
    const location=response.headers.get('location');
    try{await response.body?.cancel()}catch(_){}
    if(!location)throw new Error('Redirección sin destino.');
    if(hop===5)throw new Error('Demasiadas redirecciones.');
    current=await assertSafeUrl(new URL(location,current).toString());
  }
  throw new Error('No se pudo validar la redirección.');
}
function attr(tag,name){const re=new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`,'i');return(tag.match(re)||[])[1]||''}
function decodeHtml(v){return String(v||'').replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&#x27;/gi,"'").replace(/&lt;/gi,'<').replace(/&gt;/gi,'>')}
function absolute(base,v){try{return new URL(decodeHtml(v),base).toString()}catch(_){return null}}
function strip(html){return String(html||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ')}
function normalizeText(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function slugify(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'')}
function wordsFor(q){return normalizeText(q).split(' ').filter(w=>w.length>=2)}
function titleMatches(text,q){const words=wordsFor(q);const n=normalizeText(text);return words.length===0||words.filter(w=>n.includes(w)).length>=Math.max(1,Math.ceil(words.length*.65))}
function hasNoResults(text){return /(no results|no result|nothing found|no matches|0 results|sin resultados|no se encontraron|no se ha encontrado|no hay resultados|no torrents found)/i.test(normalizeText(text))}
function extractLinks(html,base){
  const out=[];const re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;
  while((m=re.exec(html))){const href=absolute(base,m[1]);if(!href)continue;const text=normalizeText(m[2].replace(/<[^>]+>/g,' '));out.push({url:href,text,raw:m[2]});}
  return out;
}
async function fetchHtml(url){
  const{response:r,url:final}=await safeFetch(url,{headers:{'user-agent':'OneBase/2.1 staged anime search','accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(8000)});
  if(!r.ok)throw new Error(`HTTP ${r.status}`);
  const type=r.headers.get('content-type')||'';if(!type.includes('text/html'))throw new Error('La respuesta no es HTML.');
  const html=(await r.text()).slice(0,2200000);return{url:final,html};
}
function detectLanguageSupport(html){
  const h=String(html||'').toLowerCase();
  return /(name=["'](?:language|lang|subtitle|subtitles)["']|id=["'][^"']*(?:language|lang|subtitle)[^"']*["']|(?:language|idioma|subtitles|subtitulos)[^<]{0,80}<\/label>)/i.test(h);
}
function languageInUrl(url,language){
  if(!language)return url;
  const u=new URL(url);for(const k of ['language','lang','sub','subtitle','subtitles']){if(u.searchParams.has(k)){u.searchParams.set(k,language);return u.toString()}}return url;
}
function verifyTitle(html,q){const text=strip(html);return{found:!hasNoResults(text)&&titleMatches(text,q)}}
function verifyEpisode(html,q){const text=strip(html);const titleOk=titleMatches(text,q);return{found:!hasNoResults(text)&&titleOk,episodeFound:!hasNoResults(text)&&titleOk}}
function firstMatchingShowLink(html,base,q,host){
  const links=extractLinks(html,base);const qn=normalizeText(q);
  const candidates=links.filter(x=>{try{const u=new URL(x.url);return u.hostname.replace(/^www\./,'')===host&&/\/(?:[^/]+-s\d+|shows\/[^/]+)\/?$/i.test(u.pathname)}catch(_){return false}});
  candidates.sort((a,b)=>((normalizeText(a.text)===qn)?-1:0)-((normalizeText(b.text)===qn)?-1:0));
  return candidates.find(x=>titleMatches(x.text,q))||null;
}
function episodeTerm(episode){const raw=String(episode||'').trim(),season=raw.match(/^s(\d+)e(\d+)$/i);return season?`S${Number(season[1])}E${String(Number(season[2])).padStart(2,'0')}`:Number(raw)>0?`E${String(Number(raw)).padStart(2,'0')}`:''}
 function exactEpisodeLink(html,base,episode){
   if(!episode)return null;const links=extractLinks(html,base),season=String(episode).match(/^s(\d+)e(\d+)$/i);if(season){const token=episodeTerm(episode);return links.find(x=>new RegExp(token,'i').test(x.text)||new RegExp(token,'i').test(x.raw))||null}const n=String(Number(episode));
  return links.find(x=>new RegExp(`(?:episode|episodio|s\\d+e)\\s*0*${n}\\b|\\b0*${n}\\s*torrents?`,'i').test(x.text))||links.find(x=>new RegExp(`(?:episode|episodio)[^0-9]{0,12}0*${n}\\b`,'i').test(x.raw))||null;
}
async function searchSubsPlease(home,q,episode,language){
  const host='subsplease.org';let showUrl=new URL(`/shows/${slugify(q)}/`,home).toString();let page;
  try{page=await fetchHtml(showUrl)}catch(_){const shows=await fetchHtml(new URL('/shows/',home).toString());const link=firstMatchingShowLink(shows.html,shows.url,q,host);if(!link)throw new Error('Anime no encontrado en SubsPlease.');showUrl=link.url;page=await fetchHtml(showUrl)}
  if(!verifyTitle(page.html,q).found)throw new Error('Anime no encontrado en SubsPlease.');
  const supportsLanguage=detectLanguageSupport(page.html);const ep=exactEpisodeLink(page.html,page.url,episode);const target=ep?ep.url:languageInUrl(page.url,supportsLanguage?language:'');
  const suffix=episodeTerm(episode)?` ${episodeTerm(episode)}`:'';const multi=new URL('/search/',home);multi.searchParams.set('q',`${q}${suffix} MultiSub`);const titleOnly=new URL('/search/',home);titleOnly.searchParams.set('q',q);return{url:target,fallbackUrl:target,multiSubsUrl:multi.toString(),titleOnlyUrl:titleOnly.toString(),found:true,languageFound:false,episodeFound:true,episodeResolved:!!ep,mode:ep?'show-episode':'show-page-episode-unverified',languageApplied:!!(supportsLanguage&&language),verification:'checked'};
}
async function searchNyaa(home,q,episode){
  const titleUrl=new URL('/',home);titleUrl.searchParams.set('f','0');titleUrl.searchParams.set('c','0_0');titleUrl.searchParams.set('q',q);
  let titlePage;try{titlePage=await fetchHtml(titleUrl.toString())}catch(_){return{url:titleUrl.toString(),found:true,episodeFound:!episode,mode:'title-search-unverified',languageApplied:false,verification:'unavailable'}}
  if(!verifyTitle(titlePage.html,q).found)return{url:titleUrl.toString(),found:false,episodeFound:false,mode:'title-search',languageApplied:false,verification:'checked'};
  if(!episode)return{url:titlePage.url,found:true,episodeFound:true,mode:'title-search',languageApplied:false,verification:'checked'};
  const epUrl=new URL('/',home);epUrl.searchParams.set('f','0');epUrl.searchParams.set('c','0_0');epUrl.searchParams.set('q',`${q} ${episodeTerm(episode)}`);
  try{const epPage=await fetchHtml(epUrl.toString());const epCheck=verifyEpisode(epPage.html,q);return{url:epUrl.toString(),found:epCheck.found,episodeFound:epCheck.episodeFound,mode:'title-then-episode',languageApplied:false,verification:'checked'}}catch(_){return{url:epUrl.toString(),found:true,episodeFound:true,mode:'title-then-episode-unverified',languageApplied:false,verification:'unavailable'}}
}
async function searchExt(home,q,episode,language){
  const titleUrl=new URL('/browse/',home);titleUrl.searchParams.set('q',q);let results;
  try{results=await fetchHtml(titleUrl.toString())}catch(_){const epUrl=new URL('/browse/',home);epUrl.searchParams.set('q',episode?`${q} ${episodeTerm(episode)}`:q);return{url:epUrl.toString(),found:true,episodeFound:!episode,mode:'search-unverified',languageApplied:false,verification:'unavailable'}}
  if(!verifyTitle(results.html,q).found)return{url:titleUrl.toString(),found:false,episodeFound:false,mode:'title-search',languageApplied:false,verification:'checked'};
  const show=firstMatchingShowLink(results.html,results.url,q,'ext.to');
  if(!show){const epUrl=new URL('/browse/',home);epUrl.searchParams.set('q',episode?`${q} ${episodeTerm(episode)}`:q);return{url:epUrl.toString(),found:true,episodeFound:!episode,mode:'title-search',languageApplied:false,verification:'checked'}}
  let page;try{page=await fetchHtml(show.url)}catch(_){return{url:show.url,found:true,episodeFound:false,mode:'show-page-unverified',languageApplied:false,verification:'unavailable'}}
  const supportsLanguage=detectLanguageSupport(page.html);const ep=exactEpisodeLink(page.html,page.url,episode);const target=ep?ep.url:languageInUrl(page.url,supportsLanguage?language:'');
  return{url:target,found:true,episodeFound:true,episodeResolved:!!ep,mode:ep?'show-episode':'show-page-episode-unverified',languageApplied:!!(supportsLanguage&&language),verification:'checked'};
}
function scoreForm(form){const t=form.toLowerCase();let s=0;if(/(type=["']search["']|name=["'](?:q|query|search|keyword|title|anime)["'])/.test(t))s+=8;if(/(placeholder=["'][^"']*(?:buscar|search|anime)[^"']*["'])/.test(t))s+=6;if(/(buscar|search|busca)/.test(t))s+=3;if(/(login|signin|register|password|correo|email)/.test(t))s-=6;return s}
function findSearchForm(html,base){const forms=html.match(/<form\b[\s\S]*?<\/form>/gi)||[];let best=null;for(const form of forms){const score=scoreForm(form);if(score<=0)continue;const open=form.match(/^<form\b[^>]*>/i)?.[0]||'';const action=absolute(base,attr(open,'action')||base);if(!action)continue;const method=(attr(open,'method')||'get').toLowerCase();const inputs=form.match(/<input\b[^>]*>/gi)||[];let field=null;for(const input of inputs){const type=(attr(input,'type')||'text').toLowerCase(),name=attr(input,'name'),ph=attr(input,'placeholder');if(type==='search'||/^(q|query|search|keyword|title|anime)$/i.test(name)||/buscar|search|anime/i.test(ph)){field=name||'q';break}}if(!field)field='q';const c={score,action,method,field};if(!best||c.score>best.score)best=c}return best}
async function searchGeneric(home,q,episode){
  const suffix=episodeTerm(episode)?` ${episodeTerm(episode)}`:'',plain=`${q}${suffix}`,tagged=`${plain} ES`;
  const fallbackUrlFor=build=>build(plain),multiUrlFor=build=>build(`${plain} MultiSub`),titleOnlyUrlFor=build=>build(q);
  let base;try{base=await fetchHtml(home.toString())}catch(_){const build=term=>{const u=new URL('/search',home);u.searchParams.set('q',term);return u.toString()};const u=build(tagged);return{url:u,fallbackUrl:fallbackUrlFor(build),multiSubsUrl:multiUrlFor(build),titleOnlyUrl:titleOnlyUrlFor(build),found:true,languageFound:true,episodeFound:!episode,mode:'generic-unverified',languageApplied:false,verification:'unavailable'}}
  const form=findSearchForm(base.html,base.url);const build=term=>{if(!form||form.method==='post'){const u=new URL('/search',base.url);u.searchParams.set('q',term);return u.toString()}const u=new URL(form.action);u.searchParams.set(form.field,term);return u.toString()};
  const taggedUrl=build(tagged),fallbackUrl=fallbackUrlFor(build),multiSubsUrl=multiUrlFor(build),titleOnlyUrl=titleOnlyUrlFor(build);
  let result;try{result=await fetchHtml(taggedUrl)}catch(_){return{url:taggedUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,found:true,languageFound:true,episodeFound:!episode,mode:'generic-tagged-unverified',languageApplied:false,verification:'unavailable'}}
  const noResults=hasNoResults(strip(result.html));return{url:taggedUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,found:!noResults,languageFound:!noResults,episodeFound:!noResults,mode:'generic-spanish-first',languageApplied:false,verification:'checked'};
}
module.exports=async function handler(req,res){
  res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método no permitido.'});
  const raw=String(req.query?.url||'').trim(),q=String(req.query?.query||'').trim(),episode=String(req.query?.episode||'').trim(),language=String(req.query?.language||'').trim().slice(0,20);
  if(!raw||!q)return res.status(400).json({ok:false,error:'Faltan la URL de la web o el anime.'});if(q.length>200||episode.length>12||episode&&!/^(?:\d{1,4}|s\d{1,2}e\d{1,3})$/i.test(episode))return res.status(400).json({ok:false,error:'La búsqueda o el episodio no son válidos.'});
  let home;try{home=await assertSafeUrl(raw)}catch(e){return res.status(400).json({ok:false,error:e.message})}
  try{const host=home.hostname.replace(/^www\./,'').toLowerCase();let result;if(host==='subsplease.org')result=await searchSubsPlease(home,q,episode,language);else if(host==='nyaa.si')result=await searchNyaa(home,q,episode);else if(host==='ext.to')result=await searchExt(home,q,episode,language);else result=await searchGeneric(home,q,episode);return res.status(200).json({ok:true,...result,query:q,episode:episode||null,language:language||null})}catch(e){return res.status(200).json({ok:true,url:null,found:false,episodeFound:false,mode:'error',verification:'error',error:String(e.message||'No se ha podido completar la búsqueda.')})}
};