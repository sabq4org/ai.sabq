import Link from 'next/link';
import Image from 'next/image';
import { formatRelativeTimeAr, getArticleUrl, getImageUrl, truncate } from '@/lib/utils';

/**
 * ArticleCard Component
 * 
 * Reusable card for displaying article previews.
 * Supports multiple variants: featured (large), standard, compact (sidebar).
 */

interface ArticleCardProps {
  article: {
    id: string;
    title: string;
    slug: string;
    excerpt?: string | null;
    imageUrl?: string | null;
    thumbnailUrl?: string | null;
    imageFocalPoint?: { x: number; y: number } | null;
    publishedAt?: Date | string | null;
    categoryName?: string | null;
    categorySlug?: string | null;
    categoryColor?: string | null;
    authorName?: string | null;
    authorImage?: string | null;
    newsType?: string | null;
    views?: number | null;
  };
  variant?: 'featured' | 'standard' | 'compact' | 'horizontal';
  priority?: boolean;
}

export default function ArticleCard({ article, variant = 'standard', priority = false }: ArticleCardProps) {
  const imageUrl = getImageUrl(article.thumbnailUrl, article.imageUrl);
  const articleUrl = getArticleUrl(article.slug);
  const focalPoint = article.imageFocalPoint;
  const objectPosition = focalPoint ? `${focalPoint.x}% ${focalPoint.y}%` : 'center';

  // Featured variant - large hero card
  if (variant === 'featured') {
    return (
      <article className="group relative">
        <Link href={articleUrl} className="block">
          <div className="relative aspect-[16/9] overflow-hidden rounded-[4px]">
            <Image
              src={imageUrl}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              style={{ objectPosition }}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 66vw, 800px"
              priority={priority}
            />
            {/* Gradient overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

            {/* Content overlay */}
            <div className="absolute bottom-0 right-0 left-0 p-4 md:p-6">
              {article.newsType === 'breaking' && (
                <span className="inline-block px-2 py-0.5 bg-[#C0392B] text-white text-xs font-bold rounded-[2px] mb-2">
                  عاجل
                </span>
              )}
              {article.categoryName && (
                <span
                  className="inline-block px-2 py-0.5 text-white text-xs font-semibold rounded-[2px] mb-2 mr-2"
                  style={{ backgroundColor: article.categoryColor || '#C0392B' }}
                >
                  {article.categoryName}
                </span>
              )}
              <h2 className="text-white text-lg md:text-2xl font-bold leading-tight line-clamp-3 mb-2">
                {article.title}
              </h2>
              {article.excerpt && (
                <p className="text-white/80 text-sm line-clamp-2 hidden md:block">
                  {truncate(article.excerpt, 120)}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 text-white/60 text-xs">
                {article.authorName && <span>{article.authorName}</span>}
                {article.publishedAt && (
                  <>
                    <span className="w-1 h-1 bg-white/40 rounded-full" />
                    <time dateTime={new Date(article.publishedAt).toISOString()}>
                      {formatRelativeTimeAr(article.publishedAt)}
                    </time>
                  </>
                )}
              </div>
            </div>
          </div>
        </Link>
      </article>
    );
  }

  // Horizontal variant - image left, text right
  if (variant === 'horizontal') {
    return (
      <article className="group">
        <Link href={articleUrl} className="flex gap-3">
          <div className="relative w-28 h-20 md:w-36 md:h-24 shrink-0 overflow-hidden rounded-[4px]">
            <Image
              src={imageUrl}
              alt={article.title}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              style={{ objectPosition }}
              sizes="144px"
            />
          </div>
          <div className="flex-1 min-w-0">
            {article.categoryName && (
              <span className="text-xs font-semibold" style={{ color: article.categoryColor || '#C0392B' }}>
                {article.categoryName}
              </span>
            )}
            <h3 className="text-sm font-bold text-[#0D0D0D] leading-snug line-clamp-2 group-hover:text-[#C0392B] transition-colors">
              {article.title}
            </h3>
            {article.publishedAt && (
              <time className="text-xs text-[#7A7A72] mt-1 block" dateTime={new Date(article.publishedAt).toISOString()}>
                {formatRelativeTimeAr(article.publishedAt)}
              </time>
            )}
          </div>
        </Link>
      </article>
    );
  }

  // Compact variant - small sidebar card
  if (variant === 'compact') {
    return (
      <article className="group">
        <Link href={articleUrl} className="flex items-start gap-3 py-3 border-b border-[#D4D4CC] last:border-0">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-[#0D0D0D] leading-snug line-clamp-2 group-hover:text-[#C0392B] transition-colors">
              {article.title}
            </h3>
            <div className="flex items-center gap-2 mt-1 text-xs text-[#7A7A72]">
              {article.categoryName && (
                <span style={{ color: article.categoryColor || '#C0392B' }}>{article.categoryName}</span>
              )}
              {article.publishedAt && (
                <time dateTime={new Date(article.publishedAt).toISOString()}>
                  {formatRelativeTimeAr(article.publishedAt)}
                </time>
              )}
            </div>
          </div>
          <div className="relative w-16 h-16 shrink-0 overflow-hidden rounded-[4px]">
            <Image
              src={imageUrl}
              alt=""
              fill
              className="object-cover"
              style={{ objectPosition }}
              sizes="64px"
            />
          </div>
        </Link>
      </article>
    );
  }

  // Standard variant - vertical card
  return (
    <article className="group">
      <Link href={articleUrl} className="block">
        <div className="relative aspect-[16/9] overflow-hidden rounded-[4px] mb-3">
          <Image
            src={imageUrl}
            alt={article.title}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            style={{ objectPosition }}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 400px"
            priority={priority}
          />
          {article.newsType === 'breaking' && (
            <span className="absolute top-2 right-2 px-2 py-0.5 bg-[#C0392B] text-white text-xs font-bold rounded-[2px]">
              عاجل
            </span>
          )}
        </div>
        <div>
          {article.categoryName && (
            <span className="text-xs font-semibold mb-1 block" style={{ color: article.categoryColor || '#C0392B' }}>
              {article.categoryName}
            </span>
          )}
          <h3 className="text-base font-bold text-[#0D0D0D] leading-snug line-clamp-2 group-hover:text-[#C0392B] transition-colors mb-1">
            {article.title}
          </h3>
          {article.excerpt && (
            <p className="text-sm text-[#7A7A72] line-clamp-2 mb-2">
              {truncate(article.excerpt, 100)}
            </p>
          )}
          <div className="flex items-center gap-2 text-xs text-[#7A7A72]">
            {article.authorName && <span>{article.authorName}</span>}
            {article.publishedAt && (
              <>
                <span className="w-1 h-1 bg-[#D4D4CC] rounded-full" />
                <time dateTime={new Date(article.publishedAt).toISOString()}>
                  {formatRelativeTimeAr(article.publishedAt)}
                </time>
              </>
            )}
          </div>
        </div>
      </Link>
    </article>
  );
}
