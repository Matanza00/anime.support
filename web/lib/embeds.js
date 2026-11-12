// Turns media items and pasted URLs into embed HTML.
// classifyUrl is kept in sync with bot/src/media.js.

export function classifyUrl(raw) {
  let u;
  try {
    u = new URL(String(raw).trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '');
  let m;
  if (host === 'youtu.be') return { type: 'youtube', id: u.pathname.slice(1, 12), url: u.href };
  if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
    const id = u.searchParams.get('v') || ((m = u.pathname.match(/\/(?:embed|shorts|live)\/([\w-]{11})/)) && m[1]);
    return id ? { type: 'youtube', id, url: `https://www.youtube.com/watch?v=${id}` } : null;
  }
  if ((host === 'x.com' || host === 'twitter.com') && (m = u.pathname.match(/^\/(\w+)\/status\/(\d+)/)))
    return { type: 'x', id: m[2], url: `https://x.com/${m[1]}/status/${m[2]}` };
  if (host === 'instagram.com' && (m = u.pathname.match(/^\/(p|reel)\/([\w-]+)/)))
    return { type: 'instagram', id: m[2], url: `https://www.instagram.com/${m[1]}/${m[2]}/` };
  if (host === 'tiktok.com' && (m = u.pathname.match(/\/video\/(\d+)/))) return { type: 'tiktok', id: m[1], url: u.href };
  if (/\.(mp4|webm)$/i.test(u.pathname)) return { type: 'video', url: u.href };
  if (/\.(jpe?g|png|webp|avif|gif)$/i.test(u.pathname)) return { type: 'image', url: u.href };
  return null;
}

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Third-party scripts each embed type needs (loaded once per page). */
export const EMBED_SCRIPTS = {
  x: 'https://platform.twitter.com/widgets.js',
  instagram: 'https://www.instagram.com/embed.js',
  tiktok: 'https://www.tiktok.com/embed.js',
};

function caption(item) {
  const parts = [item.caption, item.credit].filter(Boolean).map(esc);
  return parts.length ? `<figcaption>${parts.join(' · ')}</figcaption>` : '';
}

/** One media item → HTML. `scripts` collects the third-party scripts the page must load. */
export function renderEmbed(raw, scripts = new Set()) {
  if (raw.type === 'html') return `<div class="embed embed-html">${raw.html}</div>`;
  const item = { ...raw, ...(classifyUrl(raw.url) ?? {}) };
  switch (item.type) {
    case 'youtube':
      // Lightweight "facade": a thumbnail until the reader taps play, so pages stay fast.
      return `<figure class="embed"><div class="yt" data-yt="${esc(item.id)}">
        <img src="https://i.ytimg.com/vi/${esc(item.id)}/hqdefault.jpg" alt="${esc(item.caption || 'Video')}" loading="lazy" width="480" height="360">
        <button type="button" class="yt-play" aria-label="Play video"><svg viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7A8.5 8.5 0 0 0 60.5 1.7C55.2.3 34 .3 34 .3S12.8.3 7.5 1.7A8.5 8.5 0 0 0 1.5 7.7C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3Z" fill="#f00"/><path d="M45 24 27 14v20Z" fill="#fff"/></svg></button>
        <noscript><a href="${esc(item.url)}">Watch on YouTube</a></noscript>
      </div>${caption(item)}</figure>`;
    case 'x':
      scripts.add(EMBED_SCRIPTS.x);
      return `<figure class="embed social"><blockquote class="twitter-tweet" data-theme="dark" data-dnt="true"><a href="${esc(item.url)}">View post on X</a></blockquote>${caption(item)}</figure>`;
    case 'instagram':
      scripts.add(EMBED_SCRIPTS.instagram);
      return `<figure class="embed social"><blockquote class="instagram-media" data-instgrm-permalink="${esc(item.url)}" data-instgrm-version="14"><a href="${esc(item.url)}">View on Instagram</a></blockquote>${caption(item)}</figure>`;
    case 'tiktok':
      scripts.add(EMBED_SCRIPTS.tiktok);
      return `<figure class="embed social"><blockquote class="tiktok-embed" cite="${esc(item.url)}" data-video-id="${esc(item.id)}"><a href="${esc(item.url)}">View on TikTok</a></blockquote>${caption(item)}</figure>`;
    case 'video':
      return `<figure class="embed"><video controls preload="metadata" playsinline src="${esc(item.url)}"></video>${caption(item)}</figure>`;
    case 'image':
      return `<figure class="embed"><img src="${esc(item.url)}" alt="${esc(item.caption || item.credit || 'Official image')}" loading="lazy">${caption(item)}</figure>`;
    default:
      return '';
  }
}

/** Several images in a row become a swipeable gallery; everything else renders one by one. */
export function renderMediaList(list = [], scripts = new Set()) {
  const out = [];
  let images = [];
  const flush = () => {
    if (images.length > 1) out.push(`<div class="gallery">${images.map((i) => renderEmbed(i, scripts)).join('')}</div>`);
    else if (images.length) out.push(renderEmbed(images[0], scripts));
    images = [];
  };
  for (const m of list) {
    if (m.type === 'image') images.push(m);
    else {
      flush();
      out.push(renderEmbed(m, scripts));
    }
  }
  flush();
  return out.join('\n');
}
