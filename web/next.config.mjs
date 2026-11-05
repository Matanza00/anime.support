import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Static export: `next build` writes plain HTML/CSS/JS to ./out, served by Cloudflare Workers. */
const nextConfig = {
  output: 'export',
  trailingSlash: true, // /news/slug/ → /news/slug/index.html (clean URLs on any static host)
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
  turbopack: { root: path.dirname(fileURLToPath(import.meta.url)) },
};
export default nextConfig;
