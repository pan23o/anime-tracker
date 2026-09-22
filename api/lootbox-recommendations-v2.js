const ANILIST_URL='https://graphql.anilist.co';

const QUERY=`
  query ($page:Int!, $perPage:Int!, $genre:String, $genres:[String!], $excludeIds:[Int!], $sort:[MediaSort!]) {
    Page(page:$page, perPage:$perPage) {
      media(
        type:ANIME,
        isAdult:false,
        genre:$genre,
        genre_in:$genres,
        id_not_in:$excludeIds,
        sort:$sort
      ) {
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
  const targetGenres=Array.isArray(body.targetGenres)?body.targetGenres.map(String).map(s=>s.trim()).filter(Boolean).slice(0,8):[];
  const excludeIds=Array.isArray(body.excludeIds)?body.excludeIds.map(Number).filter(Number.isInteger).slice(0,10000):[];
  const page=Math.min(8,Math.max(1,Number.parseInt(body.page,10)||1));

  async function request(variables){
    const upstream=await fetch(ANILIST_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query:QUERY,variables})});
    const payload=await upstream.json().catch(()=>null);
    if(!upstream.ok){
      if(upstream.status===429)throw Object.assign(new Error('AniList está limitando temporalmente las recomendaciones.'),{status:429});
      throw new Error('AniList no está disponible en este momento.');
    }
    if(payload?.errors?.length)throw new Error(payload.errors.map(x=>x.message).join(' · ')||'AniList devolvió un error.');
    return Array.isArray(payload?.data?.Page?.media)?payload.data.Page.media:[];
  }

  try{
    let results=[];
    if(mode==='random'){
      const pages=[page,((page)%8)+1,((page+1)%8)+1];
      const chunks=await Promise.all(pages.map(p=>request({page:p,perPage:25,genre:null,genres:null,excludeIds,sort:['POPULARITY_DESC']})));
      results=chunks.flat();
    }else if(mode==='opposite'&&targetGenres.length){
      const chunks=await Promise.all(targetGenres.slice(0,3).map((g,i)=>request({page:1+(page+i)%3,perPage:25,genre:g,genres:null,excludeIds,sort:['POPULARITY_DESC']})));
      results=chunks.flat();
    }else{
      const selected=genres.length?genres:['Action','Adventure','Comedy'];
      const primary=selected[0];
      results=await request({page,perPage:25,genre:primary,genres:null,excludeIds,sort:['POPULARITY_DESC']});
      if(results.length<15){
        results=await request({page:1,perPage:25,genre:null,genres:selected,excludeIds,sort:['POPULARITY_DESC']});
      }
      if(results.length<10){
        results=await request({page:1,perPage:25,genre:null,genres:null,excludeIds,sort:['POPULARITY_DESC']});
      }
    }
    const unique=[...new Map(results.filter(Boolean).map(x=>[Number(x.id),x])).values()];
    return json(res,200,{ok:true,mode,results:unique});
  }catch(error){
    if(error?.status===429)return json(res,429,{ok:false,error:error.message});
    console.error('[ONEBASE] Lootbox v2 failed:',error);
    return json(res,502,{ok:false,error:error.message||'No se pudo conectar con AniList.'});
  }
};
