import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import BreakingTicker from '@/components/layout/BreakingTicker';
import ArticleCard from '@/components/articles/ArticleCard';
import SmartBlock from '@/components/articles/SmartBlock';
import MostRead from '@/components/articles/MostRead';
import { getHomepageArticles, getActiveSmartBlocks, getMostViewedArticles } from '@/lib/db/queries';

/**
 * Homepage - Sabq News
 * Server Component with ISR (revalidate every 60 seconds).
 */

export const revalidate = 60;

export default async function HomePage() {
  const [allArticles, smartBlocks, mostViewed] = await Promise.all([
    getHomepageArticles(30),
    getActiveSmartBlocks(),
    getMostViewedArticles(10),
  ]);

  const featuredArticle = allArticles.find((a) => a.isFeatured) || allArticles[0];
  const sideArticles = allArticles.filter((a) => a.id !== featuredArticle?.id).slice(0, 4);
  const remainingArticles = allArticles.filter(
    (a) => a.id !== featuredArticle?.id && !sideArticles.find((s) => s.id === a.id)
  );

  const blocksBelowFeatured = smartBlocks.filter((b) => b.placement === 'below_featured');
  const blocksAboveAllNews = smartBlocks.filter((b) => b.placement === 'above_all_news');
  const blocksBetween = smartBlocks.filter((b) => b.placement === 'between_all_and_murqap');
  const blocksAboveFooter = smartBlocks.filter((b) => b.placement === 'above_footer');

  return (
    <>
      <Header />
      <BreakingTicker />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 py-6">

          {/* HERO SECTION */}
          <section className="mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2">
                {featuredArticle && (
                  <ArticleCard article={featuredArticle} variant="featured" priority />
                )}
              </div>
              <div className="space-y-1">
                {sideArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} variant="compact" />
                ))}
              </div>
            </div>
          </section>

          {blocksBelowFeatured.map((block) => (
            <SmartBlock key={block.id} block={block} />
          ))}
          {blocksAboveAllNews.map((block) => (
            <SmartBlock key={block.id} block={block} />
          ))}

          {/* MAIN CONTENT + SIDEBAR */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
            <div className="lg:col-span-2">
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-1 h-6 rounded-full bg-[#C0392B]" />
                  <h2 className="text-lg font-bold text-[#0D0D0D]">آخر الأخبار</h2>
                  <div className="flex-1 h-px bg-[#D4D4CC]" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {remainingArticles.slice(0, 8).map((article, idx) => (
                    <ArticleCard key={article.id} article={article} variant="standard" priority={idx < 2} />
                  ))}
                </div>
              </div>

              {blocksBetween.map((block) => (
                <SmartBlock key={block.id} block={block} />
              ))}

              {remainingArticles.length > 8 && (
                <div className="mt-8">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-1 h-6 rounded-full bg-[#B8860B]" />
                    <h2 className="text-lg font-bold text-[#0D0D0D]">المزيد من الأخبار</h2>
                    <div className="flex-1 h-px bg-[#D4D4CC]" />
                  </div>
                  <div className="space-y-4">
                    {remainingArticles.slice(8).map((article) => (
                      <ArticleCard key={article.id} article={article} variant="horizontal" />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <aside className="space-y-6">
              <MostRead articles={mostViewed} />
              <div className="bg-[#F8F8F6] border border-[#D4D4CC] rounded-[4px] h-64 flex items-center justify-center">
                <span className="text-xs text-[#7A7A72]">مساحة إعلانية</span>
              </div>
            </aside>
          </div>

          {blocksAboveFooter.length > 0 && (
            <div className="mt-8">
              {blocksAboveFooter.map((block) => (
                <SmartBlock key={block.id} block={block} />
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
