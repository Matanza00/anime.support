// /ads.txt for Google AdSense, generated from NEXT_PUBLIC_ADSENSE_CLIENT.
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

export function GET() {
  const pub = SITE.adsClient.replace(/^ca-/, '');
  return new Response(pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : '# AdSense not configured yet\n', { headers: { 'Content-Type': 'text/plain' } });
}
