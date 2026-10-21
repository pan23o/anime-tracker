const ANILIST_URL='https://graphql.anilist.co';
const JIKAN_URL='https://api.jikan.moe/v4/top/anime';
const JIKAN_TTL=15*60*1000;
const jikanCache=new Map();

async function requestJikan(page){
  const cached=jikanCache.get(page);
  if(cached&&cached.expiresAt>Date.now())return cached.results;
  const controller=typeof AbortController!=='undefined'?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),7000):null;
  try{
    const response=await fetch(JIKAN_URL+'?page='+page+'&limit=25',{headers:{Accept:'application/json'},signal:controller?.signal});
    const payload=await response.json().catch(()=>null);
    if(!response.ok||!Array.isArray(payload?.data))throw new Error('Jikan no pudo cargar recomendaciones.');
    const results=payload.data.map(item=>{
      const malId=Number(item?.mal_id);
      if(!Number.isInteger(malId)||malId<1||String(item?.rating||'').toLowerCase().includes('hentai'))return null;
      const cover=item?.images?.webp?.large_image_url||item?.images?.jpg?.large_image_url||item?.images?.jpg?.image_url||'';
      const genres=[...(Array.isArray(item?.genres)?item.genres:[]),...(Array.isArray(item?.themes)?item.themes:[])].map(x=>String(x?.name||'').trim()).filter(Boolean);
      const title=String(item?.title_english||item?.title||item?.title_japanese||'Anime recomendado');
      return {
        id:-malId,provider:'jikan',externalId:malId,
        title:{userPreferred:title,english:item?.title_english||'',romaji:item?.title||title},
        description:String(item?.synopsis||''),genres,tags:[],
        status:String(item?.status||''),episodes:Number(item?.episodes)||0,duration:0,
        averageScore:Math.round((Number(item?.score)||0)*10),popularity:Number(item?.members)||0,
        coverImage:{extraLarge:cover,large:cover,medium:cover},bannerImage:'',siteUrl:String(item?.url||'')
      };
    }).filter(Boolean);
    if(!results.length)throw new Error('Jikan no encontró recomendaciones disponibles.');
    jikanCache.set(page,{expiresAt:Date.now()+JIKAN_TTL,results});
    return results;
  }catch(error){
    if(error?.name==='AbortError')throw new Error('La fuente alternativa tardó demasiado en responder.');
    throw error;
  }finally{if(timer)clearTimeout(timer)}
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
    console.warn('[ONEBASE] AniList recommendation failed; trying Jikan:',error?.message||error);
    try{
      const results=await requestJikan(page);
      return json(res,200,{ok:true,mode,provider:'jikan',results});
    }catch(fallbackError){
      console.error('[ONEBASE] Lootbox recommendation sources failed:',fallbackError);
      const message=String(fallbackError?.message||'Jikan no respondió.');
      return json(res,502,{ok:false,error:'AniList y la fuente alternativa no están disponibles. '+message});
    }
  }
};
