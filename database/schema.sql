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

-- Starter sources. daily = breaking news, weekly = trend charts, monthly = seasonal/upcoming coverage.
INSERT OR IGNORE INTO sources (name, homepage, feed_url, tier) VALUES
  ('Anime News Network', 'https://www.animenewsnetwork.com/', 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w', 'daily'),
  ('Crunchyroll News',   'https://www.crunchyroll.com/news', NULL, 'daily'),
  ('AniTrendz',          'https://anitrendz.net/news/', 'https://anitrendz.net/news/feed/', 'weekly'),
  ('Otaku USA',          'https://otakuusamagazine.com/', 'https://otakuusamagazine.com/feed/', 'monthly');
