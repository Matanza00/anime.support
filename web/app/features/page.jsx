import Listing, { sectionMetadata } from '@/components/Listing';

export const metadata = sectionMetadata('feature');
export default function Page() {
  return <Listing section="feature" />;
}
