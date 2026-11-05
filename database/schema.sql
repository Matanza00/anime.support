-- anime.support database (Cloudflare D1 / SQLite).
-- Applied automatically by the "Set up database" GitHub workflow. Safe to run again.
-- Timestamps are ISO-8601 text (e.g. 2026-11-05T02:48:00.000Z); lists are JSON text.

-- News sources the bot watches (seeded below; edit any time in Cloudflare → D1 → Console)
CREATE TABLE IF NOT EXISTS sources (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  name               TEXT NOT NULL UNIQUE,
  homepage           TEXT NOT NULL,
  feed_url           TEXT,                          -- auto-discovered if empty
  tier               TEXT NOT NULL DEFAULT 'daily' CHECK (tier IN ('daily', 'weekly', 'monthly')),
  enabled            INTEGER NOT NULL DEFAULT 1,
  items_seen         INTEGER NOT NULL DEFAULT 0,
  items_used         INTEGER NOT NULL DEFAULT 0,    -- headlines that became published articles
  last_ok_at         TEXT,
  last_error         TEXT,
  feed_etag          TEXT,                          -- lets the bot skip unchanged feeds
  feed_last_modified TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Raw headlines collected from feeds (never shown on the site)
CREATE TABLE IF NOT EXISTS raw_items (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id    INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
  url          TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  summary      TEXT,
  published_at TEXT,
  fetched_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  cluster_key  TEXT,
  status       TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'drafted', 'skipped'))
);
CREATE INDEX IF NOT EXISTS raw_items_status_idx ON raw_items (status, fetched_at);
CREATE INDEX IF NOT EXISTS raw_items_cluster_idx ON raw_items (cluster_key);

-- Articles: drafts written by the bot, approved by you, shown on the site
CREATE TABLE IF NOT EXISTS articles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  slug             TEXT NOT NULL UNIQUE,
  title            TEXT NOT NULL,
  excerpt          TEXT NOT NULL DEFAULT '',
  body_md          TEXT NOT NULL,
  category         TEXT NOT NULL DEFAULT 'news' CHECK (category IN ('news', 'upcoming', 'release', 'feature')),
  anime            TEXT NOT NULL DEFAULT '[]',     -- JSON list, e.g. ["Jujutsu Kaisen"]
  source_urls      TEXT NOT NULL DEFAULT '[]',
  source_names     TEXT NOT NULL DEFAULT '[]',
  cluster_key      TEXT,
  priority         REAL NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'rejected')),
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  published_at     TEXT,
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  confidence       REAL,                            -- AI's self-rated fact confidence (0-1)
  cover_url        TEXT,
  cover_credit     TEXT,
  media            TEXT NOT NULL DEFAULT '[]',      -- JSON [{type,url,caption,credit}]
  image_candidates TEXT NOT NULL DEFAULT '[]',      -- JSON: images/videos the bot found
  social_card_url  TEXT,                            -- branded headline card for Facebook
  image_prompt     TEXT,                            -- scene used to generate the original artwork
  release_date     TEXT,                            -- YYYY-MM-DD, only when officially confirmed
  fb_caption       TEXT,
  fb_posted        INTEGER NOT NULL DEFAULT 0,
  fb_post_id       TEXT,
  views            INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS articles_status_idx ON articles (status, published_at);
CREATE INDEX IF NOT EXISTS articles_created_idx ON articles (created_at);

