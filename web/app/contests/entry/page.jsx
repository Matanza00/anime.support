import EntryView from '@/components/studio/EntryView';

export const metadata = { title: 'Contest entry', robots: { index: false, follow: true } };

export default function EntryPage() {
  return <div className="wrap section"><EntryView /></div>;
}
