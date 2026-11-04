# anime.support: automated anime news site

Live at **https://anime.support**

A static anime news site (Astro) on Cloudflare, plus a news bot that runs on GitHub Actions. Every
2 hours the bot reads anime news feeds, groups duplicate headlines, writes an **original** draft
with AI and creates **original artwork** for it. You approve drafts in a dashboard on your laptop;
the next run deploys them to Cloudflare and posts them to your Facebook Page with a headline card.
Each week it learns which anime readers want and prioritises them.

```
GitHub Actions (every 2 h) ─► Supabase (drafts + images) ─► you approve (laptop dashboard)
        │                                                          │
        └─► next run: deploy to Cloudflare ─► Facebook post ◄───────┘
weekly: AniList trending + your view counts ─► what the bot writes about next
```

| Part | Runs on | Cost |
| --- | --- | --- |
| Website `site/` | Cloudflare Workers static assets | Free, ads allowed |
| Bot `bot/` | GitHub Actions (`.github/workflows/bot.yml`) | Free (public repo) or ~1,100 of 2,000 free min/month (private) |
| Review dashboard | Your laptop: `npm run review` | Free |
| Database + images | Supabase free tier | Free |
| AI text + images | OpenRouter / OpenAI | A few cents per article |

---

## One-time setup

### 1. Domain on Cloudflare
Add **anime.support** to your Cloudflare account (Websites → Add a domain → Free plan) and set the
nameservers at your registrar to the two Cloudflare gives you. The deploy creates the DNS records
for `anime.support` and `www.anime.support` itself, so you add none by hand.

**Contact email:** in Cloudflare → anime.support → **Email Routing**, forward
`contact@anime.support` to your Gmail (free). The site's Contact page uses that address, and
AdSense reviewers check it.

### 2. Supabase
Create a free project, then in **SQL Editor** run `supabase/schema.sql`, then `supabase/seed/launch.sql`
(six original launch articles). Put the project URL and **anon** key in `site/.env.production`
and commit it. Both are public by design; row-level security protects the data.

