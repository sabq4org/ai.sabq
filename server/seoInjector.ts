import type { Request, Response, NextFunction } from "express";
import { db } from "./db";
import { articles, categories, users, enArticles, urArticles, gulfEvents } from "@shared/schema";
import { eq, or, desc, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { withCache, CACHE_TTL } from "./memoryCache";

const SKIP_PREFIXES = ['/api/', '/src/', '/@fs/', '/assets/', '/@vite/', '/node_modules/'];
const FILE_EXT_REGEX = /\.\w{2,5}$/;

let cachedTemplate: string | null = null;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureAbsoluteUrl(url: string, baseUrl: string): string {
  if (!url) return `${baseUrl}/icon.png`;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/api/public-media/')) return `${baseUrl}${url}`;
  if (url.startsWith('/public-objects/')) {
    const filePath = url.replace('/public-objects/', '');
    return `${baseUrl}/api/public-media/public/${filePath}`;
  }
  return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  if (str.length <= len) return str;
  return str.substring(0, len).replace(/\s+\S*$/, '') + '...';
}

function getBaseUrl(req: Request): string {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction) return 'https://sabq.org';
  const proto = (req.headers['x-forwarded-proto'] as string) || 'https';
  const host = (req.headers['host'] as string) || 'sabq.org';
  return `${proto}://${host}`;
}

async function getTemplate(): Promise<string> {
  const isProduction = process.env.NODE_ENV === 'production';
  if (isProduction && cachedTemplate) return cachedTemplate;

  const templatePath = isProduction
    ? path.resolve(import.meta.dirname, 'public', 'index.html')
    : path.resolve(import.meta.dirname, '..', 'client', 'index.html');

  const template = await fs.promises.readFile(templatePath, 'utf-8');
  if (isProduction) {
    cachedTemplate = template;
  }
  return template;
}

interface SeoData {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: string;
  ogImage: string;
  ogLocale: string;
  ogSiteName: string;
  publishedTime?: string;
  modifiedTime?: string;
  articleSection?: string;
  articleTags?: string[];
  articleAuthor?: string;
  twitterSite: string;
  jsonLd?: object;
  semanticHtml?: string;
  preloadImage?: string;
}

