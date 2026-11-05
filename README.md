# anime.support: automated anime news site

Live at **https://anime.support**

A Next.js anime news site (static export, dark glass design) on Cloudflare, plus a news bot that runs on GitHub Actions. Every
2 hours the bot reads anime news feeds, groups duplicate headlines, writes an **original** draft
with AI and creates **original artwork** for it. You approve drafts in a dashboard on your laptop;
the next run deploys them to Cloudflare and posts them to your Facebook Page with a headline card.
Each week it learns which anime readers want and prioritises them.

```
GitHub Actions (every 2 h) ─► Cloudflare D1 (drafts + images) ─► you approve (laptop dashboard)
        │                                                          │
        └─► next run: deploy to Cloudflare ─► Facebook post ◄───────┘
weekly: AniList trending + your view counts ─► what the bot writes about next
```

| Part | Runs on | Cost |
| --- | --- | --- |
| Website `web/` (Next.js 16) | Cloudflare Workers static assets | Free, ads allowed |
| Bot `bot/` | GitHub Actions (`.github/workflows/bot.yml`) | Free (public repo) or ~1,100 of 2,000 free min/month (private) |
| Review dashboard | Your laptop: `npm run review` | Free |
| Database + images | Cloudflare D1 (5 GB, never pauses) | Free |
| View counter | Cloudflare Worker `worker/index.js` (`/api/view`) | Free |
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

### 2. Database (automatic)
Nothing to do by hand. Every deploy runs `database/setup.mjs`, which creates the Cloudflare D1
database `anime-support` the first time, applies `database/schema.sql` (existing data is kept) and
publishes the six launch articles if the database is empty. Browse or edit data any time in
Cloudflare → **Storage & databases → D1 → anime-support → Console**.

Images (bot artwork and your uploads) are stored in D1's `media` table and copied into the site as
plain files at every deploy, so serving them costs nothing.

### 3. GitHub secrets
Repo → **Settings → Environments → Env → Environment secrets** (the workflows use the `Env` environment):

| Secret | Where to get it |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Cloudflare → My Profile → API Tokens → template **Edit Cloudflare Workers**, then **add Account · D1 · Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right sidebar |
| `LLM_API_KEY` | Your OpenRouter (or OpenAI) key |
| `FB_PAGE_ID`, `FB_PAGE_TOKEN` | Optional, see Facebook below |
| `GH_DISPATCH_TOKEN` | Recommended. Lets the Cloudflare timer start the bot on time (see below) |

Optional **variables** (same page, Variables tab): `LLM_MODEL`, `LLM_BASE_URL`, `IMAGE_MODEL`,
`IMAGE_PROVIDER` (`openrouter`, `openai` or `none`), `MAX_DRAFTS_PER_RUN`, `CATALOG_SUMMARIES_PER_RUN`
(new show overviews per daily run, default 60), and the auto-publish settings below.

**On-time runs (`GH_DISPATCH_TOKEN`).** GitHub's own schedule often runs late or skips runs. The site's
Cloudflare Worker has a reliable timer (`wrangler.jsonc` → `triggers`) that starts the bot instead:
GitHub → Settings → Developer settings → **Fine-grained tokens** → Generate. Repository access: only
`Matanza00/anime.support`. Permissions: **Actions: Read and write**. Save it as the `GH_DISPATCH_TOKEN`
secret in `Env`; the next deploy hands it to the Worker (the deploy report says "Cloudflare timer: on").

**Auto-publish (optional).** By default every draft waits for your approval. Set the variable
`AUTO_PUBLISH` = `on` to publish drafts the AI is very sure about without review
(`AUTO_PUBLISH_MIN_CONFIDENCE`, default 0.85; `AUTO_PUBLISH_MAX_PER_DAY`, default 8). Faster, but AdSense
penalises unreviewed rewritten content, so read the auto-published stories each day and fix or unpublish.

### 4. First deploy
Pushing to `main` deploys automatically (or Actions tab → **Deploy site** → Run workflow). The result
of the last deploy, with its log, is saved to `.github/status/deploy.md`. Then **News bot** → Run
workflow → `collect-and-publish` for the first drafts.

