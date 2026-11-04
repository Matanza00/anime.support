# Last deploy: failure

- When: 2026-11-04T22:12:31Z
- Commit: a268002
- Run: https://github.com/Matanza00/anime.support/actions/runs/41923111262

```
+ /contact/__next.contact.__PAGE__.txt
+ /calendar/__next.calendar.__PAGE__.txt
+ /anime/__next._full.txt
+ /terms/__next._full.txt
+ /about/__next.about.__PAGE__.txt
+ /upcoming/__next.upcoming.__PAGE__.txt
+ /launch/how-manga-becomes-anime-adaptation-explained.webp
+ /releases/page/2/__next.releases.page.$d$n.__PAGE__.txt
+ /launch/anime-spoiler-etiquette-guide.webp
+ /_next/static/media/unbounded-vietnamese-wght-normal.2vkv9zvo-i28x.woff2
+ /features/page/2/__next._full.txt
+ /launch/anime-announcement-terms-key-visual-pv-teaser.webp
+ /launch/how-to-follow-anime-news-without-falling-for-fake-leaks.webp
+ /launch/sub-vs-dub-what-simulcast-means.webp
+ /_next/static/media/inter-greek-wght-normal.1rx9vjatjkdar.woff2
+ /search/index.html
+ /launch/anime-seasons-explained-winter-spring-summer-fall.webp
+ /contact/index.html
+ /__next._full.txt
+ /news/sub-vs-dub-what-simulcast-means/__next.news.$d$slug.__PAGE__.txt
+ /news/anime-seasons-explained-winter-spring-summer-fall/__next.news.$d$slug.__PAGE__.txt
+ /news/anime-spoiler-etiquette-guide/__next._full.txt
+ /news/how-to-follow-anime-news-without-falling-for-fake-leaks/__next._full.txt
+ /releases/index.html
+ /news/page/2/index.html
+ /releases/page/2/index.html
+ /sample/lotus.jpg
+ /sample/crimson.jpg
+ /news/index.html
+ /index.html
+ /news/sub-vs-dub-what-simulcast-means/index.html
   (truncating changed assets log, set `WRANGLER_LOG=debug` environment variable to see full diff)
Uploaded 52 of 155 assets
Uploaded 104 of 155 assets
Uploaded 155 of 155 assets
✨ Success! Uploaded 155 files (27 already uploaded) (2.63 sec)

Total Upload: 1.25 KiB / gzip: 0.62 KiB
Worker Startup Time: 2 ms
Your Worker has access to the following bindings:
Binding                         Resource         
env.DB (anime-support)          D1 Database      
env.ASSETS                      Assets           

Uploaded anime-support (7.00 sec)
No targets deployed for anime-support (1.37 sec)

Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md

[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mTrigger configuration for "anime-support" was only partially updated:[0m

  
    Custom domains:
      - A request to the Cloudflare API (/accounts/bbc4b9b4aec93bd6347b548581c3d11f/workers/scripts/anime-support/domains/records) failed.
        - Hostname 'anime.support' already has externally managed DNS records (A, CNAME, etc). Delete them first or try a different hostname. [code: 100117]
  
  Successful trigger changes were not rolled back.


🪵  Logs were written to "/home/runner/.config/.wrangler/logs/wrangler-2026-11-04_22-12-21_692.log"
```
