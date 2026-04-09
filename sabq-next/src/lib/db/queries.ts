/**
 * Data Access Layer - Phase 1 (Read-Only Queries)
 * 
 * All database queries for the public-facing website.
 * These are server-side only functions used in Server Components and Route Handlers.
 */

import { db } from './index';
import { articles, categories, users, smartBlocks, breakingTickerTopics, breakingTickerHeadlines, tags, articleTags } from './schema';
import { eq, desc, and, sql, asc, isNull, or, lte, gt, inArray, ilike } from 'drizzle-orm';

// ============================================
// ARTICLES
// ============================================

/** Fetch published articles for homepage with author and category */
export async function getHomepageArticles(limit = 30) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      subtitle: articles.subtitle,
      slug: articles.slug,
      excerpt: articles.excerpt,
      imageUrl: articles.imageUrl,
      thumbnailUrl: articles.thumbnailUrl,
      imageFocalPoint: articles.imageFocalPoint,
      newsType: articles.newsType,
      articleType: articles.articleType,
      isFeatured: articles.isFeatured,
      views: articles.views,
      displayOrder: articles.displayOrder,
      publishedAt: articles.publishedAt,
      isVideoTemplate: articles.isVideoTemplate,
      videoThumbnailUrl: articles.videoThumbnailUrl,
      categoryId: articles.categoryId,
      categoryName: categories.nameAr,
      categorySlug: categories.slug,
      categoryColor: categories.color,
      authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'سبق')`,
      authorImage: users.profileImageUrl,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(
      and(
        eq(articles.status, 'published'),
        eq(articles.hideFromHomepage, false),
      )
    )
    .orderBy(desc(articles.displayOrder), desc(articles.publishedAt))
    .limit(limit);
}

/** Fetch a single article by slug with full details */
export async function getArticleBySlug(slug: string) {
  const result = await db
    .select({
      id: articles.id,
      title: articles.title,
      subtitle: articles.subtitle,
      slug: articles.slug,
      content: articles.content,
      excerpt: articles.excerpt,
      imageUrl: articles.imageUrl,
      thumbnailUrl: articles.thumbnailUrl,
      albumImages: articles.albumImages,
      imageFocalPoint: articles.imageFocalPoint,
      newsType: articles.newsType,
      articleType: articles.articleType,
      isFeatured: articles.isFeatured,
      views: articles.views,
      seo: articles.seo,
      aiSummary: articles.aiSummary,
      sourceUrl: articles.sourceUrl,
      isVideoTemplate: articles.isVideoTemplate,
      videoUrl: articles.videoUrl,
      videoThumbnailUrl: articles.videoThumbnailUrl,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      createdAt: articles.createdAt,
      categoryId: articles.categoryId,
      categoryName: categories.nameAr,
      categorySlug: categories.slug,
      categoryColor: categories.color,
      authorId: articles.authorId,
      authorFirstName: users.firstName,
      authorLastName: users.lastName,
      authorImage: users.profileImageUrl,
      authorBio: users.bio,
      authorJobTitle: users.jobTitle,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(
      and(
        eq(articles.slug, slug),
        eq(articles.status, 'published'),
      )
    )
    .limit(1);

  return result[0] || null;
}

/** Fetch related articles by category */
export async function getRelatedArticles(categoryId: string, excludeArticleId: string, limit = 6) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      thumbnailUrl: articles.thumbnailUrl,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
      categoryName: categories.nameAr,
      categorySlug: categories.slug,
      categoryColor: categories.color,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(
      and(
        eq(articles.categoryId, categoryId),
        eq(articles.status, 'published'),
        sql`${articles.id} != ${excludeArticleId}`,
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/** Fetch articles by category slug with pagination */
export async function getArticlesByCategory(categorySlug: string, page = 1, limit = 20) {
  const offset = (page - 1) * limit;

  const category = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, categorySlug))
    .limit(1);

  if (!category[0]) return { articles: [], category: null, total: 0 };

  const [articlesList, countResult] = await Promise.all([
    db
      .select({
        id: articles.id,
        title: articles.title,
        subtitle: articles.subtitle,
        slug: articles.slug,
        excerpt: articles.excerpt,
        imageUrl: articles.imageUrl,
        thumbnailUrl: articles.thumbnailUrl,
        imageFocalPoint: articles.imageFocalPoint,
        newsType: articles.newsType,
        articleType: articles.articleType,
        isFeatured: articles.isFeatured,
        views: articles.views,
        publishedAt: articles.publishedAt,
        authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'سبق')`,
        authorImage: users.profileImageUrl,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorId, users.id))
      .where(
        and(
          eq(articles.categoryId, category[0].id),
          eq(articles.status, 'published'),
        )
      )
      .orderBy(desc(articles.publishedAt))
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)` })
      .from(articles)
      .where(
        and(
          eq(articles.categoryId, category[0].id),
          eq(articles.status, 'published'),
        )
      ),
  ]);

  return {
    articles: articlesList,
    category: category[0],
    total: Number(countResult[0]?.count || 0),
  };
}

/** Fetch breaking news articles */
export async function getBreakingNews(limit = 5) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      thumbnailUrl: articles.thumbnailUrl,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
      categoryName: categories.nameAr,
      categorySlug: categories.slug,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(
      and(
        eq(articles.status, 'published'),
        eq(articles.newsType, 'breaking'),
      )
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/** Fetch most viewed articles */
export async function getMostViewedArticles(limit = 10) {
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      thumbnailUrl: articles.thumbnailUrl,
      imageUrl: articles.imageUrl,
      views: articles.views,
      publishedAt: articles.publishedAt,
      categoryName: categories.nameAr,
      categorySlug: categories.slug,
      categoryColor: categories.color,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(eq(articles.status, 'published'))
    .orderBy(desc(articles.views))
    .limit(limit);
}

// ============================================
// CATEGORIES
// ============================================

/** Fetch all active categories (non-iFox) ordered by displayOrder */
export async function getActiveCategories() {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.status, 'active'),
        eq(categories.isIfoxCategory, false),
      )
    )
    .orderBy(asc(categories.displayOrder));
}

/** Fetch a single category by slug */
export async function getCategoryBySlug(slug: string) {
  const result = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return result[0] || null;
}

// ============================================
// SMART BLOCKS
// ============================================

/** Fetch active smart blocks with their articles */
export async function getActiveSmartBlocks() {
  const blocks = await db
    .select()
    .from(smartBlocks)
    .where(eq(smartBlocks.isActive, true))
    .orderBy(asc(smartBlocks.createdAt));

  // For each block, fetch articles matching the keyword
  const blocksWithArticles = await Promise.all(
    blocks.map(async (block) => {
      const blockArticles = await db
        .select({
          id: articles.id,
          title: articles.title,
          slug: articles.slug,
          excerpt: articles.excerpt,
          imageUrl: articles.imageUrl,
          thumbnailUrl: articles.thumbnailUrl,
          imageFocalPoint: articles.imageFocalPoint,
          publishedAt: articles.publishedAt,
          categoryName: categories.nameAr,
          categorySlug: categories.slug,
          categoryColor: categories.color,
          authorName: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, 'سبق')`,
        })
        .from(articles)
        .leftJoin(categories, eq(articles.categoryId, categories.id))
        .leftJoin(users, eq(articles.authorId, users.id))
        .where(
          and(
            eq(articles.status, 'published'),
            or(
              ilike(articles.title, `%${block.keyword}%`),
              ilike(articles.content, `%${block.keyword}%`),
            ),
            // Apply category filters if present
            block.filters?.categories?.length
              ? inArray(articles.categoryId, block.filters.categories)
              : undefined,
          )
        )
        .orderBy(desc(articles.publishedAt))
        .limit(block.limitCount);

      return { ...block, articles: blockArticles };
    })
  );

  return blocksWithArticles;
}

