import ArticleCard from './ArticleCard';

/**
 * SmartBlock Component
 * 
 * Renders a themed section of articles based on a keyword/topic.
 * Supports grid, list, and featured layout styles.
 */

interface SmartBlockArticle {
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
}

interface SmartBlockProps {
  block: {
    id: string;
    title: string;
    keyword: string;
    color: string;
    backgroundColor?: string | null;
    layoutStyle: string;
    articles: SmartBlockArticle[];
  };
}

export default function SmartBlock({ block }: SmartBlockProps) {
  if (block.articles.length === 0) return null;

  return (
    <section
      className="py-6 px-4 md:px-6 rounded-[4px]"
      style={{ backgroundColor: block.backgroundColor || undefined }}
    >
      {/* Section Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-6 rounded-full" style={{ backgroundColor: block.color }} />
        <h2 className="text-lg font-bold text-[#0D0D0D]">{block.title}</h2>
        <div className="flex-1 h-px bg-[#D4D4CC]" />
      </div>

      {/* Grid Layout */}
      {block.layoutStyle === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {block.articles.map((article) => (
            <ArticleCard key={article.id} article={article} variant="standard" />
          ))}
        </div>
      )}

      {/* List Layout */}
      {block.layoutStyle === 'list' && (
        <div className="space-y-4">
          {block.articles.map((article) => (
            <ArticleCard key={article.id} article={article} variant="horizontal" />
          ))}
        </div>
      )}

      {/* Featured Layout - first article large, rest small */}
      {block.layoutStyle === 'featured' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            {block.articles[0] && (
              <ArticleCard article={block.articles[0]} variant="featured" />
            )}
          </div>
          <div className="space-y-1">
            {block.articles.slice(1).map((article) => (
              <ArticleCard key={article.id} article={article} variant="compact" />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
