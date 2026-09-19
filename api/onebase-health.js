module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  return res.status(200).setHeader('Cache-Control','no-store').json({
    ok: true,
    service: 'onebase',
    version: 'premium-v1',
    time: new Date().toISOString()
  });
};