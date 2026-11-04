'use client';
import { useState } from 'react';

const enc = encodeURIComponent;

export default function ShareBar({ url, title }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };
  return (
    <div className="share">
      <span>Share</span>
      <a className="chip" href={`https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`} target="_blank" rel="noopener">X</a>
      <a className="chip" href={`https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`} target="_blank" rel="noopener">Facebook</a>
      <a className="chip" href={`https://wa.me/?text=${enc(`${title} ${url}`)}`} target="_blank" rel="noopener">WhatsApp</a>
      <a className="chip" href={`https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`} target="_blank" rel="noopener">Reddit</a>
      <button type="button" className="chip" onClick={copy} aria-live="polite">{copied ? 'Link copied' : 'Copy link'}</button>
    </div>
  );
}
