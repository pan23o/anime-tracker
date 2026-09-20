const ANILIST_URL='https://graphql.anilist.co';

const QUERY=`
  query ($page:Int!, $perPage:Int!, $genres:[String!], $excludeIds:[Int!]) {
    Page(page:$page, perPage:$perPage) {
      media(
        type:ANIME,
        isAdult:false,
        genre_in:$genres,
        id_not_in:$excludeIds,
        averageScore_greater:65,
        sort:[POPULARITY_DESC]
      ) {
        id
        title { romaji english native userPreferred }
        description(asHtml:false)
        genres
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

function json(res,status,body){
  return res.status(status).setHeader('Cache-Control','no-store').json(body);
}

module.exports=async function handler(req,res){
  if(req.method!=='POST'){
    res.setHeader('Allow','POST');
    return json(res,405,{ok:false,error:'Method not allowed'});
  }
  const body=req.body&&typeof req.body==='object'?req.body:{};
  const genres=Array.isArray(body.genres)?body.genres.map(String).map(s=>s.trim()).filter(Boolean).slice(0,8):[];
  const excludeIds=Array.isArray(body.excludeIds)?body.excludeIds.map(Number).filter(Number.isInteger).slice(0,10000):[];
  const page=Math.min(3,Math.max(1,Number.parseInt(body.page,10)||1));
  const selectedGenres=genres.length?genres:['Action','Adventure','Comedy'];
  try{
    const upstream=await fetch(ANILIST_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({query:QUERY,variables:{page,perPage:50,genres:selectedGenres,excludeIds}})
    });
    const payload=await upstream.json().catch(()=>null);
    if(!upstream.ok){
      if(upstream.status===429)return json(res,429,{ok:false,error:'AniList está limitando temporalmente las recomendaciones.'});
      return json(res,502,{ok:false,error:'AniList no está disponible en este momento.'});
    }
    if(payload?.errors?.length)return json(res,502,{ok:false,error:'AniList devolvió un error al preparar la tirada.'});
    const results=Array.isArray(payload?.data?.Page?.media)?payload.data.Page.media:[];
    return json(res,200,{ok:true,results});
  }catch(error){
    console.error('[ONEBASE] Lootbox recommendations failed:',error);
    return json(res,502,{ok:false,error:'No se pudo conectar con AniList.'});
  }
};
