import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import ArticleCard from '@/components/articles/ArticleCard';
import { getArticlesByCategory, getActiveCategories } from '@/lib/db/queries';

/**
 * Category Page - Sabq News
 * 
 * Displays articles filtered by category with pagination.
 * ISR with 60-second revalidation.
 */

export const revalidate = 60;

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { category } = await getArticlesByCategory(slug, 1, 1);

  if (!category) {
    return { title: 'التصنيف غير موجود' };
  }

  return {
    title: category.nameAr,
    description: category.description || `أخبار ${category.nameAr} - صحيفة سبق الإلكترونية`,
    openGraph: {
      title: `${category.nameAr} | صحيفة سبق الإلكترونية`,
      description: category.description || `أخبار ${category.nameAr} - صحيفة سبق الإلكترونية`,
      type: 'website',
    },
    alternates: {
      canonical: `/category/${slug}`,
    },
  };
}

// Generate static paths for all active categories
export async function generateStaticParams() {
  const categories = await getActiveCategories();
  return categories.map((cat) => ({ slug: cat.slug }));
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || '1', 10));
  const limit = 20;

  const { articles, category, total } = await getArticlesByCategory(slug, page, limit);

  if (!category) {
    notFound();
  }

  const totalPages = Math.ceil(total / limit);

  return (
    <>
      <Header />

      <main className="flex-1">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 py-6">
          {/* Category Header */}
          <div className="mb-8">
            {/* Breadcrumb */}
            <nav className="flex items-center gap-2 text-sm text-[#7A7A72] mb-4" aria-label="التنقل">
              <Link href="/" className="hover:text-[#C0392B] transition-colors">الرئيسية</Link>
              <span>/</span>
              <span className="text-[#0D0D0D]">{category.nameAr}</span>
            </nav>

            {/* Title */}
            <div className="flex items-center gap-4 mb-2">
              <div
                className="w-1.5 h-8 rounded-full"
                style={{ backgroundColor: category.color || '#C0392B' }}
              />
              <h1 className="text-2xl md:text-3xl font-extrabold text-[#0D0D0D]">
                {category.nameAr}
              </h1>
            </div>
            {category.description && (
              <p className="text-sm text-[#7A7A72] mr-6">{category.description}</p>
            )}
            <div className="h-px bg-[#D4D4CC] mt-4" />
          </div>

          {/* Articles Grid */}
          {articles.length > 0 ? (
            <>
              {/* First article featured */}
              {page === 1 && articles[0] && (
                <div className="mb-8">
                  <ArticleCard article={articles[0]} variant="featured" priority />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {(page === 1 ? articles.slice(1) : articles).map((article, idx) => (
                  <ArticleCard
                    key={article.id}
                    article={article}
                    variant="standard"
                    priority={idx < 3}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <nav className="flex items-center justify-center gap-2 mt-10" aria-label="التنقل بين الصفحات">
                  {page > 1 && (
                    <Link
                      href={`/category/${slug}?page=${page - 1}`}
                      className="px-4 py-2 text-sm font-semibold text-[#0D0D0D] bg-[#F8F8F6] border border-[#D4D4CC] rounded-[4px] hover:bg-[#D4D4CC] transition-colors"
                    >
                      السابق
                    </Link>
                  )}

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }
                    return (
                      <Link
                        key={pageNum}
                        href={`/category/${slug}?page=${pageNum}`}
                        className={`w-10 h-10 flex items-center justify-center text-sm font-semibold rounded-[4px] transition-colors ${
                          pageNum === page
                            ? 'bg-[#C0392B] text-white'
                            : 'text-[#0D0D0D] bg-[#F8F8F6] border border-[#D4D4CC] hover:bg-[#D4D4CC]'
                        }`}
                      >
                        {pageNum}
                      </Link>
                    );
                  })}

                  {page < totalPages && (
                    <Link
                      href={`/category/${slug}?page=${page + 1}`}
                      className="px-4 py-2 text-sm font-semibold text-[#0D0D0D] bg-[#F8F8F6] border border-[#D4D4CC] rounded-[4px] hover:bg-[#D4D4CC] transition-colors"
                    >
                      التالي
                    </Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="text-center py-16">
              <p className="text-lg text-[#7A7A72]">لا توجد أخبار في هذا التصنيف حالياً</p>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
