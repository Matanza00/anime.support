// Step 4: after you approve articles, trigger one site rebuild, then share live articles to Facebook.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { db, q } from './db.js';
import { CONFIG } from './config.js';
import { facebookEnabled, postToPage } from './facebook.js';
import { log, warn } from './log.js';

const run = promisify(execFile);

// Deploy state lives in Supabase (bot_state), so your laptop and GitHub Actions share it.
async function readState() {
  const rows = await q(db().from('bot_state').select('value').eq('key', 'deploy'));
  return rows[0]?.value ?? { lastDeployAt: null };
}
const writeState = (value) =>
  q(db().from('bot_state').upsert({ key: 'deploy', value, updated_at: new Date().toISOString() }, { onConflict: 'key' }));

async function git(...args) {
  const { stdout } = await run('git', args, { cwd: CONFIG.deploy.repoDir });
  return stdout.trim();
}

/** Commits site/src/data/last-publish.json and pushes; your host rebuilds on push. */
async function deployViaGit(count) {
  const marker = path.join(CONFIG.deploy.repoDir, 'site', 'src', 'data', 'last-publish.json');
  await fs.writeFile(marker, JSON.stringify({ lastPublish: new Date().toISOString(), count }, null, 2) + '\n');
  await git('pull', '--rebase', '--autostash', 'origin', CONFIG.deploy.branch).catch((e) =>
    warn(`git pull failed (continuing): ${e.message.split('\n')[0]}`),
  );
  await git('add', 'site/src/data/last-publish.json');
  await git('commit', '-m', `content: publish ${count} article(s)`);
  await git('push', 'origin', CONFIG.deploy.branch);
}

/**
 * Inside GitHub Actions: commit the marker (keeps the repo "active" so GitHub never pauses the
 * schedule) and tell the workflow to run the deploy job. A push made with the Actions token does
 * not trigger other workflows, so the workflow deploys explicitly.
 */
async function deployViaActions(count) {
  await deployViaGit(count);
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, 'deploy=true\n');
}

/** From the laptop without git: ask GitHub to run the deploy workflow (needs a token with Actions: write). */
async function deployViaDispatch() {
  const { repo, branch, githubToken } = CONFIG.deploy;
  const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/deploy.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${githubToken}`, Accept: 'application/vnd.github+json', 'User-Agent': CONFIG.userAgent },
    body: JSON.stringify({ ref: branch }),
  });
  if (res.status !== 204) throw new Error(`GitHub dispatch HTTP ${res.status}: ${await res.text()}`);
}

async function deployViaHook() {
  const res = await fetch(CONFIG.deploy.hookUrl, { method: 'POST' });
  if (!res.ok) throw new Error(`Deploy hook HTTP ${res.status}`);
}

export async function deployIfNeeded() {
  const state = await readState();
  let query = db().from('articles').select('id', { count: 'exact', head: true }).eq('status', 'published');
  if (state.lastDeployAt) query = query.gt('published_at', state.lastDeployAt);
  const { count, error } = await query;
  if (error) throw new Error(error.message);
  if (!count) return log('Publish: nothing new to deploy'), false;

  const startedAt = new Date().toISOString();
  const mode = CONFIG.deploy.mode;
  if (mode === 'actions') await deployViaActions(count);
  else if (mode === 'dispatch') await deployViaDispatch();
  else if (mode === 'hook' && CONFIG.deploy.hookUrl) await deployViaHook();
  else await deployViaGit(count);

  await writeState({ ...state, lastDeployAt: startedAt });
  log(`Deploy triggered for ${count} new article(s)`);
  return true;
}

export async function shareToFacebook() {
  if (!facebookEnabled()) return 0;
  const state = await readState();
  if (!state.lastDeployAt) return 0;
  // Wait until the latest build has had time to finish, then share only articles it included.
  if (Date.now() - new Date(state.lastDeployAt).getTime() < CONFIG.fb.delayMinutes * 60e3) return 0;
  const due = await q(
    db()
      .from('articles')
      .select('id, slug, title, excerpt, fb_caption, social_card_url')
      .eq('status', 'published')
      .eq('fb_posted', false)
      .lte('published_at', state.lastDeployAt)
      .order('published_at', { ascending: true })
      .limit(5),
  );

  let posted = 0;
  for (const a of due) {
    const link = `${CONFIG.siteUrl}/news/${a.slug}`;
    try {
      const live = await fetch(link, { method: 'HEAD' });
      if (!live.ok) {
        warn(`Not live yet, will retry: ${link}`);
        continue;
      }
      const id = await postToPage({ message: a.fb_caption || `${a.title}\n\n${a.excerpt}`, link, imageUrl: a.social_card_url });
      await q(db().from('articles').update({ fb_posted: true, fb_post_id: id }).eq('id', a.id));
      posted++;
      log(`Shared to Facebook: ${a.title}`);
    } catch (err) {
      warn(`Facebook post failed for "${a.title}": ${err.message}`);
    }
  }
  return posted;
}

export async function publish() {
  await deployIfNeeded();
  await shareToFacebook();
}
