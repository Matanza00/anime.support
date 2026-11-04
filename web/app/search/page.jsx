import Search from '@/components/Search';

export const metadata = { title: 'Search', description: 'Search anime news, shows and release dates.', alternates: { canonical: '/search/' }, robots: { index: false, follow: true } };

export default function SearchPage() {
  return (
    <div className="wrap">
      <header className="page-head"><h1>Search</h1></header>
      <div className="section"><Search /></div>
    </div>
  );
}
