import { withSupabase } from 'npm:@supabase/server@1.0.0';
import { generateVAPIDKeys, sendNotification } from 'npm:web-push-neo@0.1.2';

const WIKIPEDIA_API = 'https://es.wikipedia.org/w/api.php';
const BUCKET = 'anime-libraries';
const VAPID_SUBJECT = 'https://github.com/pan23o/anime-tracker';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, authorization, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const normalizeTitle = (value: unknown) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[’'`]/g, '').replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
const animeKey = (item: any) => { const id = item?.aniId ?? item?.id ?? item?.malId; return id != null && String(id).trim() ? `id:${String(id).trim()}` : `title:${normalizeTitle(item?.anime)}`; };

function decodeLibrary(text: string) {
  return String(text || '').split(/\r?\n/).flatMap(line => { const s = line.trim(); if (!s || s.startsWith('#')) return []; try { const item = JSON.parse(s); return item && typeof item === 'object' && String(item.anime || '').trim() ? [item] : []; } catch { return []; } });
}
async function getVapidKeys(supabaseAdmin: any) {
  const read = async (name: string) => { const { data, error } = await supabaseAdmin.rpc('onebase_get_runtime_secret', { secret_name: name }); if (error) throw error; return String(data || ''); };
  let publicKey = await read('onebase_vapid_public_key'); let privateKey = await read('onebase_vapid_private_key');
  if (!publicKey || !privateKey) {
    const generated = await generateVAPIDKeys();
    await supabaseAdmin.rpc('onebase_store_vapid_keys', { public_key_value: generated.publicKey, private_key_value: generated.privateKey });
    publicKey = await read('onebase_vapid_public_key'); privateKey = await read('onebase_vapid_private_key');
  }
  if (!publicKey || !privateKey) throw new Error('Could not initialize VAPID keys');
  return { publicKey, privateKey };
}
async function wikiSearch(title: string) {
  const url = new URL(WIKIPEDIA_API); url.searchParams.set('action','query'); url.searchParams.set('list','search'); url.searchParams.set('srsearch',title); url.searchParams.set('srnamespace','0'); url.searchParams.set('srlimit','8'); url.searchParams.set('format','json');
  const response = await fetch(url, { headers: { 'User-Agent': 'OneBase/1.0 episode updater (+https://github.com/pan23o/anime-tracker)' } }); if (!response.ok) throw new Error(`Wikipedia search ${response.status}`);
  const data = await response.json(), wanted = normalizeTitle(title), pages = data?.query?.search || []; const exact = pages.find((page: any) => normalizeTitle(page.title) === wanted); if (exact?.title) return exact.title;
  return pages.find((page: any) => { const found = normalizeTitle(page.title); return found.includes(wanted) || wanted.includes(found); })?.title || null;
}
async function wikiPageText(pageTitle: string) { if (!pageTitle) return ''; const url = new URL(WIKIPEDIA_API); url.searchParams.set('action','parse'); url.searchParams.set('page',pageTitle); url.searchParams.set('prop','wikitext'); url.searchParams.set('format','json'); const response = await fetch(url, { headers: { 'User-Agent': 'OneBase/1.0 episode updater (+https://github.com/pan23o/anime-tracker)' } }); if (!response.ok) throw new Error(`Wikipedia parse ${response.status}`); const data = await response.json(); return data?.parse?.wikitext?.['*'] || ''; }
function pickEpisodeNumber(text: string) { const source = String(text || ''); const patterns = [/\|\s*(?:n[úu]mero[_\s]*de[_\s]*episodios?|num(?:ero)?[_\s]*de[_\s]*episodios?|n[úu]mero[_\s]*episodios?|episodios?|episodes?|num[_\s]*episodes?)\s*=\s*(?:\{\{[^}]*\}\}\s*)?(?:\[\[[^\]]+\]\]\s*)?(\d{1,4})\b/i,/(?:n[úu]mero|number)\s+de\s+episodios?\s*[:：=]\s*(\d{1,4})\b/i,/(?:total\s+de\s+episodios?|total\s+episodes?)\s*[:：=]\s*(\d{1,4})\b/i]; for (const pattern of patterns) { const match = source.match(pattern); if (match) return Number(match[1]); } return null; }
async function currentWikipediaTotal(title: string) { const pageTitle = await wikiSearch(title); if (!pageTitle) return null; const total = pickEpisodeNumber(await wikiPageText(pageTitle)); return Number.isFinite(total) ? { total, pageTitle } : null; }

