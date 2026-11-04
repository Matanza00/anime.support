-- Run this ONLY if you already ran schema.sql before media support was added.
-- (New installs: schema.sql already includes these columns.)
alter table articles add column if not exists cover_url text;
alter table articles add column if not exists cover_credit text;
alter table articles add column if not exists media jsonb not null default '[]';
alter table articles add column if not exists image_candidates jsonb not null default '[]';
alter table articles add column if not exists social_card_url text;
alter table articles add column if not exists image_prompt text;

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

alter table sources add column if not exists feed_etag text;
alter table sources add column if not exists feed_last_modified text;

create table if not exists bot_state (
  key        text primary key,
  value      jsonb not null default '{}',
  updated_at timestamptz not null default now()
);
alter table bot_state enable row level security;