-- Which anime readers want (the weekly optimizer writes here; the site shows it as a chart)
CREATE TABLE IF NOT EXISTS anime_focus (
  name        TEXT PRIMARY KEY,
  weight      REAL NOT NULL DEFAULT 1,              -- >1 = cover more, <1 = cover less
  views_7d    INTEGER NOT NULL DEFAULT 0,
  articles_7d INTEGER NOT NULL DEFAULT 0,
  pinned      INTEGER NOT NULL DEFAULT 0,           -- 1 = never down-weight
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Daily views per article (written by the site's /api/view Worker)
CREATE TABLE IF NOT EXISTS article_views_daily (
  article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  day        TEXT NOT NULL,
  views      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (article_id, day)
);

-- Images the bot makes or you upload. Each deploy copies them to the site as /media/<key>.
CREATE TABLE IF NOT EXISTS media (
  key        TEXT PRIMARY KEY,                      -- e.g. articles/<slug>/hero-abc.webp
  mime       TEXT NOT NULL,
  data       TEXT NOT NULL,                         -- base64
  bytes      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Small key/value store for the bot (e.g. last deploy time), shared by laptop and GitHub Actions
CREATE TABLE IF NOT EXISTS bot_state (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Anime catalog from AniList (refreshed daily by the bot's "catalog" task). One row per show.
CREATE TABLE IF NOT EXISTS anime_catalog (
  id             INTEGER PRIMARY KEY,                -- AniList id
  slug           TEXT NOT NULL UNIQUE,               -- /anime/<slug>/
  title          TEXT NOT NULL,                      -- English title, else romaji
  title_romaji   TEXT,
  title_native   TEXT,
  synonyms       TEXT NOT NULL DEFAULT '[]',         -- JSON
  format         TEXT,                               -- TV, MOVIE, ONA, OVA, SPECIAL, TV_SHORT
  status         TEXT,                               -- RELEASING, FINISHED, NOT_YET_RELEASED, ...
  episodes       INTEGER,
  duration       INTEGER,                            -- minutes per episode
  source         TEXT,                               -- MANGA, LIGHT_NOVEL, ORIGINAL, ...
  season         TEXT,                               -- WINTER, SPRING, SUMMER, FALL
  season_year    INTEGER,
  start_date     TEXT,                               -- YYYY-MM-DD (partial dates padded with 01)
  end_date       TEXT,
  country        TEXT,                               -- JP, CN (donghua), KR, ...
  genres         TEXT NOT NULL DEFAULT '[]',
  tags           TEXT NOT NULL DEFAULT '[]',
  studios        TEXT NOT NULL DEFAULT '[]',
  score          INTEGER,                            -- AniList average score (0-100)
  popularity     INTEGER,
  trending       INTEGER,
  cover_url      TEXT,
  cover_color    TEXT,
  banner_url     TEXT,
  trailer_youtube TEXT,
  streaming      TEXT NOT NULL DEFAULT '[]',         -- JSON [{site,url,language}] official legal streams
  official_site  TEXT,
  next_episode   INTEGER,
  next_airing_at INTEGER,                            -- unix seconds
  anilist_url    TEXT,
  synopsis_src   TEXT,                               -- AniList synopsis, used only as background for our own summary (never published)
  summary        TEXT,                               -- our original overview (AI-written, shown on the page)
  summary_at     TEXT,
  updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS anime_catalog_season_idx ON anime_catalog (season_year, season);
CREATE INDEX IF NOT EXISTS anime_catalog_status_idx ON anime_catalog (status, popularity);

-- Added later (safe to repeat: "duplicate column" is ignored by setup.mjs)
ALTER TABLE anime_catalog ADD COLUMN start_precision TEXT;   -- day | month | year: how exact the announced date is
ALTER TABLE anime_catalog ADD COLUMN official_x TEXT;        -- the show's official X (Twitter) account, where dates are announced

-- Upcoming and recent episode air times (next 8 days), for the weekly schedule page
CREATE TABLE IF NOT EXISTS airing (
  media_id  INTEGER NOT NULL,
  episode   INTEGER NOT NULL,
  airing_at INTEGER NOT NULL,                        -- unix seconds
  PRIMARY KEY (media_id, episode)
);
CREATE INDEX IF NOT EXISTS airing_time_idx ON airing (airing_at);

-- Starter sources. daily = breaking news, weekly = trends and features, monthly = seasonal/upcoming coverage.
INSERT OR IGNORE INTO sources (name, homepage, feed_url, tier) VALUES
  ('Anime News Network', 'https://www.animenewsnetwork.com/', 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w', 'daily'),
  ('Crunchyroll News',   'https://www.crunchyroll.com/news', 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss', 'daily'),
  ('MyAnimeList News',   'https://myanimelist.net/news', 'https://myanimelist.net/rss/news.xml', 'daily'),
  ('Anime Corner',       'https://animecorner.me/', 'https://animecorner.me/feed/', 'weekly'),
  ('Anime UK News',      'https://animeuknews.net/', 'https://animeuknews.net/feed/', 'weekly'),
  ('Otaku News',         'https://www.otakunews.com/', 'https://www.otakunews.com/rss/rss.xml', 'monthly'),
  ('AniTrendz',          'https://anitrendz.net/news/', 'https://anitrendz.net/news/feed/', 'weekly'),
  ('Otaku USA',          'https://otakuusamagazine.com/', 'https://otakuusamagazine.com/feed/', 'monthly');

-- One-time fixes, safe to repeat: Crunchyroll's feed address; sources that block feed readers start switched off
UPDATE sources SET feed_url = 'https://cr-news-api-service.prd.crunchyrollsvc.com/v1/en-US/rss' WHERE name = 'Crunchyroll News' AND feed_url IS NULL;
UPDATE sources SET enabled = 0 WHERE name IN ('AniTrendz', 'Otaku USA') AND items_seen = 0 AND last_error IS NOT NULL;
