import Listing, { sectionMetadata } from '@/components/Listing';

export const metadata = sectionMetadata('all');
export default function Page() {
  return <Listing section="all" />;
}
