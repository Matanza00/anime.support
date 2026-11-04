'use client';
// A manual AdSense unit. Renders nothing until both the publisher ID and this slot's ID are set.
// Auto Ads (switched on in the AdSense dashboard) work without any of these.
import { useEffect } from 'react';
import { SITE } from '@/lib/site';

export default function AdSlot({ slot = 'top' }) {
  const id = SITE.adSlots[slot];
  useEffect(() => {
    if (!SITE.adsClient || !id) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {}
  }, [id]);
  if (!SITE.adsClient || !id) return null;
  return (
    <div className="ad glass">
      <div className="label">Advertisement</div>
      <ins
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={SITE.adsClient}
        data-ad-slot={id}
        data-ad-format={slot === 'inArticle' ? 'fluid' : 'auto'}
        data-ad-layout={slot === 'inArticle' ? 'in-article' : undefined}
        data-full-width-responsive="true"
      />
    </div>
  );
}
