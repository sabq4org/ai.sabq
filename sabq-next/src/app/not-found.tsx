import Link from 'next/link';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

/**
 * 404 Not Found Page
 * 
 * Custom 404 page with proper HTTP status code.
 * Returns actual 404 instead of SPA-style 200 (fixes SEO issue from old site).
 */

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center py-20">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-8xl font-extrabold text-[#C0392B] mb-4">404</h1>
          <h2 className="text-2xl font-bold text-[#0D0D0D] mb-3">الصفحة غير موجودة</h2>
          <p className="text-[#7A7A72] mb-8 leading-relaxed">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها إلى عنوان آخر.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/"
              className="px-6 py-3 bg-[#C0392B] text-white text-sm font-semibold rounded-[4px] hover:bg-[#A93226] transition-colors"
            >
              الصفحة الرئيسية
            </Link>
            <Link
              href="/category/saudi"
              className="px-6 py-3 bg-[#F8F8F6] text-[#0D0D0D] text-sm font-semibold rounded-[4px] border border-[#D4D4CC] hover:bg-[#D4D4CC] transition-colors"
            >
              أخبار السعودية
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
