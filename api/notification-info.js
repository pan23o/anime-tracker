export default function handler(req, res) {
  const title = String(req.query?.title || '').trim();
  const episode = Number(req.query?.episode);
  if (!title || !Number.isInteger(episode) || episode < 1) return res.status(400).json({ error: 'Invalid episode' });
  res.status(200).json({ ok: true, title, episode, message: `Nuevo episodio: ${title} #${episode}` });
}
