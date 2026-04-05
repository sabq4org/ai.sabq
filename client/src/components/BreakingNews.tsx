import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock } from "lucide-react";
import type { ArticleWithDetails } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { OptimizedImage } from "./OptimizedImage";
import { getObjectPosition } from "@/lib/imageUtils";

interface BreakingNewsProps {
  articles: ArticleWithDetails[];
}

export function BreakingNews({ articles }: BreakingNewsProps) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="space-y-4" dir="rtl">
      {/* Section header — DESIGN.md: 3px black top border */}
      <div className="sabq-section-divider pt-4 flex items-center gap-2">
        <Zap className="h-5 w-5 flex-shrink-0" style={{ color: '#C0392B' }} />
        <h2 className="text-2xl md:text-3xl font-bold font-sabq-ui" style={{ color: '#0D0D0D' }} data-testid="heading-breaking-news">
          الأخبار العاجلة
        </h2>
      </div>

      <div className="space-y-3">
        {articles.map((article, index) => (
          <Link key={article.id} href={`/article/${article.englishSlug || article.slug}`}>
            {/* DESIGN.md breaking card: border-right 4px red, bg #FEF9F9, sharp corners */}
            <div
              className="sabq-breaking-card flex gap-4 p-4 cursor-pointer"
              data-testid={`item-breaking-${article.id}`}
            >
              <div className="flex-shrink-0 flex flex-col items-start gap-1.5 pt-0.5">
                {/* "عاجل" badge — red bg, white text, pulse */}
                <span className="sabq-badge-breaking">عاجل</span>
                <span className="text-sm font-bold" style={{ color: '#C0392B' }}>
                  {index + 1}
                </span>
              </div>

              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {article.category && (
                    <span
                      className="text-[11px] font-semibold px-2 py-0.5 rounded-[2px]"
                      style={{ color: '#C0392B', border: '1px solid #C0392B' }}
                    >
                      {article.category.nameAr}
                    </span>
                  )}
                  {article.publishedAt && (
                    <span className="text-xs flex items-center gap-1" style={{ color: '#7A7A72' }}>
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(article.publishedAt), {
                        addSuffix: true,
                        locale: ar,
                      })}
                    </span>
                  )}
                </div>

                <h3
                  className="font-bold text-base line-clamp-2 font-sabq-ui leading-relaxed"
                  style={{ color: '#0D0D0D' }}
                  data-testid={`text-breaking-title-${article.id}`}
                >
                  {article.title}
                </h3>
              </div>

              {article.imageUrl && (
                <OptimizedImage
                  src={article.imageUrl}
                  alt={article.title}
                  className="w-20 h-20 object-cover flex-shrink-0"
                  style={{ borderRadius: 0 }}
                  objectPosition={getObjectPosition(article)}
                />
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
