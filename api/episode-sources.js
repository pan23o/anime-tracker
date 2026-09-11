const SOURCES = [
  { name: 'Nyaa', build: (title, episode) => `https://nyaa.si/?f=0&c=0_0&q=${encodeURIComponent(`${title} ${String(episode).padStart(2, '0')}`)}` },
  { name: 'SubPlease', build: (title, episode) => `https://subplease.org/?s=${encodeURIComponent(`${title} ${String(episode).padStart(2, '0')}`)}` },
  { name: 'EXT.to', build: (title, episode) => `https://ext.to/?q=${encodeURIComponent(`${title} ${String(episode).padStart(2, '0')}`)}` }
];
export default function handler(req, res) {
  const title = String(req.query?.title || '').trim();
  const episode = Number(req.query?.episode);
  if (!title || !Number.isInteger(episode) || episode < 1) return res.status(400).json({ error: 'Invalid title or episode' });
  return res.status(200).json({ title, episode, sources: SOURCES.map(source => ({ name: source.name, url: source.build(title, episode) })) });
}
