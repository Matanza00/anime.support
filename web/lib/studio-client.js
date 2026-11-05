'use client';
// Browser helpers for the Creator Studio API (/api/*, served by the Worker on the same domain).
import { useEffect, useState } from 'react';

export async function api(path, { method = 'GET', json, body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: json ? { 'Content-Type': 'application/json' } : undefined,
    body: json ? JSON.stringify(json) : body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data.code;
    throw err;
  }
  return data;
}

let meCache = null;
const listeners = new Set();
export function refreshMe() {
  meCache = api('/api/me').catch(() => ({ user: null, providers: {}, offline: true }));
  meCache.then((v) => listeners.forEach((fn) => fn(v)));
  return meCache;
}
/** { user, entries, providers } for the signed-in visitor, or user: null. Shared by every component on the page. */
export function useMe() {
  const [me, setMe] = useState(null);
  useEffect(() => {
    listeners.add(setMe);
    (meCache || refreshMe()).then(setMe);
    return () => listeners.delete(setMe);
  }, []);
  return me;
}

export const signInHref = (provider) => `/api/auth/${provider}?return=${encodeURIComponent(location.pathname + location.search)}`;

export function useQueryParam(name) {
  const [v, setV] = useState(null);
  useEffect(() => setV(new URLSearchParams(location.search).get(name) || ''), [name]);
  return v;
}

export function timeLeft(iso) {
  const ms = Date.parse(iso) - Date.now();
  if (ms <= 0) return 'ended';
  const d = Math.floor(ms / 864e5);
  const h = Math.floor((ms % 864e5) / 3600e3);
  if (d > 0) return `${d}d ${h}h left`;
  const m = Math.floor((ms % 3600e3) / 60e3);
  return `${h}h ${m}m left`;
}

export const fmtDate = (iso) => new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

export const PHASE_LABEL = {
  draft: 'Draft',
  upcoming: 'Opens soon',
  submissions: 'Taking entries',
  voting: 'Voting open',
  results: 'Results',
  cancelled: 'Cancelled',
};

export function phaseOf(c, now = new Date().toISOString()) {
  if (c.status === 'draft') return 'draft';
  if (c.status === 'cancelled') return 'cancelled';
  if (now < c.submitOpensAt) return 'upcoming';
  if (now < c.submitClosesAt) return 'submissions';
  if (now < c.voteClosesAt) return 'voting';
  return 'results';
}
