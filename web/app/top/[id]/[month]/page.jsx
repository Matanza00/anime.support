import { notFound } from 'next/navigation';
import { RankingView } from '../../view';
import { rankingPages, rankingPage } from '@/lib/rankings';

export const dynamicParams = false;
export async function generateStaticParams() {
  const ids = (await rankingPages()).filter((p) => p.id.includes('/')).map((p) => ({ id: p.id.split('/')[0], month: p.id.split('/')[1] }));
  return ids.length ? ids : [{ id: 'none', month: 'none' }];
}

export async function generateMetadata({ params }) {
  const { id, month } = await params;
  const p = await rankingPage(`${id}/${month}`);
  if (!p) return { robots: { index: false } };
  return { title: p.title, description: p.description, alternates: { canonical: `/top/${p.id}/` }, openGraph: { title: p.title, description: p.description, url: `/top/${p.id}/` } };
}

export default async function Page({ params }) {
  const { id, month } = await params;
  const p = await rankingPage(`${id}/${month}`);
  if (!p) notFound();
  return <RankingView p={p} />;
}
