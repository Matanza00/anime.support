import { notFound } from 'next/navigation';
import { SeasonView } from '../view';
import { parseSeasonId, seasonWindow, seasonId, seasonLabel } from '@/lib/catalog';

export const dynamicParams = false;
export const generateStaticParams = () => seasonWindow().map((s) => ({ id: seasonId(s) }));

export async function generateMetadata({ params }) {
  const s = parseSeasonId((await params).id);
  if (!s) return {};
  const name = `${seasonLabel(s.season)} ${s.year}`;
  return {
    title: `${name} anime season chart: every new show`,
    description: `All the new anime of ${name}: TV series, films, web series and donghua, most popular first, with premiere dates and where to watch.`,
    alternates: { canonical: `/season/${seasonId(s)}/` },
  };
}

export default async function SeasonPage({ params }) {
  const s = parseSeasonId((await params).id);
  if (!s) notFound();
  return <SeasonView s={s} />;
}
