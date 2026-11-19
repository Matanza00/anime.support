// "Top 10" ranking pages, built from the AniList catalog the bot refreshes every day.
//   /top/                         all rankings
//   /top/2026/                    top 10 anime of a year (+ top films and donghua of that year)
//   /top/2026/november/           top 10 anime airing in a month
//   /top/donghua-2026/            top 10 donghua (Chinese anime) of a year
//   /top/most-anticipated-2027/   most anticipated anime of next year (by people waiting for it)
//
// Ranking: AniList's average user score, adjusted for how many people have rated the show (a Bayesian
// average), so a show with 85% from 300 people doesn't outrank one with 84% from 300,000.
import { allShows } from './catalog.js';

export const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export const monthName = (m) => MONTHS[m][0].toUpperCase() + MONTHS[m].slice(1);
const SERIES = new Set(['TV', 'TV_SHORT', 'ONA']);
const MIN_ITEMS = 5; // a list with fewer shows isn't published
const SIZE = 10;

const now = () => new Date();
export const thisYear = () => now().getUTCFullYear();
export const rankYears = () => [thisYear(), thisYear() - 1, thisYear() - 2];

/** Score adjusted for how many people have rated it. m = how many ratings it takes to be trusted. */
function weighted(s, m) {
  if (!s.score) return 0;
  const C = 68; // a typical AniList score
  const v = s.popularity || 0;
  return (v / (v + m)) * s.score + (m / (v + m)) * C;
}
const started = (s) => (s.start_date ? new Date(`${s.start_date}T00:00:00Z`) : null);
const yearOf = (s) => (s.start_date ? Number(s.start_date.slice(0, 4)) : s.season_year || null);
const aired = (s) => s.status !== 'NOT_YET_RELEASED' && s.status !== 'CANCELLED';
const byWeighted = (m) => (a, b) => weighted(b, m) - weighted(a, m) || (b.popularity || 0) - (a.popularity || 0);

/** Anime series (not films, not donghua) that premiered in a year. */
function yearSeries(shows, y) {
  return shows.filter((s) => yearOf(s) === y && aired(s) && SERIES.has(s.format) && s.country !== 'CN' && s.score).sort(byWeighted(15000));
}
function yearFilms(shows, y) {
  return shows.filter((s) => yearOf(s) === y && aired(s) && s.format === 'MOVIE' && s.score).sort(byWeighted(6000));
}
function yearDonghua(shows, y) {
  return shows.filter((s) => yearOf(s) === y && aired(s) && s.country === 'CN' && s.format !== 'MOVIE' && s.score).sort(byWeighted(2500));
}
/** Series with episodes airing during a month (long-runners that began 2+ years earlier are left out). */
function monthSeries(shows, y, m) {
  const from = new Date(Date.UTC(y, m, 1)), to = new Date(Date.UTC(y, m + 1, 0, 23, 59));
  const cutoff = new Date(Date.UTC(y - 2, m, 1));
  return shows
    .filter((s) => {
      const st = started(s);
      if (!st || st > to || st < cutoff || !aired(s) || !SERIES.has(s.format) || s.country === 'CN') return false;
      const end = s.end_date ? new Date(`${s.end_date}T23:59:00Z`) : s.status === 'RELEASING' ? to : null;
      return end && end >= from;
    })
    .sort((a, b) => weighted(b, 8000) - weighted(a, 8000) || (b.popularity || 0) - (a.popularity || 0))
    .filter((s) => s.score || s.popularity > 20000);
}
function anticipated(shows, y) {
  return shows.filter((s) => s.status === 'NOT_YET_RELEASED' && yearOf(s) === y).sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
}

