const ANILIST_URL='https://graphql.anilist.co';
const KITSU_URL='https://kitsu.io/api/edge/anime';
const KITSU_TTL=15*60*1000;
const kitsuCache=new Map();
async function requestKitsu(page){
 const cached=kitsuCache.get(page);if(cached&&cached.expiresAt>Date.now())return cached.results;
 const controller=typeof AbortController!=='undefined'?new AbortController():null,timer=controller?setTimeout(()=>controller.abort(),6000):null;
 try{
  const url=new URL(KITSU_URL);url.searchParams.set('sort','-userCount');url.searchParams.set('page[limit]','20');url.searchParams.set('page[offset]',String((page-1)*20));url.searchParams.set('include','categories');
  const response=await fetch(url,{headers:{Accept:'application/vnd.api+json, application/json'},signal:controller?.signal});
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!Array.isArray(payload?.data))throw new Error('Kitsu no pudo cargar recomendaciones.');
  const included=new Map((Array.isArray(payload.included)?payload.included:[]).filter(x=>x?.type==='categories').map(x=>[String(x.id),String(x.attributes?.title||'').trim()]));
  const results=payload.data.map(item=>{
   const id=Number(item?.id),a=item?.attributes||{};if(!Number.isSafeInteger(id)||id<1||String(a.ageRating||'').toUpperCase()==='R18')return null;
   const cover=a.posterImage?.large||a.posterImage?.original||a.posterImage?.small||'';
   const title=String(a.titles?.en||a.canonicalTitle||a.titles?.en_jp||a.titles?.ja_jp||'Anime recomendado');
   const genres=(item?.relationships?.categories?.data||[]).map(x=>included.get(String(x.id))).filter(Boolean);
   const score=Math.round(Number(a.averageRating)||0),slug=String(a.slug||'').replace(/[^a-zA-Z0-9-]/g,'');
   return {id:-id,provider:'kitsu',externalId:id,title:{userPreferred:title,english:a.titles?.en||'',romaji:a.titles?.en_jp||a.canonicalTitle||title},description:String(a.synopsis||''),genres,tags:[],status:String(a.status||''),episodes:Number(a.episodeCount)||0,duration:Number(a.episodeLength)||0,averageScore:score,popularity:Number(a.userCount)||0,coverImage:{extraLarge:cover,large:cover,medium:cover},bannerImage:'',siteUrl:slug?'https://kitsu.app/anime/'+encodeURIComponent(slug):'https://kitsu.app/anime'};
  }).filter(Boolean);
  if(!results.length)throw new Error('Kitsu no encontró recomendaciones disponibles.');
  kitsuCache.set(page,{expiresAt:Date.now()+KITSU_TTL,results});return results;
 }catch(error){if(error?.name==='AbortError')throw new Error('El catálogo alternativo tardó demasiado en responder.');throw error}
 finally{if(timer)clearTimeout(timer)}
}

const QUERY=`
  query ($page:Int!, $perPage:Int!, $genres:[String!], $excludeIds:[Int!], $sort:[MediaSort!]) {
    Page(page:$page, perPage:$perPage) {
      media(type:ANIME,isAdult:false,genre_in:$genres,id_not_in:$excludeIds,sort:$sort) {
        id
        title { romaji english native userPreferred }
        description(asHtml:false)
        genres
        tags { name rank isMediaSpoiler }
        format
        status
        episodes
        duration
        averageScore
        popularity
        favourites
        coverImage { extraLarge large medium color }
        bannerImage
        siteUrl
      }
    }
  }
`;

function json(res,status,body){return res.status(status).setHeader('Cache-Control','no-store').json(body);}

module.exports=async function handler(req,res){
  if(req.method!=='POST'){res.setHeader('Allow','POST');return json(res,405,{ok:false,error:'Method not allowed'});}
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const mode=['personalized','random','opposite'].includes(body.mode)?body.mode:'personalized';
  const genres=Array.isArray(body.genres)?body.genres.map(String).map(s=>s.trim()).filter(Boolean).slice(0,8):[];
  const targetGenres=Array.isArray(body.targetGenres)?body.targetGenres.map(String).map(s=>s.trim()).filter(Boolean).slice(0,6):[];
  const excludeIds=[...new Set(Array.isArray(body.excludeIds)?body.excludeIds.map(Number).filter(Number.isInteger).filter(x=>x>0).slice(0,10000):[])];
  const page=Math.min(8,Math.max(1,Number.parseInt(body.page,10)||1));

  async function request(variables){
    const controller=typeof AbortController!=='undefined'?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),3000):null;
    try{
      const upstream=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:QUERY,variables}),signal:controller?.signal});
      const retryAfter=upstream.headers.get('retry-after');
      const payload=await upstream.json().catch(()=>null);
      if(!upstream.ok)throw Object.assign(new Error(upstream.status===429?'AniList está temporalmente saturado. Espera unos segundos y reintenta.':'AniList no está disponible en este momento.'),{status:upstream.status,retryAfter});
      if(payload?.errors?.length){const first=payload.errors[0];throw Object.assign(new Error(String(first?.message||'AniList devolvió un error.')),{status:Number(first?.status)||400});}
      return Array.isArray(payload?.data?.Page?.media)?payload.data.Page.media:[];
    }catch(error){
      if(error?.name==='AbortError')throw Object.assign(new Error('AniList tardó demasiado en responder.'),{status:504});
      throw error;
    }finally{if(timer)clearTimeout(timer)}
  }

  try{
    const selected=mode==='opposite'?targetGenres:genres;
    const sort=['POPULARITY_DESC','SCORE_DESC'];
    let results=await request({page,perPage:50,genres:selected.length?selected:null,excludeIds,sort});
    let unique=[...new Map(results.filter(Boolean).map(x=>[Number(x.id),x])).values()];
    if(unique.length<12){
      const fallback=await request({page:((page)%8)+1,perPage:50,genres:null,excludeIds,sort});
      unique=[...new Map([...unique,...fallback].filter(Boolean).map(x=>[Number(x.id),x])).values()];
    }
    return json(res,200,{ok:true,mode,results:unique});
  }catch(error){
    console.warn('[ONEBASE] AniList recommendation failed; trying Kitsu:',error?.message||error);
    try{
      const results=await requestKitsu(page);
      return json(res,200,{ok:true,mode,provider:'kitsu',results});
    }catch(fallbackError){
      console.error('[ONEBASE] Lootbox recommendation sources failed:',fallbackError);
      const message=String(fallbackError?.message||'Jikan no respondió.');
      return json(res,502,{ok:false,error:'AniList y el catálogo alternativo no están disponibles. '+message});
    }
  }
};