async function processUser(supabaseAdmin: any, userId: string, subscriptions: any[], vapid: any) {
  const { data: file, error: fileError } = await supabaseAdmin.storage.from(BUCKET).download(`${userId}/library.txt`); if (fileError || !file) return { userId, checked: 0, updates: 0, sent: 0, skipped: 'library-unavailable' };
  const candidates = decodeLibrary(await file.text()).filter(item => { const total = Number(item.total); const watched = Number(item.watched) || 0; return String(item.anime || '').trim() && Number.isFinite(total) && total > 0 && String(item.state || '').toLowerCase() !== 'abandonado' && watched >= 0; }).slice(0, 100);
  let checked = 0, updates = 0, sent = 0;
  for (let i = 0; i < candidates.length; i += 4) {
    const results = await Promise.all(candidates.slice(i, i + 4).map(async item => { try { const currentTotal = Number(item.total); const result = await currentWikipediaTotal(String(item.anime)); checked++; return result && result.total > currentTotal ? { item, currentTotal, nextTotal: result.total } : null; } catch { return null; } }));
    for (const update of results.filter(Boolean) as any[]) {
      updates++; const item = update.item; const key = animeKey(item);
      const { data: inserted, error: insertError } = await supabaseAdmin.from('onebase_episode_notifications').insert({ user_id: userId, anime_key: key, anime_title: String(item.anime), episode: update.nextTotal }).select('id').maybeSingle(); if (insertError || !inserted?.id) continue;
      const payload = JSON.stringify({ title: 'Nuevo episodio en OneBase', body: `${item.anime}: hay ${update.nextTotal - update.currentTotal} episodio${update.nextTotal - update.currentTotal === 1 ? '' : 's'} nuevo${update.nextTotal - update.currentTotal === 1 ? '' : 's'}.`, tag: `onebase-episode-${key}-${update.nextTotal}`, data: { anime: String(item.anime), episode: update.nextTotal, total: update.nextTotal, previousTotal: update.currentTotal } });
      const options = { vapidDetails: { subject: VAPID_SUBJECT, publicKey: vapid.publicKey, privateKey: vapid.privateKey }, TTL: 604800, urgency: 'high' as const }; let delivered = false;
      for (const subscriptionRow of subscriptions) { try { await sendNotification(subscriptionRow.subscription, payload, options); delivered = true; sent++; } catch (error: any) { const status = Number(error?.statusCode || 0); if (status === 404 || status === 410) await supabaseAdmin.from('onebase_push_subscriptions').delete().eq('endpoint', subscriptionRow.endpoint); } }
      if (!delivered) await supabaseAdmin.from('onebase_episode_notifications').delete().eq('id', inserted.id);
    }
  }
  return { userId, checked, updates, sent };
}

export default { fetch: withSupabase({ auth: 'none' }, async (req, ctx) => {
  if (req.method === 'GET') { const url = new URL(req.url); if (url.searchParams.get('config') !== 'vapid') return json({ ok: true, service: 'onebase-episode-cron' }); try { return json({ ok: true, publicKey: (await getVapidKeys(ctx.supabaseAdmin)).publicKey }); } catch (error: any) { return json({ ok: false, error: String(error?.message || error) }, 500); } }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  const { data: state } = await ctx.supabaseAdmin.from('onebase_cron_state').select('last_started_at').eq('id', true).maybeSingle(); const lastStarted = state?.last_started_at ? new Date(state.last_started_at).getTime() : 0; if (lastStarted && Date.now() - lastStarted < 300000) return json({ ok: true, skipped: 'rate-limited', lastStartedAt: state.last_started_at });
  const vapid = await getVapidKeys(ctx.supabaseAdmin); await ctx.supabaseAdmin.from('onebase_cron_state').update({ last_started_at: new Date().toISOString() }).eq('id', true);
  try {
    const { data: subscriptions, error: subscriptionError } = await ctx.supabaseAdmin.from('onebase_push_subscriptions').select('user_id, endpoint, subscription'); if (subscriptionError) throw subscriptionError;
    const grouped = new Map<string, any[]>(); for (const row of subscriptions || []) grouped.set(row.user_id, [...(grouped.get(row.user_id) || []), row]);
    const results = []; for (const [userId, userSubscriptions] of grouped.entries()) results.push(await processUser(ctx.supabaseAdmin, userId, userSubscriptions, vapid));
    const result = { ok: true, users: grouped.size, checked: results.reduce((sum, row) => sum + Number(row.checked || 0), 0), updates: results.reduce((sum, row) => sum + Number(row.updates || 0), 0), sent: results.reduce((sum, row) => sum + Number(row.sent || 0), 0), finishedAt: new Date().toISOString() };
    await ctx.supabaseAdmin.from('onebase_cron_state').update({ last_finished_at: result.finishedAt, last_result: result }).eq('id', true); return json(result);
  } catch (error: any) { const result = { ok: false, error: String(error?.message || error), finishedAt: new Date().toISOString() }; await ctx.supabaseAdmin.from('onebase_cron_state').update({ last_finished_at: result.finishedAt, last_result: result }).eq('id', true); return json(result, 500); }
}) };
