// Generates /ads.txt from PUBLIC_ADSENSE_CLIENT (required by AdSense).
import { SITE } from '../lib/site.js';

export function GET() {
  const pub = SITE.adsClient.replace(/^ca-/, '');
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# AdSense not configured yet\n';
  return new Response(body, { headers: { 'Content-Type': 'text/plain' } });
}
