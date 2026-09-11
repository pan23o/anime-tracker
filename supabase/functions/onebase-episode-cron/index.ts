import { withSupabase } from 'npm:@supabase/server@^1';
import { sendNotification } from 'npm:web-push-neo@0.1.2';

const WIKIPEDIA_API = 'https://es.wikipedia.org/w/api.php';
const BUCKET = 'anime-libraries';
const VAPID_PUBLIC_KEY = 'BJBJ2AcTJh1nFKp2NxgAruEkAyLbG5LPeoAfDKPiiVQMMXejFi_GF5G-6nVFNN5syEfV2NEKOiImLznUnWsCpcc';
const VAPID_SUBJECT = 'https://github.com/pan23o/anime-tracker';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type' };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
function normalizeTitle(value: unknown) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'`]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
}
function animeKey(item: any) {
  const id = item?.aniId ?? item?.id ?? item?.malId;
  return id != null && String(id).trim() ? `id:${String(id).trim()}` : `title:${normalizeTitle(item?.anime)}`;
}
function decodeLibrary(text: string) {
  const result: any[] = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith('#')) continue;
    try {
      const item = JSON.parse(s);
      if (item && typeof item === 'object' && String(item.anime || '').trim()) result.push(item);
    } catch {}
  }
  return result;
}
async function wikiSearch(title: string) {
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set('action', 'query');
  url.searchParams.set('list', 'search');
  url.searchParams.set('srsearch', title);
  url.searchParams.set('srnamespace', '0');
  url.searchParams.set('srlimit', '8');
  url.searchParams.set('format', 'json');
  const response = await fetch(url, { headers: { 'User-Agent': 'OneBase/1.0 episode updater (+https://github.com/pan23o/anime-tracker)' } });
  if (!response.ok) throw new Error(`Wikipedia search ${response.status}`);
  const json = await response.json();
  const wanted = normalizeTitle(title);
  const pages = json?.query?.search || [];
  const exact = pages.find((page: any) => normalizeTitle(page.title) === wanted);
  if (exact?.title) return exact.title;
  const partial = pages.find((page: any) => {
    const found = normalizeTitle(page.title);
    return found.includes(wanted) || wanted.includes(found);
  });
  return partial?.title || null;
}
async function wikiPageText(pageTitle: string) {
  if (!pageTitle) return '';
  const url = new URL(WIKIPEDIA_API);
  url.searchParams.set('action', 'parse');
  url.searchParams.set('page', pageTitle);
  url.searchParams.set('prop', 'wikitext');
  url.searchParams.set('format', 'json');
  const response = await fetch(url, { headers: { 'User-Agent': 'OneBase/1.0 episode updater (+https://github.com/pan23o/anime-tracker)' } });
  if (!response.ok) throw new Error(`Wikipedia parse ${response.status}`);
  const json = await response.json();
  return json?.parse?.wikitext?.['*'] || '';
}
function pickEpisodeNumber(text: string) {
  const source = String(text || '');
  const patterns = [
    /\|\s*(?:n[úu]mero[_\s]*de[_\s]*episodios?|num(?:ero)?[_\s]*de[_\s]*episodios?|n[úu]mero[_\s]*episodios?|episodios?|episodes?|num[_\s]*episodes?)\s*=\s*(?:\{\{[^}]*\}\}\s*)?(?:\[\[[^\]]+\]\]\s*)?(\d{1,4})\b/i,
    /(?:n[úu]mero|number)\s+de\s+episodios?\s*[:：=]\s*(\d{1,4})\b/i,
    /(?:total\s+de\s+episodios?|total\s+episodes?)\s*[:：=]\s*(\d{1,4})\b/i,
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match) return Number(match[1]);
  }
  return null;
}
async function currentWikipediaTotal(title: string) {
  const pageTitle = await wikiSearch(title);
  if (!pageTitle) return null;
  const text = await wikiPageText(pageTitle);
  const total = pickEpisodeNumber(text);
  return Number.isFinite(total) ? { total, pageTitle } : null;
}
async function processUser(supabaseAdmin: any, userId: string, subscriptions: any[], vapidPrivateKey: string) {
  const { data: file, error: fileError } = await supabaseAdmin.storage.from(BUCKET).download(`${userId}/library.txt`);
  if (fileError || !file) return { userId, checked: 0, updates: 0, sent: 0, skipped: 'library-unavailable' };
  const list = decodeLibrary(await file.text());
  const candidates = list.filter(item => {
    const total = Number(item.total);
    const watched = Number(item.watched) || 0;
    const state = String(item.state || '').toLowerCase();
    return String(item.anime || '').trim() && Number.isFinite(total) && total > 0 && state !== 'abandonado' && watched >= 0;
  }).slice(0, 100);
  let checked = 0, updates = 0, sent = 0;

  for (let i = 0; i < candidates.length; i += 4) {
    const results = await Promise.all(candidates.slice(i, i + 4).map(async item => {
      try {
        const currentTotal = Number(item.total);
        const result = await currentWikipediaTotal(String(item.anime));
        checked++;
        if (!result || result.total <= currentTotal) return null;
        return { item, currentTotal, nextTotal: result.total };
      } catch { return null; }
    }));

    for (const update of results.filter(Boolean) as any[]) {
      updates++;
      const item = update.item;
      const key = animeKey(item);
      const { data: inserted, error: insertError } = await supabaseAdmin
        .from('onebase_episode_notifications')
        .insert({ user_id: userId, anime_key: key, anime_title: String(item.anime), episode: update.nextTotal })
        .select('id')
        .maybeSingle();
      if (insertError || !inserted?.id) continue;

      const payload = JSON.stringify({
        title: 'Nuevo episodio en OneBase',
        body: `${item.anime}: hay ${update.nextTotal - update.currentTotal} episodio${update.nextTotal - update.currentTotal === 1 ? '' : 's'} nuevo${update.nextTotal - update.currentTotal === 1 ? '' : 's'}.`,
        tag: `onebase-episode-${key}-${update.nextTotal}`,
        data: { anime: String(item.anime), episode: update.nextTotal, total: update.nextTotal, previousTotal: update.currentTotal }
      });
      const pushOptions = {
        vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey: vapidPrivateKey },
        TTL: 60 * 60 * 24 * 7,
        urgency: 'high' as const
      };
      let delivered = false;
      for (const subscriptionRow of subscriptions) {
        try {
          await sendNotification(subscriptionRow.subscription, payload, pushOptions);
          delivered = true;
          sent++;
        } catch (error: any) {
          const status = Number(error?.statusCode || 0);
          if (status === 404 || status === 410) await supabaseAdmin.from('onebase_push_subscriptions').delete().eq('endpoint', subscriptionRow.endpoint);
        }
      }
      if (!delivered) await supabaseAdmin.from('onebase_episode_notifications').delete().eq('id', inserted.id);
    }
  }
  return { userId, checked, updates, sent };
}

