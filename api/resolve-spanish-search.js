const {URL}=require('node:url');
const {safeFetch:fetchSafe,resolveTarget}=require('../lib/safe-fetch.cjs');
async function safe(value){return (await resolveTarget(value)).url}
function norm(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9\s]/g,' ').replace(/\s+/g,' ').trim()}
function words(q){return norm(q).split(' ').filter(x=>x.length>=2)}
function titleOk(text,q){const w=words(q),n=norm(text);return w.length===0||w.filter(x=>n.includes(x)).length>=Math.max(1,Math.ceil(w.length*.55))}
function spanish(text){return /(?:spanish|español|espanol|sub\s*esp|subtitulos?\s*esp|\bspa\b|\besp\b|\[spa(?:-[a-z]+)?\]|\[esp(?:-[a-z]+)?\])/i.test(String(text||''))}
function multiSubs(text){return /(?:multi[\s-]*subs?|multi[\s-]*subtitles?|multi[\s-]*sub\b)/i.test(String(text||''))}
function stripHtml(s){return norm(String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' '))}
function links(html,base){const out=[],re=/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;let m;while((m=re.exec(html))){try{const u=new URL(m[1].replace(/&amp;/g,'&'),base);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;const text=stripHtml(m[2]);const start=Math.max(0,m.index-1800),end=Math.min(html.length,m.index+m[0].length+2600);out.push({url:u.toString(),text,context:stripHtml(html.slice(start,end))})}catch(_){}}return out}
async function page(url){const{response:r,url:final}=await fetchSafe(url,{headers:{'user-agent':'OneBase/SpanishSearch/2.0','accept':'text/html,application/xhtml+xml'},signal:AbortSignal.timeout(8000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);const type=r.headers.get('content-type')||'';if(!type.includes('text/html'))throw new Error('No HTML');return{url:final,html:(await r.text()).slice(0,2200000)}}
function episodeLabel(value){const raw=String(value||'').trim(),season=raw.match(/^s(\d+)e(\d+)$/i);if(season)return`S${Number(season[1])}E${String(Number(season[2])).padStart(2,'0')}`;return Number(raw)>0?`E${String(Number(raw)).padStart(2,'0')}`:''}
function candidates(q,episode){const ep=episodeLabel(episode)?` ${episodeLabel(episode)}`:'';return[{term:`${q}${ep} ES`,kind:'spanish'},{term:`${q}${ep} Spanish`,kind:'spanish'},{term:`${q}${ep} Español`,kind:'spanish'},{term:`${q}${ep} [SPA]`,kind:'spanish'},{term:`${q}${ep} [ESP]`,kind:'spanish'},{term:`${q}${ep} MultiSub`,kind:'multi-subs'},{term:`${q}${ep} Multi-Subs`,kind:'multi-subs'},{term:`${q}${ep} MultiSubs`,kind:'multi-subs'}]}
function nyaaUrl(home,q){const u=new URL('/',home);u.searchParams.set('f','0');u.searchParams.set('c','0_0');u.searchParams.set('q',q);return u.toString()}
function extUrl(home,q){const u=new URL('/browse/',home);u.searchParams.set('q',q);return u.toString()}
function findResult(html,base,q,kind){return links(html,base).find(x=>titleOk(x.context,q)&&(kind!=='multi-subs'||multiSubs(x.context)))||null}
function hasNoResults(html){return /(no results|no result|nothing found|no matches|0 results|sin resultados|no se encontraron|no se ha encontrado|no hay resultados|no torrents found)/i.test(stripHtml(html))}
async function searchSite(host,home,q,episode){
  const ep=episodeLabel(episode)?` ${episodeLabel(episode)}`:'',plain=`${q}${ep}`,fallbackUrl=host==='nyaa.si'?nyaaUrl(home,plain):extUrl(home,plain),multiSubsUrl=host==='nyaa.si'?nyaaUrl(home,`${plain} MultiSub`):extUrl(home,`${plain} MultiSub`),titleOnlyUrl=host==='nyaa.si'?nyaaUrl(home,q):extUrl(home,q);
  if(host==='nyaa.si'){
    const spanishUrl=nyaaUrl(home,`${plain} ES`);
    try{const result=await page(spanishUrl);if(hasNoResults(result.html))return{url:spanishUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,languageFound:false,multiSubsFound:false,languageQuery:null,verification:'checked'};return{url:spanishUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,languageFound:true,multiSubsFound:false,languageQuery:`${plain} ES`,verification:'checked'}}
    catch(_){return{url:spanishUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,languageFound:false,multiSubsFound:false,languageQuery:`${plain} ES`,verification:'unavailable'}}
  }
  const spanishUrl=extUrl(home,`${plain} ES`);
  try{
    const result=await page(spanishUrl);
    if(hasNoResults(result.html))return{url:spanishUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,languageFound:false,multiSubsFound:false,languageQuery:null,verification:'checked'};
    return{url:spanishUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,languageFound:true,multiSubsFound:false,languageQuery:`${plain} ES`,verification:'checked'};
  }catch(_){return{url:spanishUrl,fallbackUrl,multiSubsUrl,titleOnlyUrl,languageFound:false,multiSubsFound:false,languageQuery:`${plain} ES`,verification:'unavailable'}}

}
module.exports=async function(req,res){res.setHeader('Cache-Control','no-store');if(req.method!=='GET')return res.status(405).json({ok:false,error:'Método no permitido.'});const raw=String(req.query?.url||'').trim(),q=String(req.query?.query||'').trim(),episode=String(req.query?.episode||'').trim();if(!raw||!q)return res.status(400).json({ok:false,error:'Faltan la URL o el anime.'});if(q.length>200||episode.length>12||episode&&!/^(?:\d{1,4}|s\d{1,2}e\d{1,3})$/i.test(episode))return res.status(400).json({ok:false,error:'La búsqueda o el episodio no son válidos.'});try{const home=await safe(raw),host=home.hostname.replace(/^www\./,'').toLowerCase();if(host!=='nyaa.si'&&host!=='ext.to')return res.status(400).json({ok:false,error:'Esta búsqueda solo admite Nyaa y EXT.to.'});const r=await searchSite(host,home,q,episode);return res.status(200).json({ok:true,url:r.url,fallbackUrl:r.fallbackUrl||null,multiSubsUrl:r.multiSubsUrl||null,titleOnlyUrl:r.titleOnlyUrl||null,found:true,languageFound:r.languageFound,multiSubsFound:r.multiSubsFound,languageQuery:r.languageQuery,verification:r.verification,query:q,episode:episode||null,language:'ES'})}catch(e){return res.status(200).json({ok:true,url:null,fallbackUrl:null,found:false,languageFound:false,multiSubsFound:false,verification:'error',error:String(e.message||'No se ha podido completar la búsqueda.')})}};
