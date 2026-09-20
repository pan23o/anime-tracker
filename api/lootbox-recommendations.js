const ANILIST_URL='https://graphql.anilist.co';

const QUERY=`
  query ($page:Int!, $perPage:Int!, $genre:String, $genres:[String!], $excludeIds:[Int!]) {
    Page(page:$page, perPage:$perPage) {
      media(
        type:ANIME,
        isAdult:false,
        genre:$genre,
        genre_in:$genres,
        id_not_in:$excludeIds,
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
  const dominantGenre=selectedGenres[0];
  async function request(variables){
    const upstream=await fetch(ANILIST_URL,{
      method:'POST',
      headers:{'Content-Type':'application/json',Accept:'application/json'},
      body:JSON.stringify({query:QUERY,variables})
    });
    const payload=await upstream.json().catch(()=>null);
    if(!upstream.ok){
      if(upstream.status===429)throw Object.assign(new Error('AniList está limitando temporalmente las recomendaciones.'),{status:429});
      throw new Error('AniList no está disponible en este momento.');
    }
    if(payload?.errors?.length)throw new Error('AniList devolvió un error al preparar la tirada.');
    return Array.isArray(payload?.data?.Page?.media)?payload.data.Page.media:[];
  }
  try{
    // First: the user's strongest genre. One genre avoids over-constraining the query.
    let results=await request({page,perPage:50,genre:dominantGenre,genres:null,excludeIds});
    // Second: any of the user's top genres, still excluding their library.
    if(results.length<12)results=await request({page:1,perPage:50,genre:null,genres:selectedGenres,excludeIds});
    // Final fallback: popular anime with no score floor. The client still ranks them by taste.
    if(results.length<5)results=await request({page:1,perPage:50,genre:null,genres:null,excludeIds});
    return json(res,200,{ok:true,results});
  }catch(error){
    if(error?.status===429)return json(res,429,{ok:false,error:error.message});
    console.error('[ONEBASE] Lootbox recommendations failed:',error);
    return json(res,502,{ok:false,error:error.message||'No se pudo conectar con AniList.'});
  }
};
