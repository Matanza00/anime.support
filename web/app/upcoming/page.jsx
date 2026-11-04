import Listing, { sectionMetadata } from '@/components/Listing';

export const metadata = sectionMetadata('upcoming');
export default function Page() {
  return <Listing section="upcoming" />;
}
