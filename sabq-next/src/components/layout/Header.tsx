import Link from 'next/link';
import { getActiveCategories } from '@/lib/db/queries';
import { Search, User, Menu } from 'lucide-react';

/**
 * Header Component - Sabq News
 * 
 * Two-part header:
 * 1. Top bar: Black bg (#0D0D0D) with red bottom border, logo, search, login
 * 2. Category bar: White bg with horizontal scrollable categories
 * 
 * Server Component - fetches categories at build/request time.
 */

export default async function Header() {
  const categories = await getActiveCategories();

  return (
    <header className="sticky top-0 z-50">
      {/* Top Bar */}
      <div className="bg-[#0D0D0D] border-b-2 border-[#C0392B]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <span className="text-white text-2xl font-extrabold tracking-tight" style={{ fontFamily: "'Cairo', sans-serif" }}>
              سبق
            </span>
          </Link>

          {/* Search */}
          <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <input
                type="search"
                placeholder="ابحث في سبق..."
                className="w-full bg-white/10 text-white placeholder-white/50 rounded px-4 py-2 pr-10 text-sm border border-white/20 focus:border-[#C0392B] focus:outline-none transition-colors"
              />
              <Search className="absolute top-1/2 right-3 -translate-y-1/2 w-4 h-4 text-white/50" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button className="md:hidden text-white p-2" aria-label="بحث">
              <Search className="w-5 h-5" />
            </button>
            <Link
              href="/login"
              className="hidden md:flex items-center gap-2 text-white text-sm hover:text-[#C0392B] transition-colors"
            >
              <User className="w-4 h-4" />
              <span>دخول</span>
            </Link>
            <button className="md:hidden text-white p-2" aria-label="القائمة">
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Category Navigation Bar */}
      <nav className="bg-white border-b border-[#D4D4CC]" aria-label="التصنيفات">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12">
          <div className="flex items-center h-11 overflow-x-auto scrollbar-hide gap-1">
            <Link
              href="/"
              className="shrink-0 px-3 py-2 text-sm font-semibold text-[#C0392B] border-b-2 border-[#C0392B] hover:text-[#A93226] transition-colors"
            >
              الرئيسية
            </Link>
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/category/${cat.slug}`}
                className="shrink-0 px-3 py-2 text-sm font-semibold text-[#0D0D0D] hover:text-[#C0392B] hover:border-b-2 hover:border-[#C0392B] transition-colors"
              >
                {cat.nameAr}
              </Link>
            ))}
          </div>
        </div>
      </nav>
    </header>
  );
}
