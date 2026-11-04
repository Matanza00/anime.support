// Creates ORIGINAL images for every article, automatically:
//   1. hero image  (1600×900, no text) – AI illustration, or procedural art when AI is off/fails.
//      Used as the cover, og:image and Google Discover image (Google advises no text on these).
//   2. social card (1200×630, with headline) – for the Facebook post.
// Both are uploaded to Supabase Storage. Nothing copies studio artwork, so there is no rights risk.
import sharp from 'sharp';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { CONFIG } from './config.js';
import { uploadBuffer } from './storage.js';
import { warn, log } from './log.js';

const require = createRequire(import.meta.url);

/* ---------- helpers ---------- */

/** Small deterministic PRNG so the same slug always gives the same artwork. */
function rng(seedText) {
  let h = 2166136261;
  for (const ch of String(seedText)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hueFor(text = '') {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

const hsl = (h, s, l) => `hsl(${((h % 360) + 360) % 360} ${s}% ${l}%)`;

/* ---------- 1a. procedural art (free, always works) ---------- */

const MOTIFS = ['mountains', 'torii', 'city', 'sea', 'sakura'];

/** Returns an SVG string of an original night/dusk landscape, unique per seed. */
export function proceduralSvg({ seed, hue, motif, w = 1600, h = 900 }) {
  const r = rng(seed);
  motif = motif || MOTIFS[Math.floor(r() * MOTIFS.length)];
  const sky1 = hsl(hue + 220, 55, 10);
  const sky2 = hsl(hue, 55, 34);
  const glow = hsl(hue + 30, 95, 68);
  const moonX = w * (0.55 + r() * 0.3);
  const moonY = h * (0.2 + r() * 0.15);
  const moonR = h * (0.09 + r() * 0.06);

  const stars = Array.from({ length: 140 }, () => {
    const x = r() * w;
    const y = r() * h * 0.62;
    const s = r() < 0.85 ? 1.2 : 2.4;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${s}" fill="#fff" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`;
  }).join('');

  const ridge = (base, amp, freq, color, jag = 18, skyline = false) => {
    let d = `M0 ${h}`;
    for (let x = 0; x <= w + 40; x += 40) {
      let y = h * base + Math.sin(x / freq + r() * 0.3) * amp + (r() - 0.5) * jag;
      if (skyline) y = h * base - [0, 40, 90, 150, 60, 110][Math.floor(r() * 6)];
      d += skyline ? ` L${x} ${y.toFixed(0)} L${x + 40} ${y.toFixed(0)}` : ` L${x} ${y.toFixed(0)}`;
    }
    return `<path d="${d} L${w} ${h} Z" fill="${color}"/>`;
  };

  let foreground = '';
  if (motif === 'torii') {
    const x = w * (0.18 + r() * 0.2);
    const red = hsl(352, 70, 45);
    foreground = `<g fill="${red}"><rect x="${x}" y="${h * 0.45}" width="${w * 0.018}" height="${h * 0.45}"/>
      <rect x="${x + w * 0.17}" y="${h * 0.45}" width="${w * 0.018}" height="${h * 0.45}"/>
      <rect x="${x - w * 0.03}" y="${h * 0.42}" width="${w * 0.248}" height="${h * 0.035}" rx="6"/>
      <rect x="${x - w * 0.01}" y="${h * 0.5}" width="${w * 0.208}" height="${h * 0.022}"/></g>`;
  }
  if (motif === 'sakura') {
    foreground = Array.from({ length: 70 }, () => {
      const x = r() * w;
      const y = r() * h;
      const s = 4 + r() * 8;
      return `<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${s}" ry="${(s * 0.6).toFixed(1)}" fill="${hsl(340, 80, 82)}" opacity="${(0.5 + r() * 0.5).toFixed(2)}" transform="rotate(${(r() * 180).toFixed(0)} ${x.toFixed(0)} ${y.toFixed(0)})"/>`;
    }).join('');
  }
  const sea =
    motif === 'sea'
      ? `<rect x="0" y="${h * 0.66}" width="${w}" height="${h * 0.34}" fill="${hsl(hue + 200, 50, 12)}"/>
         ${Array.from({ length: 12 }, (_, i) => `<rect x="${moonX - 120 + r() * 60}" y="${h * 0.68 + i * 20}" width="${160 - i * 9}" height="3" rx="1.5" fill="${glow}" opacity="${(0.7 - i * 0.05).toFixed(2)}"/>`).join('')}`
      : '';

  const layers =
    motif === 'sea'
      ? ridge(0.6, 30, 260, hsl(hue + 230, 35, 16), 10)
      : ridge(0.6, 50, 180, hsl(hue + 250, 30, 24)) +
        ridge(0.7, 40, 240, hsl(hue + 250, 35, 15)) +
        (motif === 'city' ? ridge(0.82, 0, 1, hsl(hue + 250, 40, 7), 0, true) : ridge(0.83, 30, 300, hsl(hue + 250, 40, 7)));

  const windows =
    motif === 'city'
      ? Array.from({ length: 90 }, () => `<rect x="${(r() * w).toFixed(0)}" y="${(h * 0.7 + r() * h * 0.28).toFixed(0)}" width="5" height="7" fill="${glow}" opacity="${(0.4 + r() * 0.6).toFixed(2)}"/>`).join('')
      : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky1}"/><stop offset="1" stop-color="${sky2}"/></linearGradient>
    <radialGradient id="glow"><stop offset="0" stop-color="${glow}" stop-opacity=".8"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  ${stars}
  <circle cx="${moonX}" cy="${moonY}" r="${moonR * 3}" fill="url(#glow)"/>
  <circle cx="${moonX}" cy="${moonY}" r="${moonR}" fill="${hsl(hue + 40, 100, 88)}"/>
  ${layers}${sea}${windows}${foreground}
</svg>`;
}

export async function proceduralImage(opts) {
  return sharp(Buffer.from(proceduralSvg(opts))).webp({ quality: 82 }).toBuffer();
}

/* ---------- 1b. AI illustration (OpenRouter or OpenAI) ---------- */

const STYLE =
  'Original anime-style key art illustration, cinematic wide composition, rich lighting, detailed background, high quality. ' +
  'Must be an ORIGINAL scene: do not depict any existing anime or manga character, mascot, logo, title lettering or recognisable copyrighted design. ' +
  'No text, no words, no watermark, no signature.';

async function aiImage(scenePrompt) {
  const { provider, model, apiKey, baseURL } = CONFIG.images;
  if (provider === 'none' || !apiKey) return null;
  const prompt = `${STYLE}\nScene: ${scenePrompt}`;
  let url, body;
  if (provider === 'openai') {
    url = 'https://api.openai.com/v1/images/generations';
    body = { model: model || 'gpt-image-1', prompt, size: '1536x1024', n: 1 };
  } else {
    url = `${baseURL.replace(/\/$/, '')}/images`;
    body = { model: model || 'google/gemini-2.5-flash-image', prompt, aspect_ratio: '16:9' };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error?.message || `image API HTTP ${res.status}`);
  const item = json.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) return Buffer.from(await (await fetch(item.url)).arrayBuffer());
  throw new Error('image API returned no image');
}

/* ---------- 2. social card with headline ---------- */

let fonts;
async function loadFonts() {
  if (fonts) return fonts;
  const f = (p) => fs.readFile(require.resolve(p));
  fonts = [
    { name: 'Display', data: await f('@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Body', data: await f('@fontsource/inter/files/inter-latin-400-normal.woff'), weight: 400, style: 'normal' },
    { name: 'Body', data: await f('@fontsource/inter/files/inter-latin-700-normal.woff'), weight: 700, style: 'normal' },
  ];
  return fonts;
}

const CATEGORY = { news: 'NEWS', upcoming: 'UPCOMING', release: 'OUT NOW', feature: 'FEATURE' };

export async function socialCard({ title, anime, category, heroBuffer }) {
  const bg = await sharp(heroBuffer).resize(1200, 630, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
  const bgUri = `data:image/jpeg;base64,${bg.toString('base64')}`;
  const size = title.length > 80 ? 52 : title.length > 55 ? 60 : 68;
  const el = (type, style, children) => ({ type, props: { style, children } });
  const tree = el(
    'div',
    { width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: 'Body', color: '#fff' },
    [
      { type: 'img', props: { src: bgUri, width: 1200, height: 630, style: { position: 'absolute', top: 0, left: 0 } } },
      el('div', { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(8,8,14,0.15) 0%, rgba(8,8,14,0.55) 45%, rgba(8,8,14,0.95) 100%)' }, []),
      el('div', { position: 'absolute', left: 64, right: 64, bottom: 56, display: 'flex', flexDirection: 'column', gap: 18 }, [
        el('div', { display: 'flex', gap: 12, alignItems: 'center' }, [
          el('div', { display: 'flex', background: '#ff4d8d', color: '#1a0610', fontWeight: 700, fontSize: 22, padding: '6px 14px', borderRadius: 999, letterSpacing: 2 }, CATEGORY[category] || 'NEWS'),
          anime ? el('div', { display: 'flex', fontSize: 24, fontWeight: 700, color: '#ffd1e2' }, anime) : null,
        ].filter(Boolean)),
        el('div', { display: 'flex', fontFamily: 'Display', fontSize: size, lineHeight: 1.05, letterSpacing: -1.5 }, title),
        el('div', { display: 'flex', fontSize: 24, color: '#cfcde0' }, [
          el('span', { color: '#fff', fontWeight: 700 }, 'anime'),
          el('span', { color: '#ff4d8d', fontWeight: 700 }, '.support'),
        ]),
      ]),
    ],
  );
  const svg = await satori(tree, { width: 1200, height: 630, fonts: await loadFonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  return sharp(png).jpeg({ quality: 86, mozjpeg: true }).toBuffer();
}

/* ---------- orchestration ---------- */

/**
 * Makes and uploads both images for a draft.
 * Returns { cover_url, cover_credit, social_card_url }; never throws (falls back to procedural art).
 */
export async function createArtwork({ slug, title, anime = [], category, imagePrompt }) {
  const hue = hueFor(anime[0] || title);
  let hero = null;
  let credit = `Illustration: ${CONFIG.siteName}`;
  if (imagePrompt) {
    try {
      const raw = await aiImage(imagePrompt);
      if (raw) {
        hero = await sharp(raw).resize(1600, 900, { fit: 'cover' }).webp({ quality: 82 }).toBuffer();
        credit = `AI illustration: ${CONFIG.siteName}`;
      }
    } catch (err) {
      warn(`AI image failed (${err.message}); using procedural art`);
    }
  }
  if (!hero) hero = await proceduralImage({ seed: slug, hue });

  try {
    const card = await socialCard({ title, anime: anime[0], category, heroBuffer: hero });
    const v = Date.now().toString(36); // new name each time, so caches never show an old image
    const [cover_url, social_card_url] = await Promise.all([
      uploadBuffer(hero, `articles/${slug}/hero-${v}.webp`, 'image/webp'),
      uploadBuffer(card, `articles/${slug}/card-${v}.jpg`, 'image/jpeg'),
    ]);
    log(`Artwork ready for ${slug}`);
    return { cover_url, cover_credit: credit, social_card_url };
  } catch (err) {
    warn(`Artwork upload failed for ${slug}: ${err.message}`);
    return { cover_url: null, cover_credit: null, social_card_url: null };
  }
}

/**
 * Re-renders the Facebook card from the article's CURRENT headline and cover
 * (run on approval, so edits in the dashboard are always reflected).
 */
export async function refreshSocialCard({ slug, title, anime = [], category, coverUrl }) {
  let hero = null;
  if (coverUrl) {
    try {
      const res = await fetch(coverUrl, { signal: AbortSignal.timeout(20000) });
      if (res.ok) hero = Buffer.from(await res.arrayBuffer());
    } catch {
      /* fall back below */
    }
  }
  if (!hero) hero = await proceduralImage({ seed: slug, hue: hueFor(anime[0] || title) });
  const card = await socialCard({ title, anime: anime[0], category, heroBuffer: hero });
  return uploadBuffer(card, `articles/${slug}/card-${Date.now().toString(36)}.jpg`, 'image/jpeg');
}
