import Listing, { pageParams, sectionMetadata } from '@/components/Listing';

export const dynamicParams = false;
export const generateStaticParams = () => pageParams('all');
export async function generateMetadata({ params }) {
  return sectionMetadata('all', Number((await params).n));
}
export default async function Page({ params }) {
  return <Listing section="all" page={Number((await params).n)} />;
}
