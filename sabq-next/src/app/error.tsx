'use client';

/**
 * Error Boundary Page
 * 
 * Catches runtime errors and displays a user-friendly error page.
 */

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 flex items-center justify-center py-20">
      <div className="text-center max-w-md mx-auto px-4">
        <h1 className="text-6xl font-extrabold text-[#C0392B] mb-4">خطأ</h1>
        <h2 className="text-xl font-bold text-[#0D0D0D] mb-3">حدث خطأ غير متوقع</h2>
        <p className="text-[#7A7A72] mb-8 leading-relaxed">
          نعتذر عن هذا الخطأ. يرجى المحاولة مرة أخرى.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-[#C0392B] text-white text-sm font-semibold rounded-[4px] hover:bg-[#A93226] transition-colors"
        >
          حاول مرة أخرى
        </button>
      </div>
    </main>
  );
}
