import AdminPanel from '@/components/studio/AdminPanel';

export const metadata = { title: 'Admin', robots: { index: false, follow: false } };

export default function Admin() {
  return (
    <div className="wrap">
      <header className="page-head"><p className="eyebrow">Creator Studio</p><h1>Admin</h1></header>
      <div className="section"><AdminPanel /></div>
    </div>
  );
}
