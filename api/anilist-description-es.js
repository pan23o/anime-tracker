const TRANSLATE_URL = 'https://api.mymemory.translated.net/get';

function json(res, status, body) {
  return res.status(status).setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800').json(body);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  const source = String(req.query?.text || '').trim();
  if (!source) return json(res, 400, { ok: false, error: 'No hay descripción para traducir.' });
  if (source.length > 5000) return json(res, 400, { ok: false, error: 'La descripción es demasiado larga.' });

  try {
    const url = new URL(TRANSLATE_URL);
    url.searchParams.set('q', source);
    url.searchParams.set('langpair', 'en|es');

    const upstream = await fetch(url, {
      headers: { Accept: 'application/json' }
    });
    const payload = await upstream.json().catch(() => null);

    if (!upstream.ok || Number(payload?.responseStatus) !== 200) {
      return json(res, 502, { ok: false, error: 'No se pudo traducir la descripción.' });
    }

    const translated = String(payload?.responseData?.translatedText || '').trim();
    if (!translated) return json(res, 502, { ok: false, error: 'La traducción llegó vacía.' });

    return json(res, 200, { ok: true, text: translated, language: 'es-ES' });
  } catch (error) {
    console.error('[ONEBASE] Spanish description translation failed:', error);
    return json(res, 502, { ok: false, error: 'No se pudo conectar con el servicio de traducción.' });
  }
};
