import { withSupabase } from 'npm:@supabase/server@1.0.0';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS' };
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export default { fetch: withSupabase({ auth: 'user' }, async (req, ctx) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST' && req.method !== 'DELETE') return response({ error: 'Method not allowed' }, 405);
  const userId = ctx.userClaims?.sub; if (!userId) return response({ error: 'Unauthorized' }, 401);

  if (req.method === 'DELETE') {
    let endpoint = ''; try { endpoint = String((await req.json())?.endpoint || '').trim(); } catch {}
    if (!endpoint) return response({ error: 'endpoint is required' }, 400);
    const { error } = await ctx.supabase.from('onebase_push_subscriptions').delete().eq('user_id', userId).eq('endpoint', endpoint);
    if (error) return response({ error: error.message }, 500);
    return response({ ok: true });
  }

  let body: any; try { body = await req.json(); } catch { return response({ error: 'Invalid JSON' }, 400); }
  const subscription = body?.subscription; const endpoint = String(subscription?.endpoint || '').trim(); const p256dh = String(subscription?.keys?.p256dh || '').trim(); const auth = String(subscription?.keys?.auth || '').trim();
  if (!endpoint || !p256dh || !auth) return response({ error: 'Invalid PushSubscription' }, 400);
  const { error } = await ctx.supabase.from('onebase_push_subscriptions').upsert({ user_id: userId, endpoint, subscription: { endpoint, expirationTime: subscription.expirationTime ?? null, keys: { p256dh, auth } }, updated_at: new Date().toISOString() }, { onConflict: 'user_id,endpoint' });
  if (error) return response({ error: error.message }, 500);
  return response({ ok: true });
}) };
