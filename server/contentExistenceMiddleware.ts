import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { articles, categories, users, enArticles, urArticles, deepAnalyses } from "@shared/schema";
import { eq, or } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { VALID_PREFIXES } from "./utils/spaRouteMatcher";
import { memoryCache } from "./memoryCache";

const isProduction = process.env.NODE_ENV === "production" || 
                     process.env.REPLIT_DEPLOYMENT === "1";

const distPath = path.resolve(import.meta.dirname, "public");
const indexPath = path.resolve(distPath, "index.html");

const CACHE_TTL_FOUND = 120000;
const CACHE_TTL_NOT_FOUND = 60000;

const ARTICLE_PATTERNS = [
  { pattern: /^\/article\/([^\/]+)$/, table: articles, slugField: 'slug', altSlugField: 'englishSlug' },
  { pattern: /^\/opinion\/([^\/]+)$/, table: articles, slugField: 'slug', altSlugField: 'englishSlug' },
  { pattern: /^\/en\/article\/([^\/]+)$/, table: enArticles, slugField: 'slug', altSlugField: 'englishSlug' },
  { pattern: /^\/ur\/article\/([^\/]+)$/, table: urArticles, slugField: 'slug', altSlugField: 'englishSlug' },
  { pattern: /^\/omq\/([^\/]+)$/, table: deepAnalyses, slugField: 'id', altSlugField: null },
];

const CATEGORY_PATTERN = /^\/category\/([^\/]+)$/;
const REPORTER_PATTERN = /^\/reporter\/([^\/]+)$/;
const WRITER_PATTERN = /^\/writer\/([^\/]+)$/;
const SHORT_URL_PATTERN = /^\/([a-zA-Z0-9]{7})$/;

export async function contentExistenceMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const urlPath = req.path;
  
  if (urlPath.startsWith('/api/') || 
      urlPath.startsWith('/@') || 
      urlPath.startsWith('/node_modules/') ||
      urlPath.startsWith('/src/') ||
      urlPath.includes('.')) {
    return next();
  }

  try {
    let normalizedPath = urlPath;
    try {
      normalizedPath = decodeURIComponent(urlPath);
    } catch (e) {}
    normalizedPath = normalizedPath.replace(/\/$/, '');

    const cacheKey = `content-exists:${normalizedPath}`;
    const cached = memoryCache.get<{ exists: boolean }>(cacheKey);
    if (cached !== null) {
      if (!cached.exists) {
        if (isProduction && fs.existsSync(indexPath)) {
          return res.status(404).sendFile(indexPath);
        }
        res.status(404);
      }
      return next();
    }

    for (const { pattern, table, slugField, altSlugField } of ARTICLE_PATTERNS) {
      const match = normalizedPath.match(pattern);
      if (match) {
        const slug = match[1];
        
        const whereClause = altSlugField 
          ? or(eq((table as any)[slugField], slug), eq((table as any)[altSlugField], slug))
          : eq((table as any)[slugField], slug);
        
        const [article] = await db
          .select({ id: (table as any).id })
          .from(table)
          .where(whereClause)
          .limit(1);

        if (!article) {
          memoryCache.set(cacheKey, { exists: false }, CACHE_TTL_NOT_FOUND);
          console.log(`[Content404] Article not found: ${slug} - returning 404 status`);
          if (isProduction && fs.existsSync(indexPath)) {
            return res.status(404).sendFile(indexPath);
          }
          res.status(404);
        } else {
          memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
        }
        return next();
      }
    }

    const categoryMatch = normalizedPath.match(CATEGORY_PATTERN);
    if (categoryMatch) {
      const slug = categoryMatch[1];
      const [category] = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, slug))
        .limit(1);

      if (!category) {
        memoryCache.set(cacheKey, { exists: false }, CACHE_TTL_NOT_FOUND);
        console.log(`[Content404] Category not found: ${slug} - returning 404 status`);
        if (isProduction && fs.existsSync(indexPath)) {
          return res.status(404).sendFile(indexPath);
        }
        res.status(404);
      } else {
        memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
      }
      return next();
    }

    const reporterMatch = normalizedPath.match(REPORTER_PATTERN);
    if (reporterMatch) {
      const id = reporterMatch[1];
      const [reporter] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!reporter) {
        memoryCache.set(cacheKey, { exists: false }, CACHE_TTL_NOT_FOUND);
        console.log(`[Content404] Reporter not found: ${id} - returning 404 status`);
        if (isProduction && fs.existsSync(indexPath)) {
          return res.status(404).sendFile(indexPath);
        }
        res.status(404);
      } else {
        memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
      }
      return next();
    }

    const writerMatch = normalizedPath.match(WRITER_PATTERN);
    if (writerMatch) {
      const id = writerMatch[1];
      const [writer] = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, id))
        .limit(1);

      if (!writer) {
        memoryCache.set(cacheKey, { exists: false }, CACHE_TTL_NOT_FOUND);
        console.log(`[Content404] Writer not found: ${id} - returning 404 status`);
        if (isProduction && fs.existsSync(indexPath)) {
          return res.status(404).sendFile(indexPath);
        }
        res.status(404);
      } else {
        memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
      }
      return next();
    }

    const shortUrlMatch = normalizedPath.match(SHORT_URL_PATTERN);
    if (shortUrlMatch) {
      const shortSlug = shortUrlMatch[1];
      
      if (VALID_PREFIXES.has(shortSlug.toLowerCase())) {
        return next();
      }
      
      const [arArticle] = await db
        .select({ id: articles.id })
        .from(articles)
        .where(eq(articles.englishSlug, shortSlug))
        .limit(1);
      
      if (arArticle) {
        memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
        return next();
      }
      
      const [enArticle] = await db
        .select({ id: enArticles.id })
        .from(enArticles)
        .where(eq(enArticles.englishSlug, shortSlug))
        .limit(1);
      
      if (enArticle) {
        memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
        return next();
      }
      
      const [urArticle] = await db
        .select({ id: urArticles.id })
        .from(urArticles)
        .where(eq(urArticles.englishSlug, shortSlug))
        .limit(1);
      
      if (urArticle) {
        memoryCache.set(cacheKey, { exists: true }, CACHE_TTL_FOUND);
        return next();
      }
      
      memoryCache.set(cacheKey, { exists: false }, CACHE_TTL_NOT_FOUND);
      console.log(`[Content404] Short URL not found: ${shortSlug} - returning 404 status`);
      if (isProduction && fs.existsSync(indexPath)) {
        return res.status(404).sendFile(indexPath);
      }
      res.status(404);
      return next();
    }

    next();
  } catch (error) {
    console.error('[Content404] Error checking content existence:', error);
    next();
  }
}