function injectSeoIntoHtml(html: string, seo: SeoData): string {
  const safeTitle = escapeHtml(seo.title);
  const safeDesc = escapeHtml(seo.description);
  const safeCanonical = escapeHtml(seo.canonicalUrl);
  const safeImage = escapeHtml(seo.ogImage);
  const safeSiteName = escapeHtml(seo.ogSiteName);

  let result = html.replace(/<title>[^<]*<\/title>/, `<title>${safeTitle}</title>`);

  result = result.replace(
    /<meta\s+name="description"\s+content="[^"]*"\s*\/?>/,
    `<meta name="description" content="${safeDesc}">`
  );

  result = result.replace(/<meta\s+property="og:[^"]*"\s+content="[^"]*"\s*\/?>\s*\n?/g, '');
  result = result.replace(/<meta\s+name="twitter:[^"]*"\s+content="[^"]*"\s*\/?>\s*\n?/g, '');
  result = result.replace(/<meta\s+property="twitter:[^"]*"\s+content="[^"]*"\s*\/?>\s*\n?/g, '');

  const isArticlePage = seo.ogType === 'article' && !!seo.publishedTime;

  // For articles older than 1 year: add noarchive to prevent Google Discovery from resurfacing them
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const isOldArticle = isArticlePage && seo.publishedTime && new Date(seo.publishedTime) < oneYearAgo;
  const robotsContent = isOldArticle
    ? 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1, noarchive'
    : isArticlePage
      ? 'index, follow, max-image-preview:large'
      : 'index, follow';

  const metaTags = `
  <!-- SEO Injected Meta Tags -->
  <link rel="canonical" href="${safeCanonical}">
  <meta name="robots" content="${robotsContent}">
  <meta property="og:type" content="${escapeHtml(seo.ogType)}">
  <meta property="og:url" content="${safeCanonical}">
  <meta property="og:title" content="${safeTitle}">
  <meta property="og:description" content="${safeDesc}">
  <meta property="og:image" content="${safeImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${safeSiteName}">
  <meta property="og:locale" content="${escapeHtml(seo.ogLocale)}">
  ${seo.publishedTime ? `<meta property="article:published_time" content="${escapeHtml(seo.publishedTime)}">` : ''}
  ${seo.modifiedTime ? `<meta property="article:modified_time" content="${escapeHtml(seo.modifiedTime)}">` : ''}
  ${seo.articleSection ? `<meta property="article:section" content="${escapeHtml(seo.articleSection)}">` : ''}
  ${seo.articleTags ? seo.articleTags.map(tag => `<meta property="article:tag" content="${escapeHtml(tag)}">`).join('\n  ') : ''}
  <meta property="article:author" content="${escapeHtml(seo.articleAuthor || 'صحيفة سبق الإلكترونية')}">
  <meta property="article:publisher" content="https://www.facebook.com/sabqdotcom">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="${escapeHtml(seo.twitterSite)}">
  <meta name="twitter:title" content="${safeTitle}">
  <meta name="twitter:description" content="${safeDesc}">
  <meta name="twitter:image" content="${safeImage}">
  ${seo.jsonLd ? `<script type="application/ld+json">${JSON.stringify(seo.jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
  <!-- End SEO Injected -->`;

  result = result.replace('</head>', `${metaTags}\n</head>`);

  if (seo.preloadImage) {
    const preloadTag = `<link rel="preload" as="image" href="${escapeHtml(seo.preloadImage)}" fetchpriority="high">\n`;
    result = result.replace('</head>', `${preloadTag}</head>`);
  }

  if (seo.semanticHtml) {
    result = result.replace(
      '<div id="root">',
      `<div id="root">${seo.semanticHtml}`
    );
  }

  return result;
}

async function handleArticlePage(slug: string, baseUrl: string, urlPrefix: string): Promise<SeoData | null> {
  const article = await withCache(`seo:article:${slug}`, CACHE_TTL.LONG, async () =>
    db
      .select({
        id: articles.id,
        title: articles.title,
        slug: articles.slug,
        englishSlug: articles.englishSlug,
        excerpt: articles.excerpt,
        imageUrl: articles.imageUrl,
        aiSummary: articles.aiSummary,
        publishedAt: articles.publishedAt,
        updatedAt: articles.updatedAt,
        seo: articles.seo,
        categoryName: categories.nameAr,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(articles)
      .leftJoin(categories, eq(articles.categoryId, categories.id))
      .leftJoin(users, eq(articles.authorId, users.id))
      .where(or(eq(articles.slug, slug), eq(articles.englishSlug, slug)))
      .limit(1)
  );

  if (!article.length) return null;

  const a = article[0];
  const seoData = (a.seo as any) || {};
  const title = a.title || seoData.metaTitle || '';
  const description = truncate(seoData.metaDescription || a.excerpt || a.aiSummary || '', 220);
  const image = ensureAbsoluteUrl(a.imageUrl || '', baseUrl);
  const canonicalUrl = `${baseUrl}/${urlPrefix}/${a.slug}`;
  const authorName = [a.authorFirstName, a.authorLastName].filter(Boolean).join(' ') || 'صحيفة سبق الإلكترونية';
  const publishedTime = a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined;
  const modifiedTime = a.updatedAt ? new Date(a.updatedAt).toISOString() : publishedTime;
  const keywords = seoData.keywords || [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
    "headline": title,
    "description": description,
    "image": [image],
    "datePublished": publishedTime,
    "dateModified": modifiedTime,
    "author": { "@type": "Person", "name": authorName },
    "publisher": {
      "@type": "NewsMediaOrganization",
      "name": "صحيفة سبق الإلكترونية",
      "logo": { "@type": "ImageObject", "url": `${baseUrl}/branding/sabq-og-image.png` }
    },
    "articleSection": a.categoryName || undefined,
    "keywords": keywords.length > 0 ? keywords : undefined,
  };

  const safeTitle = escapeHtml(title);
  const safeExcerpt = escapeHtml(truncate(a.excerpt || a.aiSummary || '', 300));
  const semanticHtml = `<article style="position:absolute;left:-9999px;"><h1>${safeTitle}</h1>${publishedTime ? `<time datetime="${publishedTime}">${publishedTime}</time>` : ''}<p>${safeExcerpt}</p></article>`;

  return {
    title: `${title} — سبق`,
    description,
    canonicalUrl,
    ogType: 'article',
    ogImage: image,
    ogLocale: 'ar_SA',
    ogSiteName: 'صحيفة سبق الإلكترونية',
    publishedTime,
    modifiedTime,
    articleSection: a.categoryName || undefined,
    articleTags: keywords.length > 0 ? keywords : undefined,
    articleAuthor: authorName,
    twitterSite: '@sabq',
    jsonLd,
    semanticHtml,
    preloadImage: image,
  };
}

async function handleEnArticlePage(slug: string, baseUrl: string): Promise<SeoData | null> {
  const article = await withCache(`seo:en-article:${slug}`, CACHE_TTL.LONG, async () =>
    db
      .select({
        id: enArticles.id,
        title: enArticles.title,
        slug: enArticles.slug,
        englishSlug: enArticles.englishSlug,
        excerpt: enArticles.excerpt,
        imageUrl: enArticles.imageUrl,
        aiSummary: enArticles.aiSummary,
        publishedAt: enArticles.publishedAt,
        updatedAt: enArticles.updatedAt,
        seo: enArticles.seo,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(enArticles)
      .leftJoin(users, eq(enArticles.authorId, users.id))
      .where(or(eq(enArticles.slug, slug), eq(enArticles.englishSlug, slug)))
      .limit(1)
  );

  if (!article.length) return null;

  const a = article[0];
  const seoData = (a.seo as any) || {};
  const title = a.title || seoData.metaTitle || '';
  const description = truncate(seoData.metaDescription || a.excerpt || a.aiSummary || '', 220);
  const image = ensureAbsoluteUrl(a.imageUrl || '', baseUrl);
  const articleSlug = a.englishSlug || a.slug;
  const canonicalUrl = `${baseUrl}/en/article/${articleSlug}`;
  const authorName = [a.authorFirstName, a.authorLastName].filter(Boolean).join(' ') || 'Sabq News';
  const publishedTime = a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined;
  const modifiedTime = a.updatedAt ? new Date(a.updatedAt).toISOString() : publishedTime;
  const keywords = seoData.keywords || [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
    "headline": title,
    "description": description,
    "image": [image],
    "datePublished": publishedTime,
    "dateModified": modifiedTime,
    "author": { "@type": "Person", "name": authorName },
    "publisher": {
      "@type": "NewsMediaOrganization",
      "name": "Sabq News",
      "logo": { "@type": "ImageObject", "url": `${baseUrl}/branding/sabq-og-image.png` }
    },
    "keywords": keywords.length > 0 ? keywords : undefined,
  };

  const safeTitle = escapeHtml(title);
  const safeExcerpt = escapeHtml(truncate(a.excerpt || a.aiSummary || '', 300));
  const semanticHtml = `<article style="position:absolute;left:-9999px;"><h1>${safeTitle}</h1>${publishedTime ? `<time datetime="${publishedTime}">${publishedTime}</time>` : ''}<p>${safeExcerpt}</p></article>`;

  return {
    title: `${title} — Sabq`,
    description,
    canonicalUrl,
    ogType: 'article',
    ogImage: image,
    ogLocale: 'en_US',
    ogSiteName: 'Sabq News',
    publishedTime,
    modifiedTime,
    twitterSite: '@sabq',
    jsonLd,
    semanticHtml,
    preloadImage: image,
  };
}

async function handleUrArticlePage(slug: string, baseUrl: string): Promise<SeoData | null> {
  const article = await withCache(`seo:ur-article:${slug}`, CACHE_TTL.LONG, async () =>
    db
      .select({
        id: urArticles.id,
        title: urArticles.title,
        slug: urArticles.slug,
        englishSlug: urArticles.englishSlug,
        excerpt: urArticles.excerpt,
        imageUrl: urArticles.imageUrl,
        aiSummary: urArticles.aiSummary,
        publishedAt: urArticles.publishedAt,
        updatedAt: urArticles.updatedAt,
        seo: urArticles.seo,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(urArticles)
      .leftJoin(users, eq(urArticles.authorId, users.id))
      .where(or(eq(urArticles.slug, slug), eq(urArticles.englishSlug, slug)))
      .limit(1)
  );

  if (!article.length) return null;

  const a = article[0];
  const seoData = (a.seo as any) || {};
  const title = a.title || seoData.metaTitle || '';
  const description = truncate(seoData.metaDescription || a.excerpt || a.aiSummary || '', 220);
  const image = ensureAbsoluteUrl(a.imageUrl || '', baseUrl);
  const articleSlug = a.englishSlug || a.slug;
  const canonicalUrl = `${baseUrl}/ur/article/${articleSlug}`;
  const authorName = [a.authorFirstName, a.authorLastName].filter(Boolean).join(' ') || 'سبق نیوز';
  const publishedTime = a.publishedAt ? new Date(a.publishedAt).toISOString() : undefined;
  const modifiedTime = a.updatedAt ? new Date(a.updatedAt).toISOString() : publishedTime;
  const keywords = seoData.keywords || [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
    "headline": title,
    "description": description,
    "image": [image],
    "datePublished": publishedTime,
    "dateModified": modifiedTime,
    "author": { "@type": "Person", "name": authorName },
    "publisher": {
      "@type": "NewsMediaOrganization",
      "name": "سبق نیوز",
      "logo": { "@type": "ImageObject", "url": `${baseUrl}/branding/sabq-og-image.png` }
    },
    "keywords": keywords.length > 0 ? keywords : undefined,
  };

  const safeTitle = escapeHtml(title);
  const safeExcerpt = escapeHtml(truncate(a.excerpt || a.aiSummary || '', 300));
  const semanticHtml = `<article style="position:absolute;left:-9999px;"><h1>${safeTitle}</h1>${publishedTime ? `<time datetime="${publishedTime}">${publishedTime}</time>` : ''}<p>${safeExcerpt}</p></article>`;

  return {
    title: `${title} — سبق`,
    description,
    canonicalUrl,
    ogType: 'article',
    ogImage: image,
    ogLocale: 'ur_PK',
    ogSiteName: 'سبق نیوز',
    publishedTime,
    modifiedTime,
    twitterSite: '@sabq',
    jsonLd,
    semanticHtml,
    preloadImage: image,
  };
}

async function handleCategoryPage(slug: string, baseUrl: string): Promise<SeoData | null> {
  const category = await withCache(`seo:category:${slug}`, CACHE_TTL.LONG, async () =>
    db
      .select({
        id: categories.id,
        nameAr: categories.nameAr,
        slug: categories.slug,
        description: categories.description,
        heroImageUrl: categories.heroImageUrl,
      })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1)
  );

  if (!category.length) return null;

  const c = category[0];
  const title = `${c.nameAr} — سبق`;
  const description = c.description || `أخبار ${c.nameAr} على مدار الساعة من صحيفة سبق الإلكترونية`;
  const image = ensureAbsoluteUrl(c.heroImageUrl || '', baseUrl);
  const canonicalUrl = `${baseUrl}/category/${c.slug}`;

  return {
    title,
    description,
    canonicalUrl,
    ogType: 'website',
    ogImage: image,
    ogLocale: 'ar_SA',
    ogSiteName: 'صحيفة سبق الإلكترونية',
    twitterSite: '@sabq',
  };
}

async function handleHomepage(baseUrl: string): Promise<SeoData> {
  const recentArticles = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      imageUrl: articles.imageUrl,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .where(eq(articles.status, 'published'))
    .orderBy(desc(articles.publishedAt))
    .limit(30);

  const heroImage = recentArticles.length > 0 ? ensureAbsoluteUrl(recentArticles[0].imageUrl || '', baseUrl) : undefined;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "سبق الذكية",
    "url": baseUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };

  let semanticHtml = '';
  if (recentArticles.length > 0) {
    const links = recentArticles.map(a => {
      const safeTitle = escapeHtml(a.title || '');
      const href = `/article/${a.slug}`;
      return `<li><a href="${href}">${safeTitle}</a></li>`;
    }).join('');
    semanticHtml = `<nav aria-label="آخر الأخبار" style="position:absolute;left:-9999px;"><h2>آخر الأخبار</h2><ul>${links}</ul></nav>`;
  }

  return {
    title: 'سبق الذكية - صحيفة سبق الإلكترونية',
    description: 'سبق الذكية - منصة الأخبار السعودية الأولى المدعومة بالذكاء الاصطناعي. أخبار عاجلة ومحلية ورياضية وعالمية مع تلخيص تلقائي، نظام توصيات شخصي، وتغطية حصرية على مدار الساعة.',
    canonicalUrl: baseUrl,
    ogType: 'website',
    ogImage: `${baseUrl}/branding/sabq-og-image.png`,
    ogLocale: 'ar_SA',
    ogSiteName: 'صحيفة سبق الإلكترونية',
    twitterSite: '@sabq',
    jsonLd,
    semanticHtml,
    preloadImage: heroImage,
  };
}

function matchRoute(pathname: string): { type: string; slug?: string } | null {
  if (pathname === '/' || pathname === '') return { type: 'homepage' };

  let match = pathname.match(/^\/article\/([^/]+)$/);
  if (match) return { type: 'article', slug: match[1] };

  match = pathname.match(/^\/opinion\/([^/]+)$/);
  if (match) return { type: 'opinion', slug: match[1] };

  match = pathname.match(/^\/en\/article\/([^/]+)$/);
  if (match) return { type: 'en-article', slug: match[1] };

  match = pathname.match(/^\/ur\/article\/([^/]+)$/);
  if (match) return { type: 'ur-article', slug: match[1] };

  match = pathname.match(/^\/category\/([^/]+)$/);
  if (match) return { type: 'category', slug: match[1] };

  if (pathname === '/sponsored') return { type: 'sponsored' };

  if (pathname === '/gulf-live') return { type: 'gulf-live' };

  return null;
}

interface RouteMatch {
  type: string;
  slug?: string;
  query?: Record<string, string>;
}

async function handleSponsoredPage(baseUrl: string, mvi?: string): Promise<SeoData> {
  const canonicalUrl = mvi ? `${baseUrl}/sponsored?mvi=${mvi}` : `${baseUrl}/sponsored`;
  
  let title = 'محتوى مُموّل — سبق';
  let description = 'محتوى مُموّل على صحيفة سبق الإلكترونية';
  let ogImage = `${baseUrl}/branding/sabq-og-image.png`;
  
  if (mvi) {
    try {
      const data = await withCache(`seo:sponsored:${mvi}`, CACHE_TTL.MEDIUM, async () => {
        const response = await fetch(`https://polarcdn-terrax.com/nativeads/v1.4.0/json/creative/${mvi}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (response.ok) {
          return response.json();
        }
        return null;
      });
      if (data?.experience?.title) {
        title = `${data.experience.title} — سبق`;
        description = data.experience.title;
      }
      if (data?.primaryMedia?.content?.href) {
        const imgHref = data.primaryMedia.content.href;
        ogImage = imgHref.startsWith('http') ? imgHref : `https://polarcdn-terrax.com${imgHref.startsWith('/') ? '' : '/'}${imgHref}`;
      }
    } catch (e) {
      console.warn('[SEO] Failed to fetch sponsored content for OG tags:', e);
    }
  }
  
  return {
    title,
    description,
    canonicalUrl,
    ogType: 'article',
    ogImage,
    ogLocale: 'ar_SA',
    ogSiteName: 'صحيفة سبق الإلكترونية',
    twitterSite: '@sabq',
  };
}