### 3. GitHub secrets
Repo → **Settings → Secrets and variables → Actions**:

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → template **Edit Cloudflare Workers** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right sidebar |
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_KEY` | Same page, **service_role** key (secret) |
| `LLM_API_KEY` | Your OpenRouter (or OpenAI) key |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | Optional, see Facebook below |

Optional **variables** (same page, Variables tab): `LLM_MODEL`, `LLM_BASE_URL`, `IMAGE_MODEL`,
`IMAGE_PROVIDER` (`openrouter`, `openai` or `none`), `MAX_DRAFTS_PER_RUN`.

### 4. First deploy
Actions tab → **Deploy site** → Run workflow. Then **News bot** → Run workflow → `collect-and-publish`.

### 5. Review dashboard on your laptop
```bash
git clone https://github.com/Matanza00/anime.support.git
cd anime.support/bot
npm install
cp .env.example .env     # Supabase URL + service key, REVIEW_PASSWORD
npm run review           # http://localhost:4000 (phone: http://<laptop-ip>:4000)
```
Use `npm run review`, not `npm start`: GitHub already runs the schedules, and running both would
duplicate work. `npm start` is only for running everything on the laptop instead of GitHub.

---

## AdSense
Publisher `ca-pub-2096559874399104` is built in: the AdSense script, the `google-adsense-account`
meta tag and `/ads.txt` are on every build.
1. AdSense → **Sites → Add site** → `anime.support`.
2. **Privacy & messaging** → create the GDPR consent message (required for EU/UK visitors).
3. Apply once you have **25–30 published articles**: the six launch pieces plus about a week of approved news.
4. After approval, turn on **Auto ads**. Optional manual units go in `PUBLIC_ADSENSE_SLOT_*`.

---

## Original media, fully automatic
For every draft the bot creates, with no input from you:

| Image | Size | Used for |
| --- | --- | --- |
| **Hero illustration** (no text) | 1600×900 WebP | Cover, cards, `og:image`, Google Discover |
| **Headline card** (title + category + brand) | 1200×630 JPEG | Facebook photo post |

- The AI writes a short **scene description** for each story (mood, genre, setting). The image model draws an original illustration from it. It is told never to draw existing characters, logos or lettering, so you own what it makes.
- No image API key, or the API fails? It falls back to **procedural art**: unique night scenes (mountains, torii gates, city skylines, seas, sakura) generated from the article's slug, free and instant.
- The headline card is rebuilt when you approve, so headline edits are always reflected.
- In the dashboard: edit the scene text and tap **Create new artwork**, or pick AniList art or a source image instead.
- Files go to the Supabase Storage bucket `media` with a new filename each time, so caches never show an old image.

Image cost: roughly a few US cents per image with `google/gemini-2.5-flash-image`. Set `IMAGE_PROVIDER=none` for free procedural art only.

Also attached automatically: trailers and X/Instagram/TikTok posts embedded in the source
articles. YouTube loads as a lightweight thumbnail until tapped.

---

## Optimisations built in
**Scraping**
- **Conditional requests** (ETag / Last-Modified): unchanged feeds answer "304 not modified", so hourly runs are light for you and for the sources.
- **robots.txt respected**: article pages a site disallows for bots are never fetched. The bot then works from the feed summary only.
- Pages are read only for facts. Text is always rewritten, and sources are always credited and linked.

**Choosing what to write**
- **Cold start:** at startup and weekly, AniList's top-30 trending anime get a priority boost, so the first drafts cover what fans are searching for.
- **Learning:** after that, each anime's weight comes from your own views per article (0.3× to 3×). Learned weights always beat the trending boost.
- Stories covered by several outlets, and fresher stories, rank higher.

**Search and Discover**
- `max-image-preview:large` and 1600px text-free hero images, matching Google Discover's image guidance.
- **Google News sitemap** at `/news-sitemap.xml`, with the last 48 hours of articles as Google requires, plus the regular sitemap.
- `NewsArticle` structured data with image, dates and publisher.
- Evergreen hub pages per anime (`/anime/<name>`) keep ranking after news posts fade.
- Fast pages: static HTML, lazy images, YouTube facades and long-term caching of assets, all of which help Core Web Vitals and therefore ad revenue.

**Facebook**
- Default `FB_POST_MODE=photo` posts the branded headline card with the link in the caption. Use `link` for classic link-preview posts.

---

## Daily routine (10–20 minutes)
1. Open the dashboard. Drafts are sorted by priority.
2. Check each one against its sources, sharpen the headline, check the artwork, then approve or reject.
3. Tap **Deploy now** for breaking news; everything else goes live on the next 2-hourly run.

Drafts tagged **check facts** mean the AI was unsure. AdSense doesn't allow unreviewed
auto-generated or rewritten content, so this review step is what keeps the account safe.

## Commands (in `bot/`)
| Command | Does |
| --- | --- |
| `npm run review` | Review dashboard only (use this when GitHub Actions runs the bot) |
| `npm start` | Scheduler + dashboard (everything on the laptop instead of GitHub) |
| `npm run collect` | Fetch feeds, then draft, once |
| `npm run draft` | Draft from fetched headlines |
| `npm run publish` | Deploy approved articles + Facebook, once |
| `npm run optimize` | Trending seed + learning + source ranking, once |
| `npm run seed` | Publish the launch articles (if not already in the database) |
| `npm test` | Unit tests |

Preview the design locally with demo stories: `cd site && npm install && SAMPLE_DATA=1 npm run dev`.

## Facebook Page auto-posting (optional)
1. Create an app at developers.facebook.com (type **Business**).
2. In **Graph API Explorer**, pick the app and your Page, add `pages_manage_posts` and `pages_read_engagement`, generate a token, and exchange it for a **long-lived Page token**.
3. Add `FB_PAGE_ID` and `FB_PAGE_TOKEN` as GitHub secrets (and in `bot/.env` if the laptop runs the bot).

AdSense doesn't run on Facebook; Meta pays through its own Content Monetization program once the Page qualifies.

## Rights
The bot's artwork is original. Anime titles and studio art belong to their owners: keep credits on
any AniList or press art you choose, embed official trailers from YouTube, and remove anything you
get a complaint about. The Contact page offers removal requests. AniList's API is free for sites
earning under $150 a month; above that, AniList asks you to get a commercial licence.
