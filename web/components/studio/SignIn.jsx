'use client';
import { signInHref } from '@/lib/studio-client';

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);
const AppleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.8 1.2 1.8 2.6 3.1 2.6 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.5-1-2.5-3.9zM14 4.9c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z" />
  </svg>
);

/** Google / Apple buttons. Shows "opening soon" while neither provider has its keys yet. */
export default function SignIn({ providers = {}, title = 'Sign in to join', note }) {
  const any = providers.google || providers.apple || providers.dev;
  return (
    <div className="signin glass">
      <h2>{title}</h2>
      <p className="muted">{note || 'One tap with your Google or Apple account. We never post anything for you, and your email stays private.'}</p>
      {any ? (
        <div className="signin-btns">
          {providers.google && <a className="btn signin-google" href={signInHref('google')}><GoogleIcon /> Continue with Google</a>}
          {providers.apple && <a className="btn signin-apple" href={signInHref('apple')}><AppleIcon /> Continue with Apple</a>}
          {providers.dev && <a className="btn ghost" href={`/api/auth/dev?return=${encodeURIComponent(typeof location !== 'undefined' ? location.pathname + location.search : '/account/')}`}>Test sign-in (local only)</a>}
        </div>
      ) : (
        <p className="signin-soon">Sign-in is opening very soon. Check back in a day or two.</p>
      )}
      <p className="signin-note">By continuing you agree to the <a href="/terms/">terms</a>, the <a href="/contests/rules/">contest rules</a> and the <a href="/privacy/">privacy policy</a>. You must be 13 or older.</p>
    </div>
  );
}
