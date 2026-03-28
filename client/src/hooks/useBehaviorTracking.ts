import { useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

export type BehaviorEventType = 
  | "article_view"
  | "article_read"
  | "comment_create"
  | "bookmark_add"
  | "bookmark_remove"
  | "reaction_add"
  | "search"
  | "category_filter"
  | "interest_update"
  | "social_share";

interface BehaviorMetadata {
  articleId?: string;
  categoryId?: string;
  searchQuery?: string;
  readTime?: number;
  scrollDepth?: number;
  [key: string]: any;
}

export function useBehaviorTracking() {
  const logBehavior = useCallback(async (
    eventType: BehaviorEventType,
    metadata?: BehaviorMetadata
  ) => {
    try {
      await apiRequest("/api/behavior/log", {
        method: "POST",
        body: JSON.stringify({ eventType, metadata }),
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      // Silent fail for behavior logging - non-critical feature
    }
  }, []);

  return { logBehavior };
}
