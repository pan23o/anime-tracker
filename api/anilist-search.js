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
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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
