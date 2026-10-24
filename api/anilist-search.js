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
  // Reuse this endpoint for refreshing calendar metadata without adding another serverless function.
  if (req.method === 'POST' && req.body?.action === 'airing') {
    const entries = Array.isArray(req.body?.items) ? req.body.items.slice(0, 50) : [];
    const ids = [...new Set([
      ...(Array.isArray(req.body?.ids) ? req.body.ids : []),
      ...entries.map(item => item?.id)
    ].map(Number).filter(id => Number.isInteger(id) && id > 0))].slice(0, 50);
    const fields = `id idMal title { romaji english native userPreferred } synonyms status episodes nextAiringEpisode { airingAt episode }`;
    const results = new Map();
    try {
      if (ids.length) {
        const upstream = await fetch(ANILIST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: `query ($ids: [Int]) { Page(page: 1, perPage: 50) { media(id_in: $ids, type: ANIME) { ${fields} } } }`,
            variables: { ids }
          })
        });
        const payload = await upstream.json().catch(() => null);
        if (!upstream.ok || payload?.errors?.length) {
          const limited = upstream.status === 429 || payload?.errors?.some(e => Number(e?.status) === 429 || /too many requests/i.test(String(e?.message || '')));
          if (limited) {
            const retryAfter = upstream.headers.get('retry-after');
            if (retryAfter) res.setHeader('Retry-After', retryAfter);
            return json(res, 429, { ok: false, error: 'AniList está limitando temporalmente las consultas.' });
          }
          return json(res, 502, { ok: false, error: 'No se pudo actualizar el calendario de AniList.' });
        }
        for (const media of payload?.data?.Page?.media || []) results.set(Number(media.id), media);
      }
      const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      // Verify saved IDs against the title. Older library records can contain a stale or mismatched ID.
      const titleOf = media => [media.title?.userPreferred,media.title?.romaji,media.title?.english,media.title?.native,...(Array.isArray(media.synonyms)?media.synonyms:[])].filter(Boolean);
      const matches = new Map();
      const associate = (entry, media) => {
        const key = Number(entry?.key), id = Number(media?.id);
        if (Number.isSafeInteger(key) && key >= 0 && Number.isSafeInteger(id) && id > 0) matches.set(key, id);
      };
      entries.forEach(entry => {
        const id = Number(entry?.id) || 0, media = id ? results.get(id) : null;
        if (!media) return;
        const wanted = normalize(entry?.title);
        if (!wanted || titleOf(media).some(value => {
          const candidate = normalize(value);
          return candidate === wanted || candidate.startsWith(wanted + ' ') || wanted.startsWith(candidate + ' ');
        })) associate(entry, media);
      });
      const missing = entries.filter(item => {
        const title=String(item?.title||'').trim(),id=Number(item?.id)||0,media=id?results.get(id):null;
        if(title.length<2)return false;
        if(!media)return true;
        const wanted=normalize(title);
        return !titleOf(media).some(value=>normalize(value)===wanted||normalize(value).startsWith(wanted+' ')||wanted.startsWith(normalize(value)+' '));
      }).slice(0,20);
      for (const entry of missing) {
        const title = String(entry.title || '').trim();
        const upstream = await fetch(ANILIST_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            query: `query ($search: String!) { Page(page: 1, perPage: 10) { media(search: $search, type: ANIME, isAdult: false, sort: [SEARCH_MATCH, POPULARITY_DESC]) { ${fields} } } }`,
            variables: { search: title }
          })
        });
        const payload = await upstream.json().catch(() => null);
        if (!upstream.ok || payload?.errors?.length) {
          const limited = upstream.status === 429 || payload?.errors?.some(e => Number(e?.status) === 429 || /too many requests/i.test(String(e?.message || '')));
          if (limited) {
            const retryAfter = upstream.headers.get('retry-after');
            if (retryAfter) res.setHeader('Retry-After', retryAfter);
            return json(res, 429, { ok: false, error: 'AniList está limitando temporalmente las consultas.' });
          }
          continue;
        }
        const candidates = payload?.data?.Page?.media || [];
        const wanted = normalize(title);
        const exact = candidates.find(media => titleOf(media).some(value => normalize(value) === wanted));
        const partial = candidates.find(media => titleOf(media).some(value => {
          const candidate=normalize(value);
          return candidate.startsWith(wanted+' ')||wanted.startsWith(candidate+' ')||candidate.includes(wanted);
        }));
        const match = exact || partial || (candidates.length === 1 ? candidates[0] : null);
        if (match) {
          if(Number(entry.id)&&Number(entry.id)!==Number(match.id))results.delete(Number(entry.id));
          results.set(Number(match.id), match);
          associate(entry, match);
        }
      }
      return json(res, 200, { ok: true, results: [...results.values()], matches: [...matches].map(([key,id]) => ({ key, id })) });
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
