import Listing, { pageParams, sectionMetadata } from '@/components/Listing';

export const dynamicParams = false;
export const generateStaticParams = () => pageParams('upcoming');
export async function generateMetadata({ params }) {
  return sectionMetadata('upcoming', Number((await params).n));
}
export default async function Page({ params }) {
  return <Listing section="upcoming" page={Number((await params).n)} />;
}
