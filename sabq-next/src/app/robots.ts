import { MetadataRoute } from 'next';

/**
 * Robots.txt Configuration
 * 
 * Fixes the current site's issues:
 * - No conflicting rules between Cloudflare and custom rules
 * - Explicitly allows Googlebot-News
 * - Proper sitemap reference
 * - Blocks only admin/API routes
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sabq.org';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/admin/', '/login', '/register', '/dashboard/'],
      },
      {
        userAgent: 'Googlebot-News',
        allow: '/',
        disallow: ['/api/', '/admin/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
