import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const botDir = path.resolve(here, '..');
const e = process.env;

export const CONFIG = {
  // Cloudflare D1 database (articles, sources, stats, images)
  d1: {
    accountId: e.CLOUDFLARE_ACCOUNT_ID || '',
    token: e.CLOUDFLARE_API_TOKEN || '',
    name: e.D1_DATABASE_NAME || 'anime-support',
    databaseId: e.D1_DATABASE_ID || '', // optional; looked up by name when empty
  },

  llm: {
    baseURL: e.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
    apiKey: e.LLM_API_KEY,
    model: e.LLM_MODEL || 'openai/gpt-4o-mini',
  },

  images: {
    // openrouter | openai | none  (none = free procedural art only)
    provider: e.IMAGE_PROVIDER || (e.LLM_API_KEY ? 'openrouter' : 'none'),
    model: e.IMAGE_MODEL || '',
    apiKey: e.IMAGE_API_KEY || e.LLM_API_KEY || '',
    baseURL: e.IMAGE_BASE_URL || e.LLM_BASE_URL || 'https://openrouter.ai/api/v1',
  },

  siteName: e.SITE_NAME || 'anime.support',
  siteUrl: (e.SITE_URL || 'https://anime.support').replace(/\/$/, ''),

  deploy: {
    mode: e.DEPLOY_MODE || (e.GITHUB_ACTIONS === 'true' ? 'actions' : 'git'),
    repoDir: path.resolve(botDir, e.REPO_DIR || '..'),
    branch: e.GIT_BRANCH || 'main',
    hookUrl: e.DEPLOY_HOOK_URL || '',
    repo: e.GITHUB_REPOSITORY || e.GITHUB_REPO || 'Matanza00/anime.support',
    githubToken: e.GITHUB_DISPATCH_TOKEN || '',
  },

  fb: {
    pageId: e.FB_PAGE_ID || '',
    token: e.FB_PAGE_TOKEN || '',
    delayMinutes: Number(e.FB_DELAY_MINUTES || 10),
    graphVersion: e.FB_GRAPH_VERSION || 'v23.0',
    // photo = post the branded headline card as a photo with the link in the caption
    // link  = classic link preview post
    postMode: e.FB_POST_MODE || 'photo',
  },

  review: {
    port: Number(e.REVIEW_PORT || 4000),
    password: e.REVIEW_PASSWORD || '',
  },

  cron: {
    collect: e.COLLECT_CRON || '5 * * * *',
    publish: e.PUBLISH_CRON || '0 */2 * * *',
    optimize: e.OPTIMIZE_CRON || '0 3 * * 0',
  },

  maxDraftsPerRun: Number(e.MAX_DRAFTS_PER_RUN || 6),
  maxItemAgeHours: Number(e.MAX_ITEM_AGE_HOURS || 48),
  autoPrune: e.SOURCES_AUTO_PRUNE === 'true',
  userAgent: 'AnimeSupportBot/1.0 (+https://anime.support/about; news aggregator; respects robots)',
  stateFile: path.join(botDir, '.state.json'),
};

export function requireConfig(...keys) {
  const missing = keys.filter((k) => !k.split('.').reduce((o, p) => o?.[p], CONFIG));
  if (missing.length) {
    throw new Error(`Missing settings in bot/.env: ${missing.join(', ')}. See .env.example.`);
  }
}