### 5. Review dashboard on your laptop
```bash
git clone https://github.com/Matanza00/anime.support.git
cd anime.support/bot
npm install
cp .env.example .env     # Cloudflare account ID + API token, REVIEW_PASSWORD
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

## The website (`web/`)
Next.js 16 App Router with `output: 'export'`: every page is pre-rendered to plain HTML at build
time, so Cloudflare serves it from the edge with no server and no cold starts. Pages:

| Page | What it is |
| --- | --- |
| `/` | Featured story, top stories, most read, coming-soon countdowns, latest news, section rails, trending chart |
| `/news/`, `/upcoming/`, `/releases/`, `/features/` | Sections, 24 stories per page with numbered pages |
| `/news/<slug>/` | Article: breadcrumbs, share buttons, reading progress, table of contents, embeds, sources, related |
| `/calendar/` | Release calendar of officially confirmed dates, grouped by month, with live countdowns |
| `/anime/`, `/anime/<name>/` | A–Z of shows and an evergreen hub per anime |
| `/search/` | Instant search (built-in index, no server) |
| `/sitemap.xml`, `/news-sitemap.xml`, `/rss.xml`, `/robots.txt`, `/ads.txt` | Generated on every build |

SEO built in: per-page titles, descriptions and canonical URLs (Next.js Metadata API), Open Graph
and Twitter cards, `NewsArticle`, `BreadcrumbList`, `WebSite` + search and `Organization` structured
data, `max-image-preview:large`, Google News sitemap, image sitemap entries and self-hosted fonts.

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
- Files go to the D1 `media` table with a new filename each time, so caches never show an old image. Uploads over 1.4 MB are shrunk to WebP automatically; for video, paste a YouTube link.

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

## Anime database, schedule and seasons
Once a day the bot's `catalog` task reads [AniList](https://anilist.co)'s free public API and saves, for
roughly 2,000 shows: titles, format, dates, studios, genres, cover art, trailers, the next episode and the
**official** streaming links (only licensed services; piracy sites are never linked). It also saves every
episode airing in the next 8 days, and writes an original 90–150 word overview for the most popular
shows that don't have one yet. The site turns this into:

- `/anime/<show>/`: facts, where to watch, next-episode countdown, trailer, our overview, all our news about
  it, other seasons and similar shows. Pages without our own overview or news are `noindex` until they have one.
- `/schedule/`: the week's episodes in the visitor's own time zone, with live countdowns.
- `/season/<season-year>/`: last, current and next season charts. `/donghua/`: Chinese anime.
- `/anime/browse/<letter>/`: A–Z.

Run it by hand: put `catalog` on the first line of `.github/run-bot.txt` and push, or Actions →
News bot → Run workflow → `catalog`. AniList's API is free for non-commercial use and for sites earning
under its limit; check their terms as the site grows. We do not scrape streaming or piracy sites.

## Creator Studio (art contests)
Monthly contests for 2D art, 3D characters, 3D environments and animation at `/contests/`. People sign in
with Google or Apple, upload one entry per contest (images, GLB 3D models shown in a 3D viewer, MP4/WebM),
vote (3 votes per contest), comment, follow creators and link their own support pages (Ko-fi, Patreon...).

- **Roles:** user · moderator (review entries, reports, comments, votes) · admin (+ contests, winners, roles, bans).
  Moderation lives at `/studio-admin/`.
- **Fair play:** every entry is reviewed before it appears; vote counts are hidden until voting closes; accounts
  must be 24 h old with a verified email to vote; each vote stores a hashed IP so vote rings show up in "Vote
  check"; moderators can remove votes; the top entry is verified before the admin confirms the winner.
- **Storage:** uploads go to an R2 bucket (`anime-support-uploads`, 10 GB free) when R2 is enabled on the
  Cloudflare account, otherwise to a KV namespace (1 GB free). The deploy creates it; the deploy report says which.
- **Contests:** 4 draft contests are created on first deploy. In `/studio-admin/` → Contests, set the prize and
  dates and switch them to Published; the public pages rebuild automatically.

Settings (GitHub → Settings → Environments → Env):

| Name | Type | What |
| --- | --- | --- |
| `ADMIN_EMAILS` | variable | Your Google/Apple email(s), comma-separated: these accounts become admins on sign-in |
| `GOOGLE_CLIENT_ID` | variable | Google Cloud → APIs & Services → Credentials → OAuth client (Web). Redirect URI: `https://anime.support/api/auth/google/callback` |
| `GOOGLE_CLIENT_SECRET` | secret | From the same OAuth client |
| `APPLE_SERVICES_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` | variables | Apple Developer account (paid): Services ID with return URL `https://anime.support/api/auth/apple/callback` |
| `APPLE_PRIVATE_KEY` | secret | The .p8 key file's contents |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | variable / secret | Optional: Cloudflare Turnstile "I am human" check on uploads and votes |
| `HASH_SALT` | secret | Optional: any long random text for hashing IPs |

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
| `node src/index.js catalog` | Refresh the anime database and schedule, once |
| `npm run seed` | Publish the launch articles (if not already in the database) |
| `npm test` | Unit tests |

Preview the design locally with demo stories: `cd web && npm install && SAMPLE_DATA=1 npm run dev`.

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
