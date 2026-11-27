import { createHash } from 'node:crypto';

export function protectHtml(html) {
  html = html.replace(/\r\n?/g, '\n');
  const hashes = [...html.matchAll(/<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(match => "'sha256-" + createHash('sha256').update(match[1]).digest('base64') + "'");
  const policy = [
    "default-src 'none'",
    "script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.2 " + hashes.join(' '),
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https://djfjqecahztogacliavh.supabase.co wss://djfjqecahztogacliavh.supabase.co https://graphql.anilist.co https://es.wikipedia.org",
    "media-src 'self' data: blob:",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; ');
  // Keep this ahead of all executable scripts. Inline code is authorized by its content hash.
  return html.replace(/<head>/i, '<head>\n<meta http-equiv="Content-Security-Policy" content="' + policy + '">');
}
