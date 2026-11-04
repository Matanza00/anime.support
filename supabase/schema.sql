-- anime.support database schema
-- Paste this whole file into Supabase > SQL Editor > New query > Run.

-- 1. News sources the bot watches (seeded below, editable any time)
create table if not exists sources (
  id            bigint generated always as identity primary key,
  name          text not null unique,
  homepage      text not null,
  feed_url      text,                       -- auto-discovered if empty
  tier          text not null default 'daily' check (tier in ('daily','weekly','monthly')),
  enabled       boolean not null default true,
  items_seen    int not null default 0,
  items_used    int not null default 0,     -- items that became published articles
  last_ok_at    timestamptz,
  last_error    text,
  feed_etag     text,                       -- lets the bot skip unchanged feeds
  feed_last_modified text,
  created_at    timestamptz not null default now()
);

-- 2. Raw headlines collected from feeds (never shown on the site)
create table if not exists raw_items (
  id            bigint generated always as identity primary key,
  source_id     bigint references sources(id) on delete cascade,
  url           text not null unique,
  title         text not null,
  summary       text,
  published_at  timestamptz,
  fetched_at    timestamptz not null default now(),
  cluster_key   text,                       -- items about the same story share this
  status        text not null default 'new' check (status in ('new','drafted','skipped'))
);
create index if not exists raw_items_status_idx on raw_items(status, fetched_at desc);

-- 3. Articles: drafts written by the bot, approved by you, shown on the site
create table if not exists articles (
  id            bigint generated always as identity primary key,
  slug          text not null unique,
  title         text not null,
  excerpt       text not null,
  body_md       text not null,
  category      text not null default 'news' check (category in ('news','upcoming','release','feature')),
  anime         text[] not null default '{}',   -- e.g. {'Jujutsu Kaisen'}
  source_urls   text[] not null default '{}',
  source_names  text[] not null default '{}',
  cluster_key   text,
  priority      real not null default 1,
  status        text not null default 'draft' check (status in ('draft','published','rejected')),
  created_at    timestamptz not null default now(),
  published_at  timestamptz,
  updated_at    timestamptz not null default now(),
  confidence    real,                         -- AI's self-rated fact confidence (0-1)
  cover_url     text,                         -- hero/card image
  cover_credit  text,                         -- e.g. "Key visual: MAPPA via AniList"
  media         jsonb not null default '[]',  -- [{type,url,caption,credit}] embeds shown in the article
  image_candidates jsonb not null default '[]', -- images the bot found; you pick in the dashboard
  social_card_url text,                       -- branded headline card for Facebook
  image_prompt  text,                         -- scene used to generate the original artwork
  fb_caption    text,
  fb_posted     boolean not null default false,
  fb_post_id    text,
  views         int not null default 0
);
create index if not exists articles_status_idx on articles(status, published_at desc);
create index if not exists articles_anime_idx on articles using gin(anime);

-- 4. Which anime get viewed most (the optimizer writes here weekly)
create table if not exists anime_focus (
  name          text primary key,
  weight        real not null default 1,      -- >1 = cover more, <1 = cover less
  views_7d      int not null default 0,
  articles_7d   int not null default 0,
  pinned        boolean not null default false, -- true = never down-weight
  updated_at    timestamptz not null default now()
);

-- 5. Daily views per article (for the optimizer)
create table if not exists article_views_daily (
  article_id    bigint references articles(id) on delete cascade,
  day           date not null default current_date,
  views         int not null default 0,
  primary key (article_id, day)
);

-- 6. Public view counter, callable from the website with the anon key
create or replace function increment_view(p_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_id bigint;
begin
  update articles set views = views + 1
   where slug = p_slug and status = 'published'
  returning id into v_id;
  if v_id is not null then
    insert into article_views_daily(article_id, day, views)
    values (v_id, current_date, 1)
    on conflict (article_id, day) do update set views = article_views_daily.views + 1;
  end if;
end $$;

-- 7. Security: the website (anon key) can only READ published articles
--    and call increment_view. Everything else needs the service key (bot only).
alter table sources              enable row level security;
alter table raw_items            enable row level security;
alter table articles             enable row level security;
alter table anime_focus          enable row level security;
alter table article_views_daily  enable row level security;

drop policy if exists "public reads published" on articles;
create policy "public reads published" on articles
  for select to anon using (status = 'published');

revoke all on function increment_view(text) from public;
grant execute on function increment_view(text) to anon;

-- 8. Starter sources. Daily = breaking news, weekly = trend charts,
--    monthly = seasonal/upcoming coverage. Edit freely in the Table Editor.
insert into sources (name, homepage, feed_url, tier) values
  ('Anime News Network', 'https://www.animenewsnetwork.com/', 'https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w', 'daily'),
  ('Crunchyroll News',   'https://www.crunchyroll.com/news', null, 'daily'),
  ('AniTrendz',          'https://anitrendz.net/news/', 'https://anitrendz.net/news/feed/', 'weekly'),
  ('Otaku USA',          'https://otakuusamagazine.com/', 'https://otakuusamagazine.com/feed/', 'monthly')
on conflict (name) do nothing;

-- 9. Public storage bucket for images/videos you upload from the review dashboard
--    (free tier: 1 GB). Anyone can view files; only the bot (service key) can upload.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 10. Small key/value store for the bot (e.g. last deploy time), shared by laptop and GitHub Actions
create table if not exists bot_state (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table bot_state enable row level security;