/** Every ranking page that has enough shows to be worth publishing. */
export async function rankingPages() {
  const shows = await allShows();
  const pages = [];
  const n = now();
  for (const y of rankYears()) {
    const series = yearSeries(shows, y);
    if (series.length >= MIN_ITEMS) {
      pages.push({
        id: String(y), kind: 'year', year: y,
        title: `Top 10 anime of ${y}${y === thisYear() ? ' (so far)' : ''}`,
        h1: `The best anime of ${y}${y === thisYear() ? ' so far' : ''}`,
        description: `The 10 best anime series of ${y}, ranked by fan scores${y === thisYear() ? ' and updated daily' : ''}, plus the year's best anime films. Where to watch each one legally.`,
        items: series.slice(0, SIZE),
        extra: [{ title: `Best anime films of ${y}`, items: yearFilms(shows, y).slice(0, 5) }],
      });
    }
    const lastMonth = y === n.getUTCFullYear() ? n.getUTCMonth() : 11;
    let later = null; // the top 10 of the month after this one that we kept
    for (let m = lastMonth; m >= 0; m--) {
      const items = monthSeries(shows, y, m);
      if (items.length < MIN_ITEMS) continue;
      const current = y === n.getUTCFullYear() && m === n.getUTCMonth();
      // most shows air for ~3 months: skip a month whose top 10 mostly repeats the following month's
      const top = items.slice(0, SIZE).map((s) => s.id);
      if (!current && later && top.filter((id) => later.includes(id)).length >= 6) continue;
      later = top;
      const label = `${monthName(m)} ${y}`;
      pages.push({
        id: `${y}/${MONTHS[m]}`, kind: 'month', year: y, month: m, current,
        title: `Top 10 anime of ${label}${current ? ': best shows airing now' : ''}`,
        h1: `The best anime of ${label}`,
        description: `The 10 best anime series with episodes ${current ? 'airing' : 'that aired'} in ${label}, ranked by fan scores${current ? ' and updated daily' : ''}. Episode counts, studios and where to watch legally.`,
        items: items.slice(0, SIZE),
      });
    }
    const dh = yearDonghua(shows, y);
    if (dh.length >= MIN_ITEMS) {
      pages.push({
        id: `donghua-${y}`, kind: 'donghua', year: y,
        title: `Top 10 donghua of ${y}: best Chinese anime${y === thisYear() ? ' so far' : ''}`,
        h1: `The best donghua of ${y}`,
        description: `The 10 best Chinese anime (donghua) that premiered in ${y}, ranked by fan scores. Where to watch each one with English subtitles.`,
        items: dh.slice(0, SIZE),
      });
    }
  }
  const next = thisYear() + 1;
  const ant = anticipated(shows, next);
  if (ant.length >= MIN_ITEMS) {
    pages.push({
      id: `most-anticipated-${next}`, kind: 'anticipated', year: next,
      title: `Most anticipated anime of ${next}`,
      h1: `The most anticipated anime of ${next}`,
      description: `The 10 anime coming in ${next} that the most fans are waiting for, with release dates, studios and trailers. Updated daily.`,
      items: ant.slice(0, SIZE),
    });
  }
  return pages;
}

export async function rankingPage(id) {
  return (await rankingPages()).find((p) => p.id === id) ?? null;
}

/** A short intro written from the data, so each list says something specific. */
export function introFor(p) {
  const [a, b, c] = p.items;
  const sc = (s) => (s.score ? ` (${s.score}% from fans)` : '');
  if (p.kind === 'anticipated') {
    return `${a.title} leads the list of ${p.year} anime fans are waiting for, followed by ${b.title} and ${c.title}. The ranking counts how many AniList users have added each upcoming show to their lists, and it changes as new trailers and dates drop.`;
  }
  const when = p.kind === 'month' ? `in ${monthName(p.month)} ${p.year}` : `of ${p.year}`;
  const what = p.kind === 'donghua' ? 'donghua' : 'anime';
  return `${a.title}${sc(a)} is the best-rated ${what} ${when}, ahead of ${b.title}${sc(b)} and ${c.title}${sc(c)}. Every show here is ranked by fan scores, weighted by how many people rated it, so a small but enthusiastic audience can't push a show above one that thousands of fans love.`;
}

export function faqFor(p) {
  const [a, b, c] = p.items;
  const when = p.kind === 'month' ? `${monthName(p.month)} ${p.year}` : String(p.year);
  const out = [];
  if (p.kind === 'anticipated') {
    out.push({ q: `What is the most anticipated anime of ${p.year}?`, a: `${a.title} is the most anticipated anime of ${p.year} by the number of fans waiting for it, followed by ${b.title} and ${c.title}.` });
  } else {
    const what = p.kind === 'donghua' ? 'donghua' : 'anime';
    out.push({ q: `What is the best ${what} of ${when}?`, a: `${a.title} is the highest-rated ${what} of ${when}${a.score ? ` with an average fan score of ${a.score}%` : ''}. ${b.title} and ${c.title} complete the top three.` });
  }
  out.push({ q: 'How is this list ranked?', a: p.kind === 'anticipated' ? 'By the number of AniList users who have added each upcoming show to their watch lists. The list updates every day.' : 'By average fan score on AniList, adjusted for how many people rated each show (a weighted average). The list updates every day as new ratings come in.' });
  const legal = p.items.filter((s) => s.streaming?.length).length;
  if (p.kind !== 'anticipated') out.push({ q: `Where can I watch these ${p.kind === 'donghua' ? 'donghua' : 'anime'} legally?`, a: `${legal} of these ${p.items.length} shows have an official streaming service listed. Each show's page lists every legal option; availability depends on your country.` });
  return out;
}
