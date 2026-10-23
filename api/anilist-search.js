const ANILIST_URL = 'https://graphql.anilist.co';

const QUERY = `
  query ($search: String!, $page: Int!, $perPage: Int!) {
    Page(page: $page, perPage: $perPage) {
      pageInfo { currentPage hasNextPage perPage }
      media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
        id
        idMal
        title { romaji english native userPreferred }
        synonyms
        format
        status
        season
        seasonYear
        episodes
        duration
        countryOfOrigin
        source
        coverImage { extraLarge large medium color }
        bannerImage
        description(asHtml: false)
        genres
        averageScore
        nextAiringEpisode { airingAt episode }
        popularity
        favourites
        siteUrl
      }
    }
  }
`;

function json(res, status, body) {
  return res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

module.exports = async function handler(req, res) {
  // Share the existing AniList function to stay within Vercel Hobby's function limit.
  if (req.method === 'POST' && req.body?.action === 'airing') {
    const ids = [...new Set((Array.isArray(req.body?.ids) ? req.body.ids : [])
      .map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 50);
    if (!ids.length) return json(res, 200, { ok: true, results: [] });
    try {
      const upstream = await fetch(ANILIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          query: `query ($ids: [Int]) {
            Page(page: 1, perPage: 50) {
              media(id_in: $ids, type: ANIME) {
                id
                status
                episodes
                nextAiringEpisode { airingAt episode }
              }
            }
          }`,
          variables: { ids }
        })
      });
      const payload = await upstream.json().catch(() => null);
      if (!upstream.ok || payload?.errors?.length) {
        const limited = upstream.status === 429 || payload?.errors?.some(e => Number(e?.status) === 429);
        if (limited) {
          const retryAfter = upstream.headers.get('retry-after');
          if (retryAfter) res.setHeader('Retry-After', retryAfter);
          return json(res, 429, { ok: false, error: 'AniList está limitando temporalmente las consultas.' });
        }
        return json(res, 502, { ok: false, error: 'No se pudo actualizar el calendario de AniList.' });
      }
      return json(res, 200, { ok: true, results: payload?.data?.Page?.media || [] });
    } catch (error) {
      console.error('[ONEBASE] AniList airing refresh failed:', error);
      return json(res, 502, { ok: false, error: 'AniList no está disponible temporalmente.' });
    }
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const raw = String(req.query?.q || '').trim();
  if (raw.length < 2) return json(res, 400, { ok: false, error: 'La búsqueda debe tener al menos 2 caracteres.' });
  if (raw.length > 120) return json(res, 400, { ok: false, error: 'La búsqueda es demasiado larga.' });

  const page = Math.min(Math.max(Number.parseInt(req.query?.page || '1', 10) || 1, 1), 5);
  const perPage = Math.min(Math.max(Number.parseInt(req.query?.perPage || '12', 10) || 12, 1), 20);

  try {
    const upstream = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: QUERY, variables: { search: raw, page, perPage } })
    });

    const payload = await upstream.json().catch(() => null);
    if (!upstream.ok) {
      const retryAfter = upstream.headers.get('retry-after');
      if (upstream.status === 429) {
        if (retryAfter) res.setHeader('Retry-After', retryAfter);
        return json(res, 429, { ok: false, error: 'AniList está limitando temporalmente las búsquedas.', retryAfter: retryAfter ? Number(retryAfter) : null });
      }
      return json(res, 502, { ok: false, error: 'AniList no está disponible en este momento.' });
    }

    if (payload?.errors?.length) {
      const rateError = payload.errors.some(e => Number(e?.status) === 429 || /too many requests/i.test(String(e?.message || '')));
      if (rateError) return json(res, 429, { ok: false, error: 'AniList está limitando temporalmente las búsquedas.' });
      return json(res, 502, { ok: false, error: 'AniList devolvió un error de búsqueda.' });
    }

    const pageData = payload?.data?.Page;
    const media = Array.isArray(pageData?.media) ? pageData.media : [];
    return json(res, 200, {
      ok: true,
      query: raw,
      pageInfo: pageData?.pageInfo || { currentPage: page, hasNextPage: false, perPage },
      results: media
    });
  } catch (error) {
    console.error('[ONEBASE] AniList search failed:', error);
    return json(res, 502, { ok: false, error: 'No se pudo conectar con AniList.' });
  }
};
