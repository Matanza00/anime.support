import AdminPanel from '@/components/studio/AdminPanel';

export const metadata = { title: 'Moderation', robots: { index: false, follow: false } };

export default function Admin() {
  return (
    <div className="wrap">
      <header className="page-head"><p className="eyebrow">Creator Studio</p><h1>Moderation and admin</h1></header>
      <div className="section"><AdminPanel /></div>
    </div>
  );
}
