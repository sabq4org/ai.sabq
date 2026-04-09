/**
 * Utility Functions
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind CSS classes with conflict resolution */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format date in Arabic style */
export function formatDateAr(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('ar-SA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Format relative time in Arabic (e.g., "منذ 5 دقائق") */
export function formatRelativeTimeAr(date: Date | string | null): string {
  if (!date) return '';
  const d = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} ${diffMins === 1 ? 'دقيقة' : diffMins < 11 ? 'دقائق' : 'دقيقة'}`;
  if (diffHours < 24) return `منذ ${diffHours} ${diffHours === 1 ? 'ساعة' : diffHours < 11 ? 'ساعات' : 'ساعة'}`;
  if (diffDays < 7) return `منذ ${diffDays} ${diffDays === 1 ? 'يوم' : diffDays < 11 ? 'أيام' : 'يوماً'}`;
  return formatDateAr(date);
}

/** Truncate text with ellipsis */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/** Generate article URL */
export function getArticleUrl(slug: string): string {
  return `/article/${slug}`;
}

/** Generate category URL */
export function getCategoryUrl(slug: string): string {
  return `/category/${slug}`;
}

/** Strip HTML tags from content */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Get image URL with fallback */
export function getImageUrl(thumbnailUrl?: string | null, imageUrl?: string | null): string {
  const url = thumbnailUrl || imageUrl;
  if (!url) return '/images/placeholder.webp';
  // Convert relative paths to absolute URLs pointing to the current production site
  if (url.startsWith('/public-objects/') || url.startsWith('/uploads/')) {
    return `https://sabq.org${url}`;
  }
  return url;
}
