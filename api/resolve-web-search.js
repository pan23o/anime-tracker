const { URL } = require('node:url');
const dns = require('node:dns').promises;
const net = require('node:net');

function isPrivateHostname(hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h === '0.0.0.0') return true;
  if (net.isIP(h) === 4) {
    const [a,b] = h.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (net.isIP(h) === 6) return h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80:');
  return false;
}

async function assertSafeUrl(value) {
  const u = new URL(value);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Solo se permiten URLs HTTP o HTTPS.');
  if (isPrivateHostname(u.hostname)) throw new Error('No se puede acceder a una dirección privada.');
  try {
    const addresses = await dns.lookup(u.hostname, { all: true });
    if (addresses.some(x => isPrivateHostname(x.address))) throw new Error('La dirección apunta a una red privada.');
  } catch (err) {
    if (err.message.includes('privada')) throw err;
  }
  return u;
}

function attr(tag, name) {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i');
  return (tag.match(re) || [])[1] || '';
}

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>');
}

function absolute(base, value) {
  try { return new URL(decodeHtml(value), base).toString(); } catch (_) { return null; }
}

function scoreForm(form) {
  const text = form.toLowerCase();
  let score = 0;
  if (/(type=["']search["']|name=["'](?:q|query|search|keyword|title|anime)["'])/.test(text)) score += 8;
  if (/(placeholder=["'][^"']*(?:buscar|search|anime)[^"']*["'])/.test(text)) score += 6;
  if (/(buscar|search|busca)/.test(text)) score += 3;
  if (/(login|signin|register|password|correo|email)/.test(text)) score -= 6;
  return score;
}

function findSearchForm(html, base) {
  const forms = html.match(/<form\b[\s\S]*?<\/form>/gi) || [];
  let best = null;
  for (const form of forms) {
    const score = scoreForm(form);
    if (score <= 0) continue;
    const open = form.match(/^<form\b[^>]*>/i)?.[0] || '';
    const action = absolute(base, attr(open, 'action') || base);
    if (!action) continue;
    const method = (attr(open, 'method') || 'get').toLowerCase();
    const inputs = form.match(/<input\b[^>]*>/gi) || [];
    let field = null;
    for (const input of inputs) {
      const type = (attr(input, 'type') || 'text').toLowerCase();
      const name = attr(input, 'name');
      const placeholder = attr(input, 'placeholder');
      if (type === 'search' || /^(q|query|search|keyword|title|anime)$/i.test(name) || /buscar|search|anime/i.test(placeholder)) {
        field = name || 'q';
        break;
      }
    }
    if (!field) field = 'q';
    const candidate = { score, action, method, field };
    if (!best || candidate.score > best.score) best = candidate;
  }
  return best;
}

function fallbackCandidates(home, query) {
  const encoded = encodeURIComponent(query);
  const candidates = [
    new URL(`/search?q=${encoded}`, home).toString(),
    new URL(`/search?query=${encoded}`, home).toString(),
    new URL(`/browse?q=${encoded}`, home).toString(),
    new URL(`/anime?search=${encoded}`, home).toString()
  ];
  return candidates;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=300');
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Método no permitido.' });

  const rawUrl = String(req.query?.url || '').trim();
  const query = String(req.query?.query || '').trim();
  if (!rawUrl || !query) return res.status(400).json({ ok: false, error: 'Faltan la URL de la web o el anime.' });
  if (query.length > 200) return res.status(400).json({ ok: false, error: 'La búsqueda es demasiado larga.' });

  let home;
  try { home = await assertSafeUrl(rawUrl); } catch (err) { return res.status(400).json({ ok: false, error: err.message }); }

  try {
    const response = await fetch(home, {
      redirect: 'follow',
      headers: { 'user-agent': 'OneBase/1.0 search resolver', 'accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(7000)
    });
    if (!response.ok) throw new Error(`La web respondió con HTTP ${response.status}.`);
    const type = response.headers.get('content-type') || '';
    if (!type.includes('text/html')) throw new Error('La URL no parece ser una página web HTML.');
    const html = (await response.text()).slice(0, 1500000);
    const finalUrl = new URL(response.url);
    await assertSafeUrl(finalUrl.toString());

    const form = findSearchForm(html, finalUrl);
    if (form && form.method !== 'post') {
      const target = new URL(form.action);
      target.searchParams.set(form.field, query);
      return res.status(200).json({ ok: true, url: target.toString(), mode: 'detected-form', field: form.field });
    }

    const candidates = fallbackCandidates(finalUrl, query);
    return res.status(200).json({ ok: true, url: candidates[0], candidates, mode: 'fallback' });
  } catch (err) {
    return res.status(502).json({ ok: false, error: 'No he podido analizar la web automáticamente.', detail: String(err.message || '') });
  }
};
