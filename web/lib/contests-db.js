// Build-time list of published contests (the live parts of each page load from /api in the browser).
import { d1Configured, query } from './d1.js';

export const CATEGORY_LABEL = { '2d-art': '2D artwork', '3d-character': '3D character', '3d-environment': '3D environment', motion: 'Motion & animation' };

const SAMPLE = [
  { id: 1, slug: 'sample-2d-hero', title: 'Original Anime Hero', category: '2d-art', theme: 'Design the hero of an anime that does not exist yet', description: 'Sample contest for previewing the design.\n\nSecond paragraph of the brief.', prize: 'US$100 + featured on the home page', prize_usd: 100, allow_fan_art: 0, submit_opens_at: '2026-11-01T00:00:00.000Z', submit_closes_at: '2026-12-10T23:59:00.000Z', vote_closes_at: '2026-12-17T23:59:00.000Z', status: 'published' },
  { id: 2, slug: 'sample-3d-mecha', title: 'Mecha or Magic: 3D Character', category: '3d-character', theme: 'An original pilot, mecha or magical fighter', description: 'Sample.', prize: 'US$100', prize_usd: 100, allow_fan_art: 0, submit_opens_at: '2026-10-01T00:00:00.000Z', submit_closes_at: '2026-11-01T23:59:00.000Z', vote_closes_at: '2026-12-08T23:59:00.000Z', status: 'published' },
];

let cache;
export async function publishedContests() {
  if (cache) return cache;
  if (process.env.SAMPLE_DATA === '1') return (cache = SAMPLE);
  if (!d1Configured()) return (cache = []);
  try {
    cache = await query("SELECT * FROM contests WHERE status = 'published' ORDER BY submit_opens_at DESC LIMIT 200");
  } catch (err) {
    console.warn(`[contests] ${err.message}`);
    cache = [];
  }
  return cache;
}

export function phaseAt(c, now = new Date().toISOString()) {
  if (now < c.submit_opens_at) return 'upcoming';
  if (now < c.submit_closes_at) return 'submissions';
  if (now < c.vote_closes_at) return 'voting';
  return 'results';
}
