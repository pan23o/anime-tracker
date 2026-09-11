// Reserved cron entrypoint for the server-side update pipeline.
// The current library is user-scoped in Supabase, so this endpoint intentionally
// does not guess credentials or scan another user's private data. The client-side
// checker is the safe fallback until a server-side service role + push subscription
// table is configured.
export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  return res.status(200).json({ ok: true, status: 'ready', message: 'OneBase episode update worker is ready for the account notification pipeline.' });
}