// ============================================
// BREAKING TICKER
// ============================================

/** Fetch active breaking ticker with headlines */
export async function getActiveBreakingTicker() {
  const now = new Date();

  const activeTopic = await db
    .select()
    .from(breakingTickerTopics)
    .where(
      and(
        eq(breakingTickerTopics.isActive, true),
        or(
          isNull(breakingTickerTopics.expiresAt),
          gt(breakingTickerTopics.expiresAt, now),
        ),
      )
    )
    .orderBy(desc(breakingTickerTopics.createdAt))
    .limit(1);

  if (!activeTopic[0]) return null;

  const headlines = await db
    .select()
    .from(breakingTickerHeadlines)
    .where(eq(breakingTickerHeadlines.topicId, activeTopic[0].id))
    .orderBy(asc(breakingTickerHeadlines.orderIndex));

  return {
    ...activeTopic[0],
    headlines,
  };
}

// ============================================
// SITEMAP HELPERS
// ============================================

/** Fetch all published article slugs for sitemap */
export async function getAllPublishedSlugs() {
  return db
    .select({
      slug: articles.slug,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(desc(articles.publishedAt));
}

/** Fetch all active category slugs for sitemap */
export async function getAllCategorySlugs() {
  return db
    .select({
      slug: categories.slug,
      updatedAt: categories.updatedAt,
    })
    .from(categories)
    .where(eq(categories.status, 'active'));
}
