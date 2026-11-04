import Listing, { pageParams, sectionMetadata } from '@/components/Listing';

export const dynamicParams = false;
export const generateStaticParams = () => pageParams('feature');
export async function generateMetadata({ params }) {
  return sectionMetadata('feature', Number((await params).n));
}
export default async function Page({ params }) {
  return <Listing section="feature" page={Number((await params).n)} />;
}
