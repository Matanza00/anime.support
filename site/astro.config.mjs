import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { loadEnv } from 'vite';

const env = { ...loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), ''), ...process.env };

export default defineConfig({
  // Your real domain, e.g. https://anime.support (set PUBLIC_SITE_URL on your host)
  site: env.PUBLIC_SITE_URL || 'https://anime.support',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
