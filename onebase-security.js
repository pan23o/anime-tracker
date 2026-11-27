/* Shared validation for profile images. Never interpret profile fields as HTML. */
(function (root) {
  'use strict';
  function avatarUrl(value) {
    const url = String(value || '').trim();
    // Avatars are uploaded raster images. SVG/HTML and remote tracking URLs are not avatars.
    return url.length <= 2800000 && /^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/]+={0,2}$/i.test(url) ? url : '';
  }
  function renderAvatar(element, value, fallback) {
    if (!element) return;
    element.replaceChildren();
    const url = avatarUrl(value);
    if (!url) { element.textContent = String(fallback || 'OB'); return; }
    const image = element.ownerDocument.createElement('img');
    image.src = url;
    image.alt = 'Foto de perfil';
    image.addEventListener('error', () => { element.textContent = String(fallback || 'OB'); }, { once: true });
    element.appendChild(image);
  }
  const api = { avatarUrl, renderAvatar };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.OneBaseSecurity = api;
})(typeof window === 'undefined' ? globalThis : window);
