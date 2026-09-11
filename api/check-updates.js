const WIKIPEDIA_API = 'https://es.wikipedia.org/w/api.php';

function normalizeTitle(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[’'`]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim().toLowerCase();
}

function pickEpisodeNumber(text) {
  const source = String(text || '');
  const patterns = [
    /(?:num(?:ero)?|n[ºo°]?|episodios?|episodes?)\s*[:：]?\s*(\d{1,4})/i,
    /(?:total\s+de\s+episodios?)\s*[:：]?\s*(\d{1,4})/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}

async function wikiSearch(title) {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', title);
  url.searchParams.set('srnamespace', '0');
  url.searchParams.set('srlimit', '5');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  const response = await fetch(url, { headers: { 'User-Agent': 'OneBase/1.0 episode updater' } });
  if (!response.ok) throw new Error(`Wikipedia search ${response.status}`);
  const json = await response.json();
  const wanted = normalizeTitle(title);
  const pages = json?.query?.search || [];
  return pages
    .map(page => ({ title: page.title, score: normalizeTitle(page.title) === wanted ? 100 : 0 }))
    .sort((a, b) => b.score - a.score)[0]?.title || null;
}

async function wikiPageText(pageTitle) {
  if (!pageTitle) return '';
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', pageTitle);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  const response = await fetch(url, { headers: { 'User-Agent': 'OneBase/1.0 episode updater' } });
  if (!response.ok) throw new Error(`Wikipedia parse ${response.status}`);
  const json = await response.json();
  return json?.parse?.wikitext?.['*'] || '';
}

function isSameAnime(item, pageTitle) {
  if (!pageTitle) return false;
  const a = normalizeTitle(item.anime);
  const b = normalizeTitle(pageTitle);
  return a === b || a.includes(b) || b.includes(a);
}

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  const requested = items.slice(0, 100).filter(item => item && String(item.anime || '').trim());
  const updates = [];
  const checkedAt = Date.now();

  for (const item of requested) {
    try {
      const currentTotal = Number(item.total);
      if (!Number.isFinite(currentTotal) || currentTotal <= 0) continue;

      const pageTitle = await wikiSearch(item.anime);
      if (!isSameAnime(item, pageTitle)) continue;

      const text = await wikiPageText(pageTitle);
      const total = pickEpisodeNumber(text);
      if (!Number.isFinite(total) || total <= currentTotal) continue;

      updates.push({
        id: item.id ?? null,
        anime: String(item.anime),
        previousTotal: currentTotal,
        total,
        watched: Math.min(Number(item.watched) || 0, total),
        checkedAt,
        source: 'wikipedia'
      });
    } catch (error) {
      console.warn(`[ONEBASE] Could not check ${item.anime}:`, error?.message || error);
    }
  }

  return res.status(200).json({ ok: true, checked: requested.length, updates, checkedAt });
}
