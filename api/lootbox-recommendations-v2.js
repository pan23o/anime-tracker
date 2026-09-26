const ANILIST_URL='https://graphql.anilist.co';

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
    const timer=controller?setTimeout(()=>controller.abort(),8500):null;
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
    const status=Number(error?.status)||502;
    if(status===429)return res.status(429).setHeader('Retry-After',String(error?.retryAfter||15)).json({ok:false,error:error.message});
    return json(res,status>=400&&status<600?status:502,{ok:false,error:error?.message||'No se pudo conectar con AniList.'});
  }
};
