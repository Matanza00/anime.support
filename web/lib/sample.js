// Fictional demo stories for previewing the design only (SAMPLE_DATA=1).
// None of these shows exist; never deploy with SAMPLE_DATA turned on.
const now = Date.now();
const day = 864e5;
const body = (show) => `${show} has an official update, and here's what it means for fans.

## What was announced

The production committee confirmed the news on its official channels this week. This is placeholder text used to preview the layout.

## Why it matters

Context paragraph explaining where the story stands and what the announcement changes for viewers.

## What happens next

The next confirmed step, with dates where officially announced.

<details><summary>Spoiler: where the manga goes from here</summary>Spoiler text sits behind a tap.</details>`;

const IMG = { 'Starfall Academy': 'starfall', 'Crimson Tide Ronin': 'crimson', 'Iron Lotus': 'lotus', 'Neon Shrine Maidens': 'neon', 'Paper Moon Café': 'paper' };

const make = (i, title, show, category, views, media = []) => ({
  id: i,
  slug: `sample-story-${i}`,
  title,
  excerpt: `A short, factual summary of the ${show} announcement for the card and search snippet.`,
  body_md: body(show),
  category,
  anime: [show],
  source_urls: ['https://example.com/official-announcement'],
  source_names: ['Official announcement'],
  published_at: new Date(now - i * day * 0.4).toISOString(),
  updated_at: new Date(now - i * day * 0.4).toISOString(),
  views,
  cover_url: `/sample/${IMG[show]}.jpg`,
  cover_credit: `${show} key visual · demo art`,
  media,
  release_date: null,
});

const trailer = { type: 'youtube', url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', caption: 'Official trailer (sample video)', credit: '' };
const gallery = [
  { type: 'image', url: '/sample/starfall.jpg', caption: 'New key visual', credit: 'Demo art' },
  { type: 'image', url: '/sample/neon.jpg', caption: 'Character visual', credit: 'Demo art' },
  { type: 'image', url: '/sample/paper.jpg', caption: 'Setting art', credit: 'Demo art' },
];

const inDays = (n) => new Date(now + n * day).toISOString().slice(0, 10);
const withDate = (a, n) => ({ ...a, release_date: inDays(n) });

export const SAMPLE = [
  withDate(make(1, 'Starfall Academy Season 2 Confirmed for April, New Trailer Reveals the Rival School', 'Starfall Academy', 'upcoming', 940, [trailer, ...gallery]), 21),
  withDate(make(2, 'Crimson Tide Ronin Final Arc: Studio Confirms 24 Episodes and a Spring Premiere', 'Crimson Tide Ronin', 'upcoming', 1210), 48),
  withDate(make(3, 'Paper Moon Café Movie Gets a Streaming Date. Here Is Where to Watch', 'Paper Moon Café', 'release', 410), 6),
  make(4, 'Starfall Academy Adds Two New Cast Members for the Tournament Arc', 'Starfall Academy', 'news', 780),
  make(5, 'Iron Lotus Manga Ends After 9 Years: What the Final Chapter Means for the Anime', 'Iron Lotus', 'news', 1530, [trailer]),
  make(6, 'Everything Confirmed About Crimson Tide Ronin So Far', 'Crimson Tide Ronin', 'feature', 300),
  make(7, 'Neon Shrine Maidens Episode 1 Is Out Now', 'Neon Shrine Maidens', 'release', 220),
  // evergreen guides (slug = show-slug + guide type), to preview the guide links
  { ...make(8, 'Starfall Academy Watch Order: Every Season and Film in Order', 'Starfall Academy', 'feature', 150), slug: 'starfall-academy-watch-order' },
  { ...make(9, 'Where to Watch Starfall Academy Legally', 'Starfall Academy', 'feature', 120), slug: 'starfall-academy-where-to-watch' },
  { ...make(10, "Starfall Academy Beginner's Guide", 'Starfall Academy', 'feature', 90), slug: 'starfall-academy-beginners-guide' },
  // the same news-only show tagged two ways, to preview duplicate merging
  { ...make(11, 'Lantern Road Gets an Anime Adaptation', 'Paper Moon Café', 'news', 60), anime: ['Lantern Road'] },
  { ...make(12, 'Lantern Road Manga Hits 1 Million Copies', 'Paper Moon Café', 'news', 40), anime: ['Lantern Road Manga'] },
];
