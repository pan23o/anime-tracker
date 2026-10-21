const API = 'https://api.themoviedb.org/3';

function json(res, status, body, cache = 'no-store') {
  return res.status(status).setHeader('Cache-Control', cache).json(body);
}

async function tmdb(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Método no permitido.' });
  }
  const action = String(req.query?.action || '');
  const key = process.env.TMDB_API_KEY;
  if (!key) return json(res, 503, { ok: false, error: 'TMDB_API_KEY no está configurada en el servidor.' });

  try {
    let url;
    let cache;
    if (action === 'search') {
      const query = String(req.query?.q || '').trim();
      if (query.length < 2 || query.length > 100) return json(res, 400, { ok: false, error: 'Escribe entre 2 y 100 caracteres para buscar.' });
      url = new URL(`${API}/search/multi`);
      url.searchParams.set('query', query);
      url.searchParams.set('language', 'es-ES');
      url.searchParams.set('include_adult', 'false');
      url.searchParams.set('page', String(Math.min(Math.max(Number.parseInt(req.query?.page || '1', 10) || 1, 1), 5)));
      cache = 'public, s-maxage=300, stale-while-revalidate=900';
    } else if (action === 'detail') {
      const type = String(req.query?.type || ''), id = Number.parseInt(req.query?.id || '', 10);
      if (!['movie', 'tv'].includes(type) || !Number.isSafeInteger(id) || id < 1) return json(res, 400, { ok: false, error: 'Ficha no válida.' });
      url = new URL(`${API}/${type}/${id}`);
      url.searchParams.set('language', 'es-ES');
      cache = 'public, s-maxage=3600, stale-while-revalidate=86400';
    } else {
      return json(res, 400, { ok: false, error: 'Acción TMDB no válida.' });
    }

    const upstream = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${key}` } });
    const payload = await upstream.json().catch(() => null);
    if (upstream.status === 404) return json(res, 404, { ok: false, error: 'No se encontró esa ficha.' });
    if (upstream.status === 429) return json(res, 429, { ok: false, error: 'TMDB está limitando temporalmente las consultas.' });
    if (!upstream.ok) return json(res, 502, { ok: false, error: 'TMDB no está disponible en este momento.' });
    if (action === 'detail') return json(res, 200, { ok: true, result: payload }, cache);

    const results = (Array.isArray(payload?.results) ? payload.results : []).filter(x => ['movie', 'tv'].includes(x?.media_type));
    return json(res, 200, { ok: true, page: payload?.page || 1, totalPages: Math.min(Number(payload?.total_pages) || 1, 5), results }, cache);
  } catch (error) {
    console.error('[ONEBASE] TMDB request failed:', error);
    return json(res, 502, { ok: false, error: 'No se pudo conectar con TMDB.' });
  }
}

module.exports = async function handler(req, res) {
  if (req.query?.service === 'tmdb') return tmdb(req, res);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  return res.status(200).setHeader('Cache-Control', 'no-store').json({
    ok: true,
    service: 'onebase',
    version: 'premium-v1',
    time: new Date().toISOString()
  });
};
