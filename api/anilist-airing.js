const ANILIST_URL = 'https://graphql.anilist.co';

function json(res, status, body) {
  return res.status(status).setHeader('Cache-Control', 'no-store').json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }
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
      return json(res, upstream.status === 429 ? 429 : 502, {
        ok: false, error: 'No se pudo actualizar el calendario de AniList.'
      });
    }
    return json(res, 200, { ok: true, results: payload?.data?.Page?.media || [] });
  } catch (error) {
    console.error('[ONEBASE] AniList airing refresh failed:', error);
    return json(res, 502, { ok: false, error: 'AniList no está disponible temporalmente.' });
  }
};