# Last deploy: failure

- When: 2026-11-04T22:09:33Z
- Commit: a907579
- Run: https://github.com/Matanza00/anime.support/actions/runs/41922708126

```
CLOUDFLARE_API_TOKEN *** set
CLOUDFLARE_ACCOUNT_ID: set
file:///home/runner/work/anime.support/anime.support/database/setup.mjs:31
    throw new Error(msg);
          ^

Error: 7003: Could not route to /client/v4/accounts/com.cloudflare.api.account.bbc4b9b4aec93bd6347b548581c3d11f/d1/database, perhaps your object identifier is invalid?
    at cf (file:///home/runner/work/anime.support/anime.support/database/setup.mjs:31:11)
    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)
    at async file:///home/runner/work/anime.support/anime.support/database/setup.mjs:38:11

Node.js v22.23.4
```
