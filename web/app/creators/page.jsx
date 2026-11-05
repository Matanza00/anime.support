import CreatorProfile from '@/components/studio/CreatorProfile';

export const metadata = { title: 'Creator', robots: { index: false, follow: true } };

export default function CreatorPage() {
  return <div className="wrap section"><CreatorProfile /></div>;
}
