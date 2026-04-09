import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ArticleCard from '@/components/articles/ArticleCard';
import { getArticleBySlug, getRelatedArticles } from '@/lib/db/queries';
import { formatDateAr, formatRelativeTimeAr, getImageUrl, stripHtml } from '@/lib/utils';

/**
 * Article Page - Sabq News
 * 
 * SSR with ISR (revalidate every 120 seconds).
 * Full article content with:
 * - Dynamic OG tags and metadata
 * - Schema.org NewsArticle structured data
 * - Related articles
 * - Author info
 */

export const revalidate = 120;

interface ArticlePageProps {
  params: Promise<{ slug: string }>;
}

// Dynamic metadata for SEO and social sharing
export async function generateMetadata({ params }: ArticlePageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    return { title: 'المقال غير موجود' };
  }

  const seo = article.seo as {
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    socialTitle?: string;
    socialDescription?: string;
    ogImageUrl?: string;
  } | null;

  const title = seo?.metaTitle || article.title;
  const description = seo?.metaDescription || article.excerpt || stripHtml(article.content).slice(0, 160);
  const ogImage = seo?.ogImageUrl || article.imageUrl || article.thumbnailUrl;

  return {
    title,
    description,
    keywords: seo?.keywords?.join(', '),
    openGraph: {
      title: seo?.socialTitle || title,
      description: seo?.socialDescription || description,
      type: 'article',
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      authors: article.authorFirstName ? [`${article.authorFirstName} ${article.authorLastName || ''}`] : undefined,
      section: article.categoryName || undefined,
      images: ogImage ? [{ url: ogImage, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: seo?.socialTitle || title,
      description: seo?.socialDescription || description,
      images: ogImage ? [ogImage] : undefined,
    },
    alternates: {
      canonical: `/article/${slug}`,
    },
  };
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  // Fetch related articles
  const relatedArticles = article.categoryId
    ? await getRelatedArticles(article.categoryId, article.id, 6)
    : [];

  const authorName = article.authorFirstName
    ? `${article.authorFirstName} ${article.authorLastName || ''}`.trim()
    : 'سبق';

  const imageUrl = getImageUrl(article.thumbnailUrl, article.imageUrl);
  const focalPoint = article.imageFocalPoint as { x: number; y: number } | null;

  // Schema.org NewsArticle structured data
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: article.title,
    description: article.excerpt || stripHtml(article.content).slice(0, 200),
    image: article.imageUrl || article.thumbnailUrl,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: article.updatedAt?.toISOString(),
    author: {
      '@type': 'Person',
      name: authorName,
    },
    publisher: {
      '@type': 'Organization',
      name: 'صحيفة سبق الإلكترونية',
      logo: {
        '@type': 'ImageObject',
        url: 'https://sabq.org/logo.png',
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://sabq.org/article/${slug}`,
    },
    articleSection: article.categoryName || undefined,
  };

  return (
    <>
      <Header />

      {/* Schema.org JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <main className="flex-1">
        <article className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Article Content - 2/3 */}
            <div className="lg:col-span-2">
              {/* Breadcrumb */}
              <nav className="flex items-center gap-2 text-sm text-[#7A7A72] mb-4" aria-label="التنقل">
                <Link href="/" className="hover:text-[#C0392B] transition-colors">الرئيسية</Link>
                <span>/</span>
                {article.categoryName && article.categorySlug && (
                  <>
                    <Link
                      href={`/category/${article.categorySlug}`}
                      className="hover:text-[#C0392B] transition-colors"
                      style={{ color: article.categoryColor || undefined }}
                    >
                      {article.categoryName}
                    </Link>
                    <span>/</span>
                  </>
                )}
                <span className="text-[#0D0D0D] truncate max-w-[200px]">{article.title}</span>
              </nav>

              {/* Category Badge */}
              {article.categoryName && (
                <Link
                  href={`/category/${article.categorySlug}`}
                  className="inline-block px-3 py-1 text-xs font-semibold text-white rounded-[2px] mb-3"
                  style={{ backgroundColor: article.categoryColor || '#C0392B' }}
                >
                  {article.categoryName}
                </Link>
              )}

              {/* Title */}
              <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-[#0D0D0D] leading-tight mb-3">
                {article.title}
              </h1>

              {/* Subtitle */}
              {article.subtitle && (
                <p className="text-lg text-[#7A7A72] leading-relaxed mb-4">
                  {article.subtitle}
                </p>
              )}

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-[#7A7A72] mb-6 pb-4 border-b border-[#D4D4CC]">
                {/* Author */}
                <div className="flex items-center gap-2">
                  {article.authorImage && (
                    <Image
                      src={article.authorImage}
                      alt={authorName}
                      width={32}
                      height={32}
                      className="rounded-full object-cover"
                    />
                  )}
                  <span className="font-semibold text-[#0D0D0D]">{authorName}</span>
                </div>

                {/* Date */}
                {article.publishedAt && (
                  <time dateTime={article.publishedAt.toISOString()} className="flex items-center gap-1">
                    <span>{formatDateAr(article.publishedAt)}</span>
                    <span className="text-[#D4D4CC]">|</span>
                    <span>{formatRelativeTimeAr(article.publishedAt)}</span>
                  </time>
                )}

                {/* Views */}
                {article.views > 0 && (
                  <span>{article.views.toLocaleString('ar-SA')} مشاهدة</span>
                )}
              </div>

              {/* Hero Image */}
              <div className="relative aspect-[16/9] overflow-hidden rounded-[4px] mb-6">
                <Image
                  src={imageUrl}
                  alt={article.title}
                  fill
                  className="object-cover"
                  style={{
                    objectPosition: focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : 'center',
                  }}
                  sizes="(max-width: 768px) 100vw, 800px"
                  priority
                />
              </div>

              {/* AI Summary */}
              {article.aiSummary && (
                <div className="bg-[#F8F8F6] border-r-4 border-[#B8860B] p-4 rounded-[4px] mb-6">
                  <h3 className="text-sm font-bold text-[#B8860B] mb-2">ملخص الخبر</h3>
                  <p className="text-sm text-[#0D0D0D] leading-relaxed">{article.aiSummary}</p>
                </div>
              )}

              {/* Article Content */}
              <div
                className="article-content"
                dangerouslySetInnerHTML={{ __html: article.content }}
              />

              {/* Source */}
              {article.sourceUrl && (
                <div className="mt-6 pt-4 border-t border-[#D4D4CC]">
                  <span className="text-sm text-[#7A7A72]">المصدر: </span>
                  <a
                    href={article.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[#C0392B] hover:underline"
                  >
                    {article.sourceUrl}
                  </a>
                </div>
              )}

              {/* Share Buttons */}
              <div className="mt-6 pt-4 border-t border-[#D4D4CC]">
                <h3 className="text-sm font-bold text-[#0D0D0D] mb-3">شارك الخبر</h3>
                <div className="flex items-center gap-3">
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(article.title)}&url=${encodeURIComponent(`https://sabq.org/article/${slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#0D0D0D] text-white text-xs font-semibold rounded-[2px] hover:bg-[#333] transition-colors"
                  >
                    X (تويتر)
                  </a>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(article.title + ' ' + `https://sabq.org/article/${slug}`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-[#25D366] text-white text-xs font-semibold rounded-[2px] hover:bg-[#1DA851] transition-colors"
                  >
                    واتساب
                  </a>
                  <button
                    className="px-4 py-2 bg-[#F8F8F6] text-[#0D0D0D] text-xs font-semibold rounded-[2px] border border-[#D4D4CC] hover:bg-[#D4D4CC] transition-colors"
                  >
                    نسخ الرابط
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar - 1/3 */}
            <aside className="space-y-6">
              {/* Author Card */}
              {article.authorFirstName && (
                <div className="bg-white border border-[#D4D4CC] rounded-[4px] p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {article.authorImage && (
                      <Image
                        src={article.authorImage}
                        alt={authorName}
                        width={48}
                        height={48}
                        className="rounded-full object-cover"
                      />
                    )}
                    <div>
                      <h3 className="font-bold text-sm text-[#0D0D0D]">{authorName}</h3>
                      {article.authorJobTitle && (
                        <p className="text-xs text-[#7A7A72]">{article.authorJobTitle}</p>
                      )}
                    </div>
                  </div>
                  {article.authorBio && (
                    <p className="text-xs text-[#7A7A72] leading-relaxed">{article.authorBio}</p>
                  )}
                </div>
              )}

              {/* Ad Placeholder */}
              <div className="bg-[#F8F8F6] border border-[#D4D4CC] rounded-[4px] h-64 flex items-center justify-center">
                <span className="text-xs text-[#7A7A72]">مساحة إعلانية</span>
              </div>
            </aside>
          </div>

          {/* Related Articles */}
          {relatedArticles.length > 0 && (
            <section className="mt-10 pt-8 border-t border-[#D4D4CC]">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-1 h-6 rounded-full bg-[#C0392B]" />
                <h2 className="text-lg font-bold text-[#0D0D0D]">أخبار ذات صلة</h2>
                <div className="flex-1 h-px bg-[#D4D4CC]" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {relatedArticles.map((related) => (
                  <ArticleCard key={related.id} article={related} variant="standard" />
                ))}
              </div>
            </section>
          )}
        </article>
      </main>

      <Footer />
    </>
  );
}
