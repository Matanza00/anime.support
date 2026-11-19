// The AdSense script, included only on pages with real editorial content (articles, show pages with
// write-ups, rankings, charts and lists). Utility screens (search, account, admin, contest entry,
// empty or thin pages) never load it, so Auto ads can't place ads where there's nothing to read.
// React moves this tag into <head> and includes it once per page.
import { SITE } from '@/lib/site';

export default function AdsScript() {
  if (!SITE.adsClient) return null;
  return <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsClient}`} crossOrigin="anonymous" />;
}
