import { SeasonView } from './view';
import { seasonOf, seasonId, seasonLabel } from '@/lib/catalog';

const cur = seasonOf();
export const metadata = {
  title: `${seasonLabel(cur.season)} ${cur.year} anime season chart`,
  description: `Every new anime premiering in ${seasonLabel(cur.season)} ${cur.year}, plus last and next season, with where to watch each show.`,
  alternates: { canonical: `/season/${seasonId(cur)}/` },
};

export default function SeasonIndex() {
  return <SeasonView s={cur} isIndex />;
}
