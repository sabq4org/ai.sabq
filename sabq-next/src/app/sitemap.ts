import { MetadataRoute } from 'next';
import { getAllPublishedSlugs, getAllCategorySlugs } from '@/lib/db/queries';

/**
 * Dynamic Sitemap Generation
 * 
 * Generates a complete sitemap with all published articles and categories.
 * Automatically updated on each ISR revalidation.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sabq.org';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articleSlugs, categorySlugs] = await Promise.all([
    getAllPublishedSlugs(),
    getAllCategorySlugs(),
  ]);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'always',
      priority: 1.0,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ];

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = categorySlugs.map((cat) => ({
    url: `${SITE_URL}/category/${cat.slug}`,
    lastModified: cat.updatedAt || new Date(),
    changeFrequency: 'hourly' as const,
    priority: 0.8,
  }));

  // Article pages
  const articlePages: MetadataRoute.Sitemap = articleSlugs.map((article) => ({
    url: `${SITE_URL}/article/${article.slug}`,
    lastModified: article.updatedAt || article.publishedAt || new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...categoryPages, ...articlePages];
}
