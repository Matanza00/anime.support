// Google Reader Revenue Manager (Publisher Center): shows the prompts set up there, such as the opt-in
// rewarded ad ("watch an ad to support anime.support"). Article pages only. The product ID must match the
// isPartOf.productID in the article's NewsArticle structured data.
import Script from 'next/script';

export const RRM_PRODUCT_ID = 'CAowyNXODA:openaccess';

export default function ReaderRevenue() {
  return (
    <>
      <Script src="https://news.google.com/swg/js/v1/swg-basic.js" strategy="lazyOnload" />
      <Script id="swg-basic" strategy="lazyOnload">{`
        (self.SWG_BASIC = self.SWG_BASIC || []).push(function (basicSubscriptions) {
          basicSubscriptions.init({
            type: "NewsArticle",
            isPartOfType: ["Product"],
            isPartOfProductId: "${RRM_PRODUCT_ID}",
            clientOptions: { theme: "dark", lang: "en" },
          });
        });
      `}</Script>
    </>
  );
}
