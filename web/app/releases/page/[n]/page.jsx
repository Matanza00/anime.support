import Listing, { pageParams, sectionMetadata } from '@/components/Listing';

export const dynamicParams = false;
export const generateStaticParams = () => pageParams('release');
export async function generateMetadata({ params }) {
  return sectionMetadata('release', Number((await params).n));
}
export default async function Page({ params }) {
  return <Listing section="release" page={Number((await params).n)} />;
}
