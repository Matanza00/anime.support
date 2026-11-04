# Last deploy: success

- When: 2026-11-04T22:01:23Z
- Commit: c54d234
- Run: https://github.com/Matanza00/anime.support/actions/runs/41921383316

```
> anime-support-web@1.0.0 build
> next build

▲ Next.js 16.4.5 (Turbopack)
- Environments: .env.production
✓ Running next.config.mjs took 17ms
⚠ No build cache found. Please configure build caching for faster rebuilds. Read more: https://nextjs.org/docs/messages/no-cache
Attention: Next.js now collects completely anonymous telemetry regarding usage.
This information is used to shape Next.js' roadmap and prioritize features.
You can learn more, including how to opt-out if you'd not like to participate in this anonymous program, by visiting the following URL:
https://nextjs.org/telemetry


  Creating an optimized production build ...
✓ Compiled successfully in 3.3s
  Running TypeScript ...
  Finished TypeScript in 4ms ...
  Collecting page data using 3 workers ...
[db] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN *** missing: building with no articles.
[db] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN *** missing: building with no articles.
[db] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN *** missing: building with no articles.
  Generating static pages using 3 workers (0/26) ...
[db] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN *** missing: building with no articles.
  Generating static pages using 3 workers (6/26) 
  Generating static pages using 3 workers (12/26) 
[db] CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN *** missing: building with no articles.
  Generating static pages using 3 workers (19/26) 
✓ Generating static pages using 3 workers (26/26) in 583ms
  Finalizing page optimization ...

Route (app)
┌ ○ /
├ ○ /_not-found
├ ○ /about
├ ○ /ads.txt
├ ○ /anime
├   /anime/[tag]
│ └ ● /anime/__none
├ ○ /calendar
├ ○ /contact
├ ○ /features
├   /features/page/[n]
│ └ ● /features/page/2
├ ○ /news
├ ○ /news-sitemap.xml
├   /news/[slug]
│ └ ● /news/__none
├   /news/page/[n]
│ └ ● /news/page/2
├ ○ /privacy
├ ○ /releases
├   /releases/page/[n]
│ └ ● /releases/page/2
├ ○ /robots.txt
├ ○ /rss.xml
├ ○ /search
├ ○ /search-index.json
├ ○ /sitemap.xml
├ ○ /terms
├ ○ /upcoming
└   /upcoming/page/[n]
  └ ● /upcoming/page/2


○  (Static)  prerendered as static content
●  (SSG)     prerendered as static HTML (uses generateStaticParams)


 ⛅️ wrangler 4.157.0
────────────────────

Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md

[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mIn a non-interactive environment, it's necessary to set a CLOUDFLARE_API_TOKEN *** environment variable for wrangler to work. Please go to https://developers.cloudflare.com/fundamentals/api/get-started/create-token *** for instructions on how to create an api token *** and assign its value to CLOUDFLARE_API_TOKEN ***

  
  To continue without logging in, rerun this command with `--temporary`. Wrangler will use a temporary account and print a claim URL.


🪵  Logs were written to "/home/runner/.config/.wrangler/logs/wrangler-2026-11-04_22-01-23_220.log"
```
