// anime.support Worker. Static pages and images are served straight from Cloudflare's asset store;
// this code runs only for /api/* (see run_worker_first in wrangler.jsonc).
const SITE = 'https://anime.support';
const REPO = 'Matanza00/anime.support';

// Cloudflare cron → start the GitHub "News bot" workflow on time (GitHub's own timer often skips runs).
// Which task each cron runs: see "triggers" in wrangler.jsonc.
const CRON_TASKS = {
  '17 */2 * * *': 'collect-and-publish',
  '41 1 * * *': 'catalog',
  '23 22 * * SUN': 'optimize',
};

async function dispatch(env, task) {
  if (!env.GH_DISPATCH_TOKEN) return console.log('GH_DISPATCH_TOKEN not set; skipping', task);
  const res = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/bot.yml/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GH_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'anime.support-cron',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ ref: 'main', inputs: { task } }),
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch ${task}: HTTP ${res.status} ${await res.text()}`);
  console.log('dispatched', task);
}

export default {
  async scheduled(event, env, ctx) {
    const task = CRON_TASKS[event.cron];
    if (task) ctx.waitUntil(dispatch(env, task));
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    // POST /api/view {slug}: one anonymous view (the page sends it once per browser session)
    if (url.pathname === '/api/view') {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      const origin = request.headers.get('Origin');
      if (origin && origin !== SITE && origin !== 'https://www.anime.support') return new Response(null, { status: 403 });
      const { slug } = await request.json().catch(() => ({}));
      if (typeof slug !== 'string' || !/^[a-z0-9-]{1,200}$/.test(slug)) return new Response(null, { status: 400 });
      const row = await env.DB.prepare("UPDATE articles SET views = views + 1 WHERE slug = ? AND status = 'published' RETURNING id")
        .bind(slug)
        .first();
      if (row) {
        await env.DB.prepare(
          "INSERT INTO article_views_daily (article_id, day, views) VALUES (?, date('now'), 1) ON CONFLICT(article_id, day) DO UPDATE SET views = views + 1",
        )
          .bind(row.id)
          .run();
      }
      return new Response(null, { status: 204 });
    }

    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
