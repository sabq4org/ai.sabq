import Link from 'next/link';
import { getActiveBreakingTicker } from '@/lib/db/queries';

/**
 * Breaking News Ticker - Sabq News
 * 
 * Displays active breaking news headlines in a scrolling ticker.
 * Red background with white text, animated scroll.
 * Only renders if there's an active breaking ticker topic.
 * 
 * Server Component - fetches data at request time.
 */

export default async function BreakingTicker() {
  const ticker = await getActiveBreakingTicker();

  if (!ticker || ticker.headlines.length === 0) return null;

  return (
    <div className="bg-[#C0392B] text-white relative overflow-hidden" role="alert" aria-label="أخبار عاجلة">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 flex items-center h-9">
        {/* Breaking Badge */}
        <div className="shrink-0 flex items-center gap-2 pl-4 border-l border-white/30 ml-4">
          <span className="w-2 h-2 bg-white rounded-full breaking-pulse" />
          <span className="text-xs font-bold tracking-wide">عاجل</span>
        </div>

        {/* Scrolling Headlines */}
        <div className="flex-1 overflow-hidden relative">
          <div className="flex gap-12 ticker-animate whitespace-nowrap">
            {ticker.headlines.map((headline) => (
              <span key={headline.id} className="inline-flex items-center gap-2 text-sm font-medium">
                {headline.linkedArticleSlug ? (
                  <Link
                    href={`/article/${headline.linkedArticleSlug}`}
                    className="hover:underline underline-offset-2"
                  >
                    {headline.headline}
                  </Link>
                ) : headline.externalUrl ? (
                  <a
                    href={headline.externalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline underline-offset-2"
                  >
                    {headline.headline}
                  </a>
                ) : (
                  <span>{headline.headline}</span>
                )}
                <span className="text-white/40">|</span>
              </span>
            ))}
            {/* Duplicate for seamless loop */}
            {ticker.headlines.map((headline) => (
              <span key={`dup-${headline.id}`} className="inline-flex items-center gap-2 text-sm font-medium">
                {headline.linkedArticleSlug ? (
                  <Link
                    href={`/article/${headline.linkedArticleSlug}`}
                    className="hover:underline underline-offset-2"
                  >
                    {headline.headline}
                  </Link>
                ) : (
                  <span>{headline.headline}</span>
                )}
                <span className="text-white/40">|</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