const GULF_COUNTRY_AR_SEO: Record<string, string> = {
  saudi_arabia: "السعودية", uae: "الإمارات", bahrain: "البحرين",
  kuwait: "الكويت", qatar: "قطر", oman: "عُمان", yemen: "اليمن",
};

function toSaudiIso(date: Date | string | null): string {
  if (!date) return new Date().toISOString();
  const d = new Date(date);
  const offset = 3 * 60;
  const local = new Date(d.getTime() + offset * 60000);
  return local.toISOString().replace('Z', '+03:00');
}

async function handleGulfLivePage(baseUrl: string): Promise<SeoData> {
  const events = await withCache(
    'seo:gulf-live-schema',
    CACHE_TTL.LONG,
    async () => {
      return db
        .select({
          content: gulfEvents.content,
          country: gulfEvents.country,
          sourceName: gulfEvents.sourceName,
          publishedAt: gulfEvents.publishedAt,
        })
        .from(gulfEvents)
        .where(eq(gulfEvents.status, "published"))
        .orderBy(desc(gulfEvents.publishedAt))
        .limit(50);
    }
  );

  const firstPublished = events.length > 0 ? events[events.length - 1].publishedAt : null;
  const lastModified = events.length > 0 ? events[0].publishedAt : null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LiveBlogPosting",
    "headline": "البث الحي – الاعتداءات على دول الخليج",
    "url": `${baseUrl}/gulf-live`,
    "datePublished": toSaudiIso(firstPublished),
    "dateModified": toSaudiIso(lastModified),
    "coverageStartTime": toSaudiIso(firstPublished),
    "inLanguage": "ar",
    "keywords": "الاعتداءات على دول الخليج, مسيّرات, صواريخ باليستية, السعودية, الإمارات, البحرين, الكويت, قطر",
    "publisher": {
      "@type": "Organization",
      "name": "صحيفة سبق الإلكترونية",
      "url": baseUrl,
      "logo": { "@type": "ImageObject", "url": `${baseUrl}/logo.png` }
    },
    "liveBlogUpdate": events.map(event => ({
      "@type": "BlogPosting",
      "headline": (event.content || "").substring(0, 110),
      "datePublished": toSaudiIso(event.publishedAt),
      "articleBody": event.content || "",
      "locationCreated": { "@type": "Place", "name": GULF_COUNTRY_AR_SEO[event.country] || event.country },
      "author": { "@type": "Organization", "name": event.sourceName || "بيان رسمي" }
    }))
  };

  return {
    title: 'البث الحي — الاعتداءات على دول الخليج | صحيفة سبق',
    description: 'تغطية لحظية مباشرة لجميع الاعتداءات على دول الخليج العربي — اعتراض مسيّرات وصواريخ باليستية وكروز مع تحديثات فورية من المصادر الرسمية',
    canonicalUrl: `${baseUrl}/gulf-live`,
    ogType: 'website',
    ogImage: `${baseUrl}/branding/sabq-og-image.png`,
    ogLocale: 'ar_SA',
    ogSiteName: 'صحيفة سبق الإلكترونية',
    twitterSite: '@sabq',
    publishedTime: toSaudiIso(firstPublished),
    modifiedTime: toSaudiIso(lastModified),
    jsonLd,
  };
}

