import Link from 'next/link';
import { getArticleUrl, formatRelativeTimeAr } from '@/lib/utils';

/**
 * MostRead Component - Sidebar Widget
 * 
 * Displays top 10 most viewed articles with numbered ranking.
 */

interface MostReadArticle {
  id: string;
  title: string;
  slug: string;
  views?: number | null;
  publishedAt?: Date | string | null;
  categoryName?: string | null;
  categoryColor?: string | null;
}

interface MostReadProps {
  articles: MostReadArticle[];
}

export default function MostRead({ articles }: MostReadProps) {
  if (articles.length === 0) return null;

  return (
    <div className="bg-white border border-[#D4D4CC] rounded-[4px] overflow-hidden">
      {/* Header */}
      <div className="bg-[#0D0D0D] px-4 py-3">
        <h3 className="text-white font-bold text-sm">الأكثر قراءة</h3>
      </div>

      {/* List */}
      <div className="divide-y divide-[#D4D4CC]">
        {articles.map((article, index) => (
          <Link
            key={article.id}
            href={getArticleUrl(article.slug)}
            className="flex items-start gap-3 px-4 py-3 hover:bg-[#F8F8F6] transition-colors group"
          >
            {/* Rank Number */}
            <span
              className={`shrink-0 w-7 h-7 flex items-center justify-center rounded-[2px] text-xs font-bold ${
                index < 3
                  ? 'bg-[#C0392B] text-white'
                  : 'bg-[#F8F8F6] text-[#7A7A72]'
              }`}
            >
              {index + 1}
            </span>

            {/* Title */}
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-semibold text-[#0D0D0D] leading-snug line-clamp-2 group-hover:text-[#C0392B] transition-colors">
                {article.title}
              </h4>
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
          </Link>
        ))}
      </div>
    </div>
  );
}
