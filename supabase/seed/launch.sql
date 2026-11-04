-- Evergreen launch articles (original content) so the site is not empty for AdSense review.
-- Safe to run more than once.
insert into articles (slug, title, excerpt, body_md, category, anime, cover_url, cover_credit, image_prompt, status, published_at, created_at, fb_posted) values
('anime-seasons-explained-winter-spring-summer-fall', 'Anime Seasons Explained: Why New Shows Arrive in January, April, July and October', 'Japan releases most new TV anime in four seasonal waves. Here''s how the calendar works and how to plan your watchlist around it.', 'If you have ever wondered why your feed suddenly fills with new anime trailers every few months, the answer is the seasonal calendar. Most Japanese TV anime premieres in one of four waves, and knowing how they work makes it much easier to keep up.

## The four seasons

The anime year is split into four broadcast seasons:

- **Winter** starts in January
- **Spring** starts in April
- **Summer** starts in July
- **Fall** starts in October

TV stations in Japan reshuffle their late-night schedules at these points, so studios aim new series at those slots. That is why you see a burst of premieres in the first two weeks of each of those months.

## What a "cour" means

You will often see the word **cour** in announcements. A cour is one broadcast season of roughly three months, which usually works out to 10 to 13 weekly episodes. A "two-cour" series runs for about six months, often with around 24 episodes, sometimes back to back and sometimes split with a break in between.

When a studio announces "Part 2 in the next cour", it means the story continues in the following three-month season.

## Why it matters

The calendar shapes almost everything about how fans watch anime. Streaming services publish their seasonal lineups a few weeks before each wave, trailers and key visuals peak in the month before a season starts, and the first two or three episodes decide which shows become the season''s breakout hits.

It also explains why sequel news often comes in the form "Season 2 is coming in April": studios plan around these fixed starting points.

## What''s next for your watchlist

A simple routine works well:

1. About a month before a new season, check the seasonal lineup and pick a handful of shows.
2. Watch the first three episodes of each, which is the traditional "three-episode rule".
3. Keep the ones you love and drop the rest without guilt.

Our [Upcoming](/upcoming) page tracks confirmed premieres, so you can see what is lined up for the next wave.', 'feature', '{}'::text[], '/launch/anime-seasons-explained-winter-spring-summer-fall.webp', 'Illustration: anime.support', 'four floating islands in a night sky, each showing a different season: snow, cherry blossoms, summer fireworks and autumn maple leaves', 'published', now() - interval '6 hours', now() - interval '6 hours', true),
('sub-vs-dub-what-simulcast-means', 'Sub vs Dub, Simulcasts and Simuldubs: How Anime Reaches You After Japan', 'What subtitles, dubs, simulcasts and simuldubs actually mean, why dubs arrive later, and how to pick the version that suits you.', 'Few debates in anime fandom run as long as sub versus dub. The good news is that today you rarely have to choose blindly. Here is what each term means and how the release timing works.

## Subs and dubs

- **Sub** (subtitled) keeps the original Japanese voice acting and adds translated text on screen.
- **Dub** (dubbed) replaces the voices with a new recording in another language, such as English, Spanish or Hindi.

Neither is "correct". Subs preserve the original performances, while dubs let you watch without reading, which many people prefer for action-heavy scenes or casual viewing.

## What a simulcast is

A **simulcast** is a subtitled episode that goes live on a streaming service shortly after it airs in Japan, often within hours. Before simulcasts became common, international fans could wait months or years for an official release. Now most new seasonal anime is simulcast worldwide on at least one platform.

## What a simuldub is

A **simuldub** is a dubbed episode released on a short delay, usually a few weeks after the Japanese broadcast. Dubbing takes longer because the script has to be adapted to match lip movements, and a full voice cast has to record every episode.

That is why you will often see announcements like "the English dub premieres in three weeks" alongside a show''s Japanese premiere date.

## Why it matters

Release timing changes how you experience a show. Watching the sub simulcast means you can join the conversation each week as episodes air. Waiting for the dub means a slightly delayed but more relaxed watch, and spoilers are the main risk.

## What''s next

Check which version your streaming service offers before you start a series, since availability varies by country. If you dislike spoilers, mute the show''s name on social media while you catch up.', 'feature', '{}'::text[], '/launch/sub-vs-dub-what-simulcast-means.webp', 'Illustration: anime.support', 'a cozy late-night room with a glowing screen showing an anime scene, headphones and a recording microphone on the desk, city lights outside the window', 'published', now() - interval '5 hours', now() - interval '5 hours', true),
('how-manga-becomes-anime-adaptation-explained', 'From Manga to Anime: How a Story Gets Adapted, and Why Some Seasons Take Years', 'Why studios adapt manga and light novels, how much story a season covers, and why fans wait years between seasons.', 'Most popular anime begins life as something else: a manga, a light novel or a web novel. Understanding how adaptation works explains a lot of the news you read, from "Season 3 confirmed" to "the anime caught up with the manga".

## Where the stories come from

- **Manga** are serialized comics, often published chapter by chapter in weekly or monthly magazines.
- **Light novels** are short novels with illustrations, frequently the source of fantasy and isekai series.
- **Web novels** start online and are sometimes later reworked into light novels.
- **Original anime** is written directly for animation, with no source material.

An adaptation gives a publisher a big promotional boost: sales of the original often jump when the anime airs.

## How much story fits into a season

There is no fixed rule, but a 12-episode season commonly adapts a few volumes of the source. Some adaptations move faster and condense events, while others slow down and add detail. That pacing choice is one of the most discussed parts of any new season.

## Why seasons can take years

Several things decide how quickly a sequel arrives:

- **Source material**: if the anime has caught up with the manga or novels, there may simply not be enough story yet.
- **Production schedules**: studios plan projects years ahead, and the same staff may be committed elsewhere.
- **Business results**: strong sales, streaming numbers and merchandise make a sequel far more likely.

## Why it matters

When you read that a studio has announced a new season, these factors explain the gap between the announcement and the premiere date. When an announcement only says "in production", a release date usually comes later in a separate reveal.

## What''s next

If you cannot wait for the next season, the source material is the place to continue the story. Our anime pages collect every confirmed update for each show, so you can see where things stand.', 'feature', '{}'::text[], '/launch/how-manga-becomes-anime-adaptation-explained.webp', 'Illustration: anime.support', 'a giant open book on a desk at night with ink drawings rising off the pages and turning into a full-color animated landscape', 'published', now() - interval '4 hours', now() - interval '4 hours', true),
('anime-announcement-terms-key-visual-pv-teaser', 'Key Visuals, PVs and Teasers: A Quick Guide to Anime Announcement Jargon', 'What key visuals, PVs, teasers, ''production decided'' and ''in production'' really mean when a studio announces new anime.', 'Anime news comes with its own vocabulary. Once you know the terms, a short announcement tells you a surprising amount about where a project stands.

## The terms you will see most

- **Production decided** or **anime adaptation announced**: the project officially exists. Usually there is no date yet.
- **In production**: work is underway. Staff and studio may be named.
- **Teaser**: a very short video, often just a logo, a few shots and a release window.
- **PV** (promotional video): a full trailer. Many shows release a first PV months before airing and a second closer to launch.
- **Key visual**: the main promotional illustration for a show or season, the image you see on posters and streaming pages.
- **Release window**: a broad timing such as "Spring" or "2027" rather than an exact date.

## Reading an announcement

Announcements tend to follow a pattern. First comes the confirmation, often with a teaser and a key visual. Then come staff and cast reveals, then a full PV with a release window, and finally an exact premiere date and the streaming platforms.

So if a show has just had its "production decided" moment, the premiere is usually still some way off. If it has a second PV and a date, the premiere is close.

## Why it matters

This is how we decide what is genuinely new. A fresh key visual or a confirmed date is real news. A rumour or a leaked image is not confirmed until the official account, studio or publisher posts it, and we always label unconfirmed reports clearly.

## What''s next

Follow a show''s page on our site to see each stage as it is confirmed, from the first teaser to premiere day.', 'feature', '{}'::text[], '/launch/anime-announcement-terms-key-visual-pv-teaser.webp', 'Illustration: anime.support', 'a dramatic cinema screen in a dark theater lit up by a vivid anime-style sunrise over a futuristic city, silhouettes of excited fans in the seats', 'published', now() - interval '3 hours', now() - interval '3 hours', true),
('anime-spoiler-etiquette-guide', 'Spoiler Etiquette for Anime Fans: How to Talk About Big Twists Without Ruining Them', 'Simple rules for sharing reactions to big anime moments online, plus how we handle spoilers in our own coverage.', 'Big anime moments travel fast. A character''s fate or a final twist can trend worldwide within an hour of an episode airing, which is exciting if you have watched it and painful if you have not.

## Why spoilers hit anime fans so hard

Anime fandom spans many time zones and release schedules. Some fans watch the moment an episode airs in Japan, others wait for the dub, and many read the manga years ahead. That means almost every conversation mixes people at very different points in the same story.

## Simple rules that work

- **Use spoiler tags** wherever a platform offers them.
- **Keep headlines and thumbnails clean.** Many people only see the title and the image.
- **Name the episode or chapter** before discussing it, so people can decide whether to read on.
- **Mark manga spoilers separately** in anime discussions. Anime-only fans will thank you.
- **Give it time.** A few days after a major episode, the window for clean viewing closes for most fans.

## How we handle spoilers

Our headlines never reveal deaths, endings or twists. When an article needs to mention a major plot point, we hide it behind a tap-to-reveal spoiler box like this one:

<details><summary>Spoiler: example</summary>This is where a spoiler would go. You only see it if you choose to open it.</details>

## Why it matters

Good spoiler habits keep fan spaces fun for everyone, especially for people discovering a series for the first time.

## What''s next

If you spot a spoiler in one of our articles that should have been hidden, [contact us](/contact) and we will fix it.', 'feature', '{}'::text[], '/launch/anime-spoiler-etiquette-guide.webp', 'Illustration: anime.support', 'a mysterious sealed envelope glowing on a wooden table, surrounded by floating cherry blossom petals in moonlight', 'published', now() - interval '2 hours', now() - interval '2 hours', true),
('how-to-follow-anime-news-without-falling-for-fake-leaks', 'How to Follow Anime News Without Falling for Fake Leaks', 'How to tell an official anime announcement from a rumour, and the warning signs of a fake leak.', 'Every big anime franchise attracts rumours: fake release dates, edited screenshots and "insider" posts. Some turn out true, but many do not. A few habits make it much easier to tell the difference.

## Where real announcements come from

Official news almost always appears first in one of these places:

- the anime''s **official website** or **official social media account**
- the **studio**, **publisher** or **manga magazine**
- the **streaming service** that holds the rights
- live events and conventions, where studios hold announcement panels

Established news outlets then report it, usually linking back to the official post.

## Warning signs of a fake leak

- No link to any official source, only a screenshot.
- Vague "trusted insider" claims with no track record.
- A logo, font or visual that looks slightly off compared with earlier official material.
- Precise dates appearing from nowhere, especially for shows that have not been announced.
- The same claim copied word for word across many small accounts.

## How we handle it

Every story on this site links its sources at the bottom. We report official announcements as confirmed, and if we mention a report that is not confirmed, we say so in plain words: "reportedly" or "unconfirmed". If a rumour later turns out to be false, we update the article.

## Why it matters

Fake leaks can set up disappointment, spread spoilers and sometimes even direct people to scam links. Checking the source takes a few seconds.

## What''s next

When you see surprising news, look for the official post first. If you find an error in our coverage, [let us know](/contact) and we will correct it.', 'feature', '{}'::text[], '/launch/how-to-follow-anime-news-without-falling-for-fake-leaks.webp', 'Illustration: anime.support', 'a detective-style anime scene: a magnifying glass over a wall of pinned glowing notes and photos connected by red string, in a dim neon-lit office', 'published', now() - interval '1 hours', now() - interval '1 hours', true)
on conflict (slug) do nothing;
