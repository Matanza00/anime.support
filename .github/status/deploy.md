# Last deploy: failure

- When: 2026-11-05T09:16:42Z
- Commit: 6bd3532
- Run: https://github.com/Matanza00/anime.support/actions/runs/42000966207

```
+ /anime/browse/c/index.html
+ /anime/browse/f/index.html
+ /anime/browse/i/index.html
+ /anime/browse/l/index.html
+ /anime/browse/o/index.html
+ /anime/browse/z/index.html
+ /anime/browse/q/index.html
+ /anime/browse/t/index.html
+ /anime/browse/w/index.html
+ /anime/index.html
+ /index.html
+ /news/anime-announcement-terms-key-visual-pv-teaser/index.html
+ /news/anime-seasons-explained-winter-spring-summer-fall/index.html
+ /media/articles/black-clover-season-2-episode-6-previews-intense-battle-with-vanica-k65s/card-mw2ok6ia.jpg
+ /media/articles/my-dress-up-darling-unveils-stunning-1-32-million-life-size-marin-kitagawa-figur-jtd0/card-mw2ojto2.jpg
+ /media/articles/mashle-live-action-film-set-for-march-2027-premiere-with-mackenyu-as-mash-i6a4/card-mw2xi6iy.jpg
+ /media/articles/reincarnation-in-the-game-world-dan-katsu-unveils-new-trailer-and-cast-ahead-of-jmm3/card-mw2ojmzo.jpg
+ /news/__next._tree.txt
+ /terms/__next._tree.txt
+ /contact/__next._tree.txt
+ /calendar/__next._tree.txt
+ /schedule/__next._tree.txt
+ /_next/static/kZMvFXPrf4z5aejV-DLuw/_ssgManifest.js
+ /season/winter-2027/__next._tree.txt
+ /features/page/2/__next._tree.txt
+ /anime/browse/a/__next._tree.txt
+ /anime/browse/d/__next._tree.txt
+ /anime/browse/g/__next._tree.txt
+ /anime/browse/j/__next._tree.txt
   (truncating changed assets log, set `WRANGLER_LOG=debug` environment variable to see full diff)
Uploaded 87 of 262 assets
Uploaded 175 of 262 assets
Uploaded 262 of 262 assets
✨ Success! Uploaded 262 files (114 already uploaded) (2.07 sec)

Total Upload: 2.35 KiB / gzip: 1.17 KiB
Worker Startup Time: 2 ms
Your Worker has access to the following bindings:
Binding                         Resource         
env.DB (anime-support)          D1 Database      
env.ASSETS                      Assets           

Uploaded anime-support (5.01 sec)
Deployed anime-support triggers (1.08 sec)
  anime.support (custom domain)
  www.anime.support (custom domain)

Cloudflare collects anonymous telemetry about your usage of Wrangler. Learn more at https://github.com/cloudflare/workers-sdk/tree/main/packages/wrangler/telemetry.md

[31m✘ [41;31m[[41;97mERROR[41;31m][0m [1mTrigger configuration for "anime-support" was only partially updated:[0m

  
    Cron schedules:
      - A request to the Cloudflare API (/accounts/bbc4b9b4aec93bd6347b548581c3d11f/workers/scripts/anime-support/schedules) failed.
        - invalid cron string: 23 22 * * 0 [code: 10100]
  
  Successful trigger changes were not rolled back.


🪵  Logs were written to "/home/runner/.config/.wrangler/logs/wrangler-2026-11-05_09-16-35_404.log"
```
