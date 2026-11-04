// anime.support Worker. Static pages and images are served straight from Cloudflare's asset store;
// this code runs only for /api/* (see run_worker_first in wrangler.jsonc).
const SITE = 'https://anime.support';

export default {
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
