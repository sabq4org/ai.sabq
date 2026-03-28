/**
 * Dynamic Categories Job
 * يحدّث التصنيفات الديناميكية تلقائياً (الآن، مختارات AI)
 */

import cron from "node-cron";
import { db } from "../db";
import { 
  articles, 
  categories, 
  articleSmartCategories,
  reactions,
  comments
} from "@shared/schema";
import { eq, and, desc, gte, sql, inArray } from "drizzle-orm";

let isUpdating = false;

/**
 * خوارزمية ذكية لاختيار مقالات "الآن"
 * Algorithm: Breaking + Trending + Recent (last 24 hours)
 */
async function updateNowCategory() {
  try {
    console.log('[Dynamic Categories] 🔥 Updating "الآن" category...');
    
    // Get "الآن" category
    const [nowCategory] = await db
      .select()
      .from(categories)
      .where(and(
        eq(categories.slug, "now"),
        eq(categories.type, "dynamic")
      ));

    if (!nowCategory) {
      console.log('[Dynamic Categories] ⚠️ "الآن" category not found');
      return;
    }

    // Calculate cutoff (last 24 hours)
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    // Get breaking news (highest priority)
    const breakingNews = await db
      .select({
        id: articles.id,
        publishedAt: articles.publishedAt,
        views: articles.views,
        newsType: articles.newsType,
      })
      .from(articles)
      .where(and(
        eq(articles.status, "published"),
        eq(articles.newsType, "breaking"),
        gte(articles.publishedAt, twentyFourHoursAgo)
      ))
      .orderBy(desc(articles.publishedAt))
      .limit(10);

    // Get trending articles (high engagement)
    const trendingArticles = await db
      .select({
        articleId: articles.id,
        title: articles.title,
        publishedAt: articles.publishedAt,
        views: articles.views,
        reactionCount: sql<number>`cast(count(distinct ${reactions.id}) as int)`,
        commentCount: sql<number>`cast(count(distinct ${comments.id}) as int)`,
        engagementScore: sql<number>`
          cast(
            (${articles.views} * 1.0) + 
            (count(distinct ${reactions.id}) * 10.0) + 
            (count(distinct ${comments.id}) * 15.0)
          as int)
        `,
      })
      .from(articles)
      .leftJoin(reactions, eq(reactions.articleId, articles.id))
      .leftJoin(comments, and(
        eq(comments.articleId, articles.id),
        eq(comments.status, "approved")
      ))
      .where(and(
        eq(articles.status, "published"),
        gte(articles.publishedAt, twentyFourHoursAgo)
      ))
      .groupBy(articles.id, articles.title, articles.publishedAt, articles.views)
      .orderBy(desc(sql`
        cast(
          (${articles.views} * 1.0) + 
          (count(distinct ${reactions.id}) * 10.0) + 
          (count(distinct ${comments.id}) * 15.0)
        as int)
      `))
      .limit(20);

    // Get recent featured articles
    const recentFeatured = await db
      .select({
        id: articles.id,
        publishedAt: articles.publishedAt,
        views: articles.views,
      })
      .from(articles)
      .where(and(
        eq(articles.status, "published"),
        eq(articles.newsType, "featured"),
        gte(articles.publishedAt, twentyFourHoursAgo)
      ))
      .orderBy(desc(articles.publishedAt))
      .limit(10);

    // Combine and score articles
    const scoredArticles = new Map<string, { id: string; score: number }>();

    // Breaking news: score 1.0
    breakingNews.forEach((article, index) => {
      scoredArticles.set(article.id, {
        id: article.id,
        score: 1.0 - (index * 0.02), // 1.0, 0.98, 0.96, ...
      });
    });

    // Trending articles: score 0.8-0.95
    trendingArticles.forEach((article, index) => {
      if (!scoredArticles.has(article.articleId)) {
        scoredArticles.set(article.articleId, {
          id: article.articleId,
          score: 0.95 - (index * 0.01),
        });
      }
    });

    // Recent featured: score 0.7-0.85
    recentFeatured.forEach((article, index) => {
      if (!scoredArticles.has(article.id)) {
        scoredArticles.set(article.id, {
          id: article.id,
          score: 0.85 - (index * 0.015),
        });
      }
    });

    // Insert new assignments within a transaction to avoid momentary gaps
    const assignments = Array.from(scoredArticles.values()).slice(0, 30); // Max 30 articles

    // Use transaction to ensure atomic delete+insert
    await db.transaction(async (tx) => {
      // Clear existing assignments for this category
      await tx
        .delete(articleSmartCategories)
        .where(eq(articleSmartCategories.categoryId, nowCategory.id));

      // Insert new assignments (if any)
      if (assignments.length > 0) {
        // Use individual inserts with onConflictDoUpdate to handle duplicates
        for (const item of assignments) {
          await tx
            .insert(articleSmartCategories)
            .values({
              articleId: item.id,
              categoryId: nowCategory.id,
              score: item.score,
            })
            .onConflictDoUpdate({
              target: [articleSmartCategories.articleId, articleSmartCategories.categoryId],
              set: {
                score: item.score,
                assignedAt: new Date(),
              },
            });
        }
      }
    });

    // Telemetry logging
    console.log(`[Dynamic Categories] 📊 "الآن" update complete:`, {
      breakingCount: breakingNews.length,
      trendingCount: trendingArticles.length,
      featuredCount: recentFeatured.length,
      finalAssigned: assignments.length,
      timestamp: new Date().toISOString(),
    });

    if (assignments.length > 0) {
      console.log(`[Dynamic Categories] ✅ Updated "الآن" with ${assignments.length} articles`);
    } else {
      console.log('[Dynamic Categories] ℹ️ No articles matched criteria for "الآن"');
    }
  } catch (error) {
    console.error('[Dynamic Categories] ❌ Error updating "الآن":', error);
  }
}

/**
 * تحديث جميع التصنيفات الديناميكية
 * Update all dynamic categories
 */
export async function updateDynamicCategories() {
  if (isUpdating) {
    console.log('[Dynamic Categories] ⏭️ Skipping - already updating');
    return;
  }
  
  isUpdating = true;
  try {
    console.log('[Dynamic Categories] 🔄 Starting update cycle...');
    
    // Update each dynamic category
    await updateNowCategory();
    // TODO: Add updateAiPicksCategory() when ready
    
    console.log('[Dynamic Categories] ✅ Update cycle complete');
  } catch (error) {
    console.error('[Dynamic Categories] ❌ Error in update cycle:', error);
  } finally {
    isUpdating = false;
  }
}

/**
 * تشغيل job كل ساعة (تقليل الضغط بنسبة 75%)
 * Start job that runs every hour (75% load reduction)
 */
export function startDynamicCategoriesJob() {
  // Run every hour (reduced from 15 minutes for 75% performance improvement)
  const job = cron.schedule("0 * * * *", async () => {
    await updateDynamicCategories();
  });

  console.log('[Dynamic Categories Job] ⏰ Job scheduled (every 60 minutes)');

  // Run immediately on startup
  console.log('[Dynamic Categories Job] 🚀 Running initial update...');
  updateDynamicCategories().catch(err => {
    console.error('[Dynamic Categories Job] ❌ Initial update failed:', err);
  });

  return job;
}
