'use client';
// YouTube "facade": a thumbnail until the visitor taps play, so the page stays fast.
import { useState } from 'react';

export default function Trailer({ id, title }) {
  const [play, setPlay] = useState(false);
  return (
    <div className="yt" onClick={() => setPlay(true)}>
      {play ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
      ) : (
        <>
          <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt={`${title} trailer`} loading="lazy" width="480" height="360" />
          <button type="button" className="yt-play" aria-label={`Play the ${title} trailer`}>
            <svg viewBox="0 0 68 48" aria-hidden="true"><path d="M66.5 7.7A8.5 8.5 0 0 0 60.5 1.7C55.2.3 34 .3 34 .3S12.8.3 7.5 1.7A8.5 8.5 0 0 0 1.5 7.7C.1 13 .1 24 .1 24s0 11 1.4 16.3a8.5 8.5 0 0 0 6 6C12.8 47.7 34 47.7 34 47.7s21.2 0 26.5-1.4a8.5 8.5 0 0 0 6-6C67.9 35 67.9 24 67.9 24s0-11-1.4-16.3Z" fill="#f00" /><path d="M45 24 27 14v20Z" fill="#fff" /></svg>
          </button>
        </>
      )}
    </div>
  );
}
