import Listing, { sectionMetadata } from '@/components/Listing';

export const metadata = sectionMetadata('release');
export default function Page() {
  return <Listing section="release" />;
}
