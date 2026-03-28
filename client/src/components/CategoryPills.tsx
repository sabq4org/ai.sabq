import { Badge } from "@/components/ui/badge";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Category } from "@shared/schema";

interface CategoryPillsProps {
  categories: Category[];
  selectedCategory?: string;
  onSelectCategory?: (categoryId: string | undefined) => void;
}

export function CategoryPills({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: CategoryPillsProps) {
  return (
    <div className="w-full border-b bg-background/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-2 py-3">
            <Badge
              variant={!selectedCategory ? "default" : "secondary"}
              className="cursor-pointer hover-elevate active-elevate-2 px-4 py-2 text-sm transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg"
              onClick={() => onSelectCategory?.(undefined)}
              data-testid="badge-category-all"
            >
              الكل
            </Badge>
            {categories.map((category) => (
              <Badge
                key={category.id}
                variant={selectedCategory === category.id ? "default" : "secondary"}
                className="cursor-pointer hover-elevate active-elevate-2 px-4 py-2 text-sm flex items-center gap-1.5 transition-all duration-300 hover:scale-105 hover:-translate-y-0.5 hover:shadow-lg"
                onClick={() => onSelectCategory?.(category.id)}
                data-testid={`badge-category-${category.slug}`}
              >
                {category.icon && <span className="text-base">{category.icon}</span>}
                {category.nameAr}
              </Badge>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}
