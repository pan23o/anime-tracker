const API = 'https://api.themoviedb.org/3/search/multi';

function json(res, status, body) {
  return res.status(status).setHeader('Cache-Control', status === 200 ? 'public, s-maxage=300, stale-while-revalidate=900' : 'no-store').json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Método no permitido.' });
  }
  const query = String(req.query?.q || '').trim();
  if (query.length < 2 || query.length > 100) return json(res, 400, { ok: false, error: 'Escribe entre 2 y 100 caracteres para buscar.' });
  const key = process.env.TMDB_API_KEY;
  if (!key) return json(res, 503, { ok: false, error: 'La búsqueda audiovisual aún no está configurada. Falta TMDB_API_KEY en el entorno del servidor.' });
  try {
    const url = new URL(API);
    url.searchParams.set('query', query);
    url.searchParams.set('language', 'es-ES');
    url.searchParams.set('include_adult', 'false');
    url.searchParams.set('page', String(Math.min(Math.max(Number.parseInt(req.query?.page || '1', 10) || 1, 1), 5)));
    const upstream = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${key}` } });
    const payload = await upstream.json().catch(() => null);
    if (upstream.status === 429) return json(res, 429, { ok: false, error: 'TMDB está limitando temporalmente las búsquedas. Espera un momento.' });
    if (!upstream.ok) return json(res, 502, { ok: false, error: 'TMDB no está disponible en este momento.' });
    const results = (Array.isArray(payload?.results) ? payload.results : []).filter(x => ['movie', 'tv'].includes(x?.media_type));
    return json(res, 200, { ok: true, page: payload?.page || 1, totalPages: Math.min(Number(payload?.total_pages) || 1, 5), results });
  } catch (error) {
    console.error('[ONEBASE] TMDB search failed:', error);
    return json(res, 502, { ok: false, error: 'No se pudo conectar con TMDB.' });
  }
};
