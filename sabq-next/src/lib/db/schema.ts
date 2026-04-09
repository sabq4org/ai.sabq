/**
 * Database Schema - Phase 1 (Public Facing)
 * 
 * Minimal schema definitions for the public website.
 * These map to the existing tables in the Neon database WITHOUT any modifications.
 * Only tables needed for Phase 1 (articles, categories, users, smartBlocks, breakingTicker) are defined.
 */

import { pgTable, text, varchar, timestamp, boolean, integer, bigint, jsonb, index, real, uniqueIndex } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// USERS (read-only for author display)
// ============================================
export const users = pgTable('users', {
  id: varchar('id').primaryKey(),
  email: text('email').notNull().unique(),
  firstName: text('first_name'),
  lastName: text('last_name'),
  firstNameEn: text('first_name_en'),
  lastNameEn: text('last_name_en'),
  bio: text('bio'),
  profileImageUrl: text('profile_image_url'),
  role: text('role').notNull().default('reader'),
  status: text('status').default('active').notNull(),
  jobTitle: text('job_title'),
  department: text('department'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// CATEGORIES
// ============================================
export const categories = pgTable('categories', {
  id: varchar('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en').notNull(),
  slug: text('slug').notNull().unique(),
  englishSlug: text('english_slug'),
  description: text('description'),
  color: text('color'),
  icon: text('icon'),
  heroImageUrl: text('hero_image_url'),
  displayOrder: integer('display_order').default(0),
  status: text('status').default('active').notNull(),
  isIfoxCategory: boolean('is_ifox_category').default(false).notNull(),
  type: text('type').default('core').notNull(),
  features: jsonb('features').$type<Record<string, boolean | undefined>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_categories_type_status').on(table.type, table.status),
  index('idx_categories_status').on(table.status),
  index('idx_categories_slug').on(table.slug),
]);

// ============================================
// ARTICLES
// ============================================
export const articles = pgTable('articles', {
  id: varchar('id').primaryKey(),
  title: text('title').notNull(),
  subtitle: text('subtitle'),
  slug: text('slug').notNull().unique(),
  englishSlug: text('english_slug'),
  legacySlug: text('legacy_slug'),
  content: text('content').notNull(),
  excerpt: text('excerpt'),
  imageUrl: text('image_url'),
  thumbnailUrl: text('thumbnail_url'),
  liteOptimizedImageUrl: text('lite_optimized_image_url'),
  albumImages: text('album_images').array(),
  imageFocalPoint: jsonb('image_focal_point').$type<{
    x: number;
    y: number;
    needsReview?: boolean;
    confidence?: 'high' | 'medium' | 'low';
  }>(),
  categoryId: varchar('category_id'),
  authorId: varchar('author_id').notNull(),
  reporterId: varchar('reporter_id'),
  articleType: text('article_type').default('news').notNull(),
  newsType: text('news_type').default('regular').notNull(),
  status: text('status').notNull().default('draft'),
  hideFromHomepage: boolean('hide_from_homepage').default(false).notNull(),
  aiSummary: text('ai_summary'),
  aiGenerated: boolean('ai_generated').default(false),
  isFeatured: boolean('is_featured').default(false).notNull(),
  views: integer('views').default(0).notNull(),
  displayOrder: bigint('display_order', { mode: 'number' }).default(0).notNull(),
  seo: jsonb('seo').$type<{
    metaTitle?: string;
    metaDescription?: string;
    keywords?: string[];
    socialTitle?: string;
    socialDescription?: string;
    imageAltText?: string;
    ogImageUrl?: string;
  }>(),
  videoUrl: text('video_url'),
  videoThumbnailUrl: text('video_thumbnail_url'),
  isVideoTemplate: boolean('is_video_template').default(false),
  sourceUrl: text('source_url'),
  publishedAt: timestamp('published_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_articles_status_published').on(table.status, table.publishedAt),
  index('idx_articles_category_status').on(table.categoryId, table.status),
  index('idx_articles_slug').on(table.slug),
  index('idx_articles_legacy_slug').on(table.legacySlug),
]);

// ============================================
// SMART BLOCKS
// ============================================
export const smartBlocks = pgTable('smart_blocks', {
  id: varchar('id').primaryKey(),
  title: varchar('title', { length: 60 }).notNull(),
  keyword: varchar('keyword', { length: 100 }).notNull(),
  color: varchar('color', { length: 20 }).notNull(),
  backgroundColor: varchar('background_color', { length: 20 }),
  placement: varchar('placement', { length: 30 }).notNull(),
  layoutStyle: varchar('layout_style', { length: 20 }).notNull().default('grid'),
  limitCount: integer('limit_count').notNull().default(6),
  filters: jsonb('filters').$type<{
    categories?: string[];
    dateRange?: { from: string; to: string };
  }>(),
  isActive: boolean('is_active').notNull().default(true),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_smart_blocks_keyword').on(table.keyword),
  index('idx_smart_blocks_placement').on(table.placement),
  index('idx_smart_blocks_active').on(table.isActive),
]);

// ============================================
// BREAKING TICKER
// ============================================
export const breakingTickerTopics = pgTable('breaking_ticker_topics', {
  id: varchar('id').primaryKey(),
  topicTitle: text('topic_title').notNull(),
  isActive: boolean('is_active').default(false).notNull(),
  expiresAt: timestamp('expires_at'),
  createdBy: varchar('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_breaking_ticker_topics_active').on(table.isActive),
]);

export const breakingTickerHeadlines = pgTable('breaking_ticker_headlines', {
  id: varchar('id').primaryKey(),
  topicId: varchar('topic_id').notNull(),
  orderIndex: integer('order_index').default(0).notNull(),
  headline: text('headline').notNull(),
  linkedArticleId: varchar('linked_article_id'),
  linkedArticleTitle: text('linked_article_title'),
  linkedArticleSlug: text('linked_article_slug'),
  externalUrl: text('external_url'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => [
  index('idx_breaking_ticker_headlines_topic').on(table.topicId),
  index('idx_breaking_ticker_headlines_order').on(table.orderIndex),
]);

// ============================================
// TAGS
// ============================================
export const tags = pgTable('tags', {
  id: varchar('id').primaryKey(),
  nameAr: text('name_ar').notNull(),
  nameEn: text('name_en'),
  slug: text('slug').notNull().unique(),
  usageCount: integer('usage_count').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const articleTags = pgTable('article_tags', {
  id: varchar('id').primaryKey(),
  articleId: varchar('article_id').notNull(),
  tagId: varchar('tag_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// ============================================
// RELATIONS
// ============================================
export const articlesRelations = relations(articles, ({ one, many }) => ({
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  tags: many(articleTags),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  articles: many(articles),
}));

export const breakingTickerTopicsRelations = relations(breakingTickerTopics, ({ many }) => ({
  headlines: many(breakingTickerHeadlines),
}));

export const breakingTickerHeadlinesRelations = relations(breakingTickerHeadlines, ({ one }) => ({
  topic: one(breakingTickerTopics, {
    fields: [breakingTickerHeadlines.topicId],
    references: [breakingTickerTopics.id],
  }),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}));

// ============================================
// TYPE EXPORTS
// ============================================
export type Article = typeof articles.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type User = typeof users.$inferSelect;
export type SmartBlock = typeof smartBlocks.$inferSelect;
export type BreakingTickerTopic = typeof breakingTickerTopics.$inferSelect;
export type BreakingTickerHeadline = typeof breakingTickerHeadlines.$inferSelect;
export type Tag = typeof tags.$inferSelect;