async function resolveSeoData(route: { type: string; slug?: string; mvi?: string }, baseUrl: string): Promise<SeoData | null> {
  switch (route.type) {
    case 'article':
      return handleArticlePage(route.slug!, baseUrl, 'article');
    case 'opinion':
      return handleArticlePage(route.slug!, baseUrl, 'opinion');
    case 'en-article':
      return handleEnArticlePage(route.slug!, baseUrl);
    case 'ur-article':
      return handleUrArticlePage(route.slug!, baseUrl);
    case 'category':
      return handleCategoryPage(route.slug!, baseUrl);
    case 'homepage':
      return handleHomepage(baseUrl);
    case 'sponsored':
      return handleSponsoredPage(baseUrl, route.mvi);
    case 'gulf-live':
      return handleGulfLivePage(baseUrl);
    default:
      return null;
  }
}

export async function seoInjectorMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const pathname = req.path;

    if (SKIP_PREFIXES.some(prefix => pathname.startsWith(prefix))) return next();
    if (FILE_EXT_REGEX.test(pathname)) return next();
    if (req.method !== 'GET') return next();

    const route = matchRoute(pathname);
    if (!route) return next();

    if (route.type === 'sponsored' && req.query.mvi) {
      (route as any).mvi = String(req.query.mvi);
    }

    const baseUrl = getBaseUrl(req);
    const seoData = await resolveSeoData(route, baseUrl);

    if (!seoData) {
      console.log(`[SEO] No data found for ${route.type}: ${route.slug}`);
      return next();
    }

    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
      const template = await getTemplate();
      let html = injectSeoIntoHtml(template, seoData);

      if (route.type === 'homepage') {
        try {
          const { swrCache } = await import("./memoryCache");
          const cacheKey = 'homepage-lite';
          const cached = swrCache.get<any>(cacheKey);
          if (cached.data) {
            const safeJson = JSON.stringify(cached.data).replace(/</g, '\\u003c');
            const inlineScript = `<script>window.__HOMEPAGE_DATA__=${safeJson};</script>`;
            html = html.replace('</head>', `${inlineScript}\n</head>`);
          }
        } catch (e) {
        }
      }

      console.log(`[SEO] Injected meta tags for ${route.type}: ${route.slug || '/'}`);

      res.status(200)
        .set({
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        })
        .send(html);
    } else {
      const origEnd = res.end.bind(res);

      (res as any).end = function(chunk: any, encoding?: any, cb?: any): Response {
        const body = typeof chunk === 'string'
          ? chunk
          : (Buffer.isBuffer(chunk) ? chunk.toString('utf-8') : '');

        if (body && body.includes('<title>') && body.includes('<div id="root">')) {
          const injected = injectSeoIntoHtml(body, seoData!);
          console.log(`[SEO:dev] Injected meta tags for ${route.type}: ${route.slug || '/'}`);
          return origEnd(injected, 'utf-8', cb);
        }

        return origEnd(chunk, encoding, cb);
      };

      next();
    }
  } catch (error) {
    console.error('[SEO] Error in SEO injector middleware:', error);
    next();
  }
}
