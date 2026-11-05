// anime.support bot: runs on GitHub Actions or your laptop.
//   npm start            → scheduler + review dashboard (leave running 24/7)
//   npm run collect      → fetch feeds once
//   npm run draft        → write drafts once
//   npm run publish      → deploy approved articles + Facebook once
//   npm run optimize     → weekly learning step once
import cron from 'node-cron';
import { CONFIG } from './config.js';
import { collect } from './collect.js';
import { draft } from './draft.js';
import { publish } from './publish.js';
import { optimize } from './optimize.js';
import { seed } from './seed.js';
import { catalog } from './catalog.js';
import { remediaExisting } from './official-media.js';
import { guides, interleaveGuides } from './guides.js';
import { sql, parseRow } from './d1.js';
import { requestDeploy } from './publish.js';
import { startReviewServer } from './review-server.js';
import { log, fail } from './log.js';

const running = new Set();
function guarded(name, fn) {
  return async () => {
    if (running.has(name)) return log(`${name} still running, skipping this tick`);
    running.add(name);
    try {
      await fn();
      return true;
    } catch (err) {
      fail(`${name}:`, err.message);
      return false;
    } finally {
      running.delete(name);
    }
  };
}

const jobs = {
  collect: guarded('collect', async () => {
    await collect();
    await draft();
  }),
  draft: guarded('draft', draft),
  publish: guarded('publish', publish),
  optimize: guarded('optimize', optimize),
  seed: guarded('seed', seed),
  catalog: guarded('catalog', async () => {
    await catalog();
    requestDeploy(); // the site rebuilds with the fresh catalog
  }),
  // publish every draft waiting right now (used when you approved them but the laptop could not save it)
  'approve-drafts': guarded('approve-drafts', async () => {
    const rows = await sql("UPDATE articles SET status = 'published', published_at = ?, updated_at = ? WHERE status = 'draft' RETURNING title", [new Date().toISOString(), new Date().toISOString()]);
    for (const r of rows) log(`Published: ${r.title}`);
    log(`${rows.length} draft(s) published`);
    await publish();
  }),
  // 5 evergreen guides per big franchise (watch order, where to watch, beginner's guide, what's next, how long)
  guides: guarded('guides', async () => {
    if (await guides()) requestDeploy();
  }),
  'mix-guides': guarded('mix-guides', async () => {
    if (await interleaveGuides()) requestDeploy();
  }),
  // swap generated artwork for official images on existing drafts and articles
  media: guarded('media', async () => {
    if (await remediaExisting({ sql, parseRow })) requestDeploy();
  }),
};

const cmd = process.argv[2];
if (cmd) {
  if (!jobs[cmd]) {
    console.error(`Unknown command "${cmd}". Use: collect | draft | publish | optimize | catalog | media | guides | approve-drafts | seed`);
    process.exit(1);
  }
  const ok = await jobs[cmd]();
  if (ok === false) process.exitCode = 1; // makes a failed GitHub Actions run show red
} else {
  log('anime.support bot starting');
  startReviewServer();
  cron.schedule(CONFIG.cron.collect, jobs.collect);
  cron.schedule(CONFIG.cron.publish, jobs.publish);
  cron.schedule(CONFIG.cron.optimize, jobs.optimize);
  log(`Schedules: collect+draft "${CONFIG.cron.collect}", publish "${CONFIG.cron.publish}", optimize "${CONFIG.cron.optimize}"`);
  jobs.optimize().then(jobs.collect); // seed trending + first collect at startup
}
