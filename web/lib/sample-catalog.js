// Fictional catalog for previewing the design only (SAMPLE_DATA=1). None of these shows exist.
const now = Math.floor(Date.now() / 1000);
const H = 3600;
const d = (days) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
const j = (x) => JSON.stringify(x);

const base = (id, title, extra) => ({
  id,
  slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  title,
  title_romaji: null,
  title_native: null,
  synonyms: '[]',
  format: 'TV',
  status: 'RELEASING',
  episodes: 12,
  duration: 24,
  source: 'MANGA',
  season: 'FALL',
  season_year: 2026,
  start_date: d(-30),
  end_date: null,
  country: 'JP',
  genres: j(['Action', 'Fantasy']),
  tags: j(['Magic', 'School']),
  studios: j(['Demo Studio']),
  score: 78,
  popularity: 50000,
  trending: 10,
  cover_url: null,
  cover_color: '#e4435a',
  banner_url: null,
  trailer_youtube: null,
  streaming: j([{ site: 'Crunchyroll', url: 'https://www.crunchyroll.com/', language: 'English' }]),
  official_site: null,
  next_episode: 6,
  next_airing_at: now + 30 * H,
  anilist_url: 'https://anilist.co/',
  summary: null,
  updated_at: new Date().toISOString(),
  ...extra,
});

const SUMMARY =
  'Placeholder overview used to preview the layout. In production this is an original two-paragraph summary written for this site, describing the premise and tone without spoilers.\n\nThe second paragraph explains who will enjoy the show and what makes it stand out this season.';

export const SHOWS = [
  base(1, 'Starfall Academy', { title_native: 'スターフォール学園', popularity: 180000, summary: SUMMARY, cover_url: '/sample/starfall.jpg', trailer_youtube: 'dQw4w9WgXcQ', genres: j(['Action', 'Fantasy', 'Comedy']) }),
  base(2, 'Crimson Tide Ronin', { popularity: 150000, summary: SUMMARY, cover_url: '/sample/crimson.jpg', genres: j(['Action', 'Drama', 'Adventure']), next_airing_at: now + 5 * H, next_episode: 9 }),
  base(3, 'Iron Lotus', { country: 'CN', source: 'WEB_NOVEL', popularity: 40000, cover_url: '/sample/lotus.jpg', genres: j(['Action', 'Fantasy', 'Martial Arts']), studios: j(['Demo Donghua Studio']), streaming: j([{ site: 'Bilibili TV', url: 'https://www.bilibili.tv/', language: null }]), next_airing_at: now + 50 * H }),
  base(4, 'Neon Shrine Maidens', { status: 'NOT_YET_RELEASED', season: 'WINTER', season_year: 2027, start_date: d(60), next_episode: null, next_airing_at: null, popularity: 90000, cover_url: '/sample/neon.jpg', source: 'LIGHT_NOVEL', genres: j(['Supernatural', 'Comedy']) }),
  base(5, 'Paper Moon Café', { status: 'FINISHED', season: 'SUMMER', season_year: 2026, start_date: d(-120), end_date: d(-35), next_episode: null, next_airing_at: null, popularity: 70000, summary: SUMMARY, cover_url: '/sample/paper.jpg', genres: j(['Slice of Life', 'Romance', 'Comedy']), source: 'ORIGINAL' }),
  base(6, 'Starfall Academy: The Movie', { format: 'MOVIE', status: 'NOT_YET_RELEASED', start_date: d(90), season: 'WINTER', season_year: 2027, episodes: 1, duration: 110, next_episode: null, next_airing_at: null, popularity: 60000 }),
  base(7, 'Clockwork Garden', { popularity: 30000, genres: j(['Mystery', 'Sci-Fi']), next_airing_at: now + 75 * H, next_episode: 4 }),
  base(8, 'Jade Phoenix Chronicles', { country: 'CN', format: 'ONA', popularity: 25000, genres: j(['Fantasy', 'Adventure']), next_airing_at: now + 100 * H, next_episode: 33, episodes: 52 }),
];

const slot = (id, ep, h) => ({ media_id: id, episode: ep, airing_at: now + h * H });
export const AIRING = [
  slot(2, 8, -20), slot(1, 5, -6), slot(2, 9, 5), slot(1, 6, 30), slot(3, 18, 50), slot(7, 4, 75), slot(8, 33, 100), slot(2, 10, 173), slot(1, 7, 198),
];
