const API = 'https://api.themoviedb.org/3';

function json(res, status, body) {
  return res.status(status).setHeader('Cache-Control', status === 200 ? 'public, s-maxage=3600, stale-while-revalidate=86400' : 'no-store').json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Método no permitido.' });
  }
  const type = String(req.query?.type || ''), id = Number.parseInt(req.query?.id || '', 10);
  if (!['movie', 'tv'].includes(type) || !Number.isSafeInteger(id) || id < 1) return json(res, 400, { ok: false, error: 'Ficha no válida.' });
  const key = process.env.TMDB_API_KEY;
  if (!key) return json(res, 503, { ok: false, error: 'TMDB_API_KEY no está configurada en el servidor.' });
  try {
    const url = new URL(`${API}/${type}/${id}`);
    url.searchParams.set('language', 'es-ES');
    const upstream = await fetch(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${key}` } });
    const payload = await upstream.json().catch(() => null);
    if (upstream.status === 404) return json(res, 404, { ok: false, error: 'No se encontró esa ficha.' });
    if (!upstream.ok) return json(res, upstream.status === 429 ? 429 : 502, { ok: false, error: upstream.status === 429 ? 'TMDB está limitando temporalmente las consultas.' : 'TMDB no está disponible en este momento.' });
    return json(res, 200, { ok: true, result: payload });
  } catch (error) {
    console.error('[ONEBASE] TMDB detail failed:', error);
    return json(res, 502, { ok: false, error: 'No se pudo conectar con TMDB.' });
  }
};
