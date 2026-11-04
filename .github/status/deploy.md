# Last deploy: failure

- When: 2026-11-04T22:10:15Z
- Commit: 99652aa
- Run: https://github.com/Matanza00/anime.support/actions/runs/41922817836

```
CLOUDFLARE_API_TOKEN *** set
CLOUDFLARE_ACCOUNT_ID: set
file:///home/runner/work/anime.support/anime.support/database/setup.mjs:31
      throw new Error(`${msg}\nThe Cloudflare API token *** needs "Account · D1 · Edit" (My Profile → API Token *** → Edit → Add more).`);
            ^

Error: 10000: Authentication error
The Cloudflare API token *** needs "Account · D1 · Edit" (My Profile → API Token *** → Edit → Add more).
    at cf (file:///home/runner/work/anime.support/anime.support/database/setup.mjs:31:13)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async file:///home/runner/work/anime.support/anime.support/database/setup.mjs:40:11

Node.js v22.23.4
```
