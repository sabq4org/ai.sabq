import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Link } from "wouter";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Category } from "@shared/schema";
import { filterAICategories } from "@/utils/filterAICategories";

export function NavigationBar() {
  const { data: allCoreCategories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories/smart", "core", "active"],
    queryFn: async () => {
      const params = new URLSearchParams({ type: "core", status: "active" });
      const res = await fetch(`/api/categories/smart?${params}`, { credentials: "include" });
      if (!res.ok) return [];
      return await res.json();
    },
  });

  const coreCategories = useMemo(() => filterAICategories(allCoreCategories), [allCoreCategories]);

  if (!coreCategories.length) return null;

  return (
    /* DESIGN.md — category strip: white bg, 1px #D4D4CC border-bottom, 44px height, 14px 600 font */
    <div className="sabq-nav-strip sticky top-16 z-40 hidden md:block">
      <div className="container mx-auto px-3 sm:px-6 lg:px-8 h-full">
        <ScrollArea className="w-full whitespace-nowrap h-full">
          <div className="flex gap-6 h-[44px] items-center" dir="rtl">
            {coreCategories.map((category) => (
              <Link key={category.id} href={`/category/${category.englishSlug || category.slug}`}>
                {/* DESIGN.md: hover + active = sabq-red color + 2px red underline */}
                <span
                  className="sabq-nav-item"
                  data-testid={`nav-category-${category.slug}`}
                >
                  {category.nameAr}
                </span>
              </Link>
            ))}
          </div>
          <ScrollBar orientation="horizontal" className="h-0.5" />
        </ScrollArea>
      </div>
    </div>
  );
}
