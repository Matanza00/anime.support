// After `next build`: turns out/redirects.txt into Cloudflare's _redirects file.
import fs from 'node:fs';
const src = new URL('../out/redirects.txt', import.meta.url);
if (fs.existsSync(src)) {
  fs.renameSync(src, new URL('../out/_redirects', import.meta.url));
  const n = fs.readFileSync(new URL('../out/_redirects', import.meta.url), 'utf8').split('\n').filter(Boolean).length;
  console.log(`_redirects: ${n} permanent redirects`);
}
