import AccountPage from '@/components/studio/AccountPage';

export const metadata = { title: 'Your account', robots: { index: false, follow: false } };

export default function Account() {
  return (
    <div className="wrap">
      <header className="page-head"><p className="eyebrow">Creator Studio</p><h1>Your account</h1></header>
      <div className="section"><AccountPage /></div>
    </div>
  );
}
