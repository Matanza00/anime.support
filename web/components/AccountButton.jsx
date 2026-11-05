'use client';
import { useMe } from '@/lib/studio-client';

/** Header button: your avatar when signed in, otherwise "Sign in". */
export default function AccountButton() {
  const me = useMe();
  const u = me?.user;
  return (
    <a className={`acct-btn${u ? ' in' : ''}`} href="/account/" aria-label={u ? `Your account (${u.name})` : 'Sign in'}>
      {u ? (
        u.avatar ? <img src={u.avatar} alt="" referrerPolicy="no-referrer" /> : <span className="initial">{(u.name || '?')[0].toUpperCase()}</span>
      ) : (
        <span>Sign in</span>
      )}
    </a>
  );
}