export default {
  fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
    if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
    const { data: state } = await ctx.supabaseAdmin.from('onebase_cron_state').select('last_started_at').eq('id', true).maybeSingle();
    const lastStarted = state?.last_started_at ? new Date(state.last_started_at).getTime() : 0;
    if (lastStarted && Date.now() - lastStarted < 5 * 60 * 1000) return json({ ok: true, skipped: 'rate-limited', lastStartedAt: state.last_started_at });
    const vapidPrivateKey = Deno.env.get('ONEBASE_VAPID_PRIVATE_KEY') || '';
    if (!vapidPrivateKey) return json({ ok: false, error: 'ONEBASE_VAPID_PRIVATE_KEY is not configured' }, 503);
    await ctx.supabaseAdmin.from('onebase_cron_state').update({ last_started_at: new Date().toISOString() }).eq('id', true);
    try {
      const { data: subscriptions, error: subscriptionError } = await ctx.supabaseAdmin.from('onebase_push_subscriptions').select('user_id, endpoint, subscription');
      if (subscriptionError) throw subscriptionError;
      const grouped = new Map<string, any[]>();
      for (const row of subscriptions || []) {
        const list = grouped.get(row.user_id) || [];
        list.push(row);
        grouped.set(row.user_id, list);
      }
      const results = [];
      for (const [userId, userSubscriptions] of grouped.entries()) results.push(await processUser(ctx.supabaseAdmin, userId, userSubscriptions, vapidPrivateKey));
      const result = { ok: true, users: grouped.size, checked: results.reduce((sum, row) => sum + Number(row.checked || 0), 0), updates: results.reduce((sum, row) => sum + Number(row.updates || 0), 0), sent: results.reduce((sum, row) => sum + Number(row.sent || 0), 0), finishedAt: new Date().toISOString() };
      await ctx.supabaseAdmin.from('onebase_cron_state').update({ last_finished_at: result.finishedAt, last_result: result }).eq('id', true);
      return json(result);
    } catch (error: any) {
      const result = { ok: false, error: String(error?.message || error), finishedAt: new Date().toISOString() };
      await ctx.supabaseAdmin.from('onebase_cron_state').update({ last_finished_at: result.finishedAt, last_result: result }).eq('id', true);
      return json(result, 500);
    }
  }),
};
