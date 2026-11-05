import { SITE } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <div className="about">
          <img src="/brand/logo-dark.svg" alt="anime.support" width={118} height={48} />
          <p>Independent anime news: confirmed announcements, release dates and what's coming next. Not affiliated with any studio or streaming service. Show data from AniList.</p>
          <p style={{ marginTop: 10 }}>© {new Date().getFullYear()} {SITE.name}</p>
        </div>
        <div>
          <h2>Sections</h2>
          <nav aria-label="Sections">
            <a href="/news/">News</a>
            <a href="/upcoming/">Upcoming</a>
            <a href="/releases/">Out now</a>
            <a href="/calendar/">Release calendar</a>
            <a href="/features/">Features</a>
            <a href="/anime/">Anime database</a>
            <a href="/schedule/">Airing schedule</a>
            <a href="/season/">Seasonal chart</a>
            <a href="/donghua/">Donghua</a>
            <a href="/contests/">Art contests</a>
          </nav>
        </div>
        <div>
          <h2>Site</h2>
          <nav aria-label="Site">
            <a href="/about/">About &amp; editorial policy</a>
            <a href="/contact/">Contact</a>
            <a href="/privacy/">Privacy policy</a>
            <a href="/terms/">Terms</a>
            <a href="/rss.xml">RSS feed</a>
          </nav>
        </div>
      </div>
    </footer>
  );
}
