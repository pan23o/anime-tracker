const SOURCES = {
  Nyaa: (title, episode) => `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(`${title} ${String(episode).padStart(2, '0')}`)}`,
  SubPlease: (title, episode) => `https://subplease.org/?s=${encodeURIComponent(title)}+${String(episode).padStart(2, '0')}`,
  'EXT.to': (title, episode) => `https://ext.to/?q=${encodeURIComponent(`${title} ${String(episode).padStart(2, '0')}`)}`
};

export default function handler(req, res) {
  const title = String(req.query?.title || req.body?.title || '').trim();
  const episode = Number(req.query?.episode || req.body?.episode);
  if (!title || !Number.isFinite(episode) || episode < 1) {
    return res.status(400).json({ error: 'title and episode are required' });
  }

  const results = Object.entries(SOURCES).map(([name, build]) => ({
    name,
    url: build(title, episode)
  }));
  return res.status(200).json({ ok: true, title, episode, results });
}
