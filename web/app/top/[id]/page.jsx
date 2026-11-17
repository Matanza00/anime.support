import { notFound } from 'next/navigation';
import { RankingView } from '../view';
import { rankingPages, rankingPage } from '@/lib/rankings';

export const dynamicParams = false;
export async function generateStaticParams() {
  const ids = (await rankingPages()).filter((p) => !p.id.includes('/')).map((p) => ({ id: p.id }));
  return ids.length ? ids : [{ id: 'none' }];
}

export async function generateMetadata({ params }) {
  const p = await rankingPage((await params).id);
  if (!p) return { robots: { index: false } };
  return { title: p.title, description: p.description, alternates: { canonical: `/top/${p.id}/` }, openGraph: { title: p.title, description: p.description, url: `/top/${p.id}/` } };
}

export default async function Page({ params }) {
  const p = await rankingPage((await params).id);
  if (!p) notFound();
  return <RankingView p={p} />;
}
