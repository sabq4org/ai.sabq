import { useParams } from "wouter";
import { useEffect, useState, useRef, useCallback, useMemo, lazy, Suspense } from "react";
import { getObjectPosition } from "@/lib/imageUtils";
import { useQuery, useMutation } from "@tanstack/react-query";
import { CommentsTeaser } from "@/components/CommentsTeaser";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CommentSection } from "@/components/CommentSection";
import { ArticlePoll } from "@/components/ArticlePoll";
import { RecommendationsWidget } from "@/components/RecommendationsWidget";
import { AIRecommendationsBlock } from "@/components/AIRecommendationsBlock";
import { RelatedOpinionsSection } from "@/components/RelatedOpinionsSection";
import { Paywall } from "@/components/Paywall";
import StoryTimeline from "@/components/StoryTimeline";
import FollowStoryButton from "@/components/FollowStoryButton";
const AiArticleStats = lazy(() => 
  import("@/components/AiArticleStats").then(module => ({ default: module.AiArticleStats }))
);
import { AdSlot } from "@/components/AdSlot";
import { NativeAdsSection } from "@/components/NativeAdsSection";
import { DmsLeaderboardAd, DmsMpuAd, useAdTracking } from "@/components/DmsAdSlot";
import { SocialShareBar } from "@/components/SocialShareBar";
import { ImageWithCaption } from "@/components/ImageWithCaption";
import { VideoPlayer } from "@/components/VideoPlayer";
import { InfographicDetail } from "@/components/InfographicDetail";
import { DataInfographicPage } from "@/components/data-infographic/DataInfographicPage";
import { RelatedInfographics } from "@/components/RelatedInfographics";
import { SmartInsights } from "@/components/SmartInsights";
import { WeeklyPhotosDisplay } from "@/components/WeeklyPhotosDisplay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useBehaviorTracking } from "@/hooks/useBehaviorTracking";
import { useArticleReadTracking } from "@/hooks/useArticleReadTracking";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Heart,
  Bookmark,
  Share2,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Volume2,
  VolumeX,
  CheckCircle2,
  Loader2,
  Eye,
  MessageSquare,
  Archive,
  Zap,
  Lock,
  User,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatArticleTimestamp } from "@/lib/formatTime";
import type { ArticleWithDetails, CommentWithUser } from "@shared/schema";
import DOMPurify from "isomorphic-dompurify";

export default function ArticleDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const { logBehavior } = useBehaviorTracking();
  const [, setLocation] = useLocation();
  
  // Audio player state
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Smart summary collapsible state
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(false);

  const { data: user } = useQuery<{ id: string; name?: string; email?: string; role?: string }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const { data: article, isLoading, error: articleError } = useQuery<ArticleWithDetails>({
    queryKey: ["/api/articles", slug],
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // DMS Ad tracking for article page
  useAdTracking(article?.category?.nameAr || '', article?.id);

  // Redirect opinion articles to their dedicated page
  useEffect(() => {
    if (article?.articleType === 'opinion' && slug) {
      setLocation(`/opinion/${slug}`);
    }
  }, [article?.articleType, slug, setLocation]);

  // Silently update URL to use short englishSlug for better social sharing
  useEffect(() => {
    if (article?.englishSlug && slug !== article.englishSlug) {
      const newPath = `/article/${article.englishSlug}`;
      window.history.replaceState(null, '', newPath);
    }
  }, [article?.englishSlug, slug]);

  const { data: comments = [] } = useQuery<CommentWithUser[]>({
    queryKey: ["/api/articles", slug, "comments"],
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes
  });

  // Combined sidebar data for faster loading (fetches related, tags, and media in parallel)
  const { data: sidebarData } = useQuery<{
    related: ArticleWithDetails[];
    tags: Array<{ id: string; nameAr: string; nameEn: string; slug: string }>;
    mediaAssets: any[];
  }>({
    queryKey: ["/api/articles", slug, "sidebar"],
    enabled: !!slug,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const relatedArticles = sidebarData?.related || [];
  const articleTags = sidebarData?.tags || [];
  const mediaAssets = sidebarData?.mediaAssets;

  // Get token from URL if present
  const searchParams = new URLSearchParams(window.location.search);
  const guestToken = searchParams.get('token');

  const { data: purchaseStatus, isLoading: isLoadingPurchaseStatus } = useQuery<{ hasPurchased: boolean }>({
    queryKey: ['/api/payments/check-purchase', article?.id],
    queryFn: async () => {
      const url = `/api/payments/check-purchase/${article?.id}${guestToken ? `?token=${guestToken}` : ''}`;
      const response = await fetch(url, { credentials: "include" });
      if (!response.ok) throw new Error("Failed to check purchase status");
      return response.json();
    },
    enabled: !!article?.isPaid && !!article?.id,
  });

  const resolvedAuthor = useMemo(() => 
    article?.articleType === 'opinion'
      ? article?.opinionAuthor
      : article?.author,
    [article?.articleType, article?.opinionAuthor, article?.author]
  );

  // Fetch existing short link for article (idempotent GET first)
  const { data: existingShortLink, isLoading: isLoadingShortLink, error: shortLinkError } = useQuery<{ shortCode: string; originalUrl: string } | null>({
    queryKey: ["/api/shortlinks/article", article?.id],
    queryFn: async () => {
      if (!article?.id) return null;
      try {
        const response = await fetch(`/api/shortlinks/article/${article.id}`, {
          credentials: "include",
        });
        if (response.status === 404) {
          return null;
        }
        if (!response.ok) {
          throw new Error(`${response.status}: ${await response.text()}`);
        }
        return await response.json();
      } catch (error) {
        console.error("[ShortLink] Error fetching:", error);
        return null;
      }
    },
    enabled: !!article?.id,
    staleTime: Infinity,
    retry: false,
  });

  // Create short link mutation (only called if no existing link)
  const createShortLinkMutation = useMutation({
    mutationFn: async () => {
      if (!article) throw new Error("Article not loaded");
      const response = await apiRequest("/api/shortlinks", {
        method: "POST",
        body: JSON.stringify({
          originalUrl: `https://sabq.org/article/${slug}`,
          articleId: article.id,
          utmMedium: "social",
          utmCampaign: "article_share",
        }),
      });
      return response;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/shortlinks/article", article?.id], data);
    },
    onError: (error) => {
      console.error("[ShortLink] Error creating short link:", error);
    },
  });

  // Trigger creation only if no existing link and not already creating/failed
  useEffect(() => {
    if (
      article?.id && 
      !isLoadingShortLink && 
      !existingShortLink && 
      !createShortLinkMutation.isPending && 
      !createShortLinkMutation.isSuccess &&
      !createShortLinkMutation.data &&
      !createShortLinkMutation.isError
    ) {
      createShortLinkMutation.mutate();
    }
  }, [article?.id, isLoadingShortLink, existingShortLink]);

  // Use existing link if found, otherwise use created link, fallback to canonical URL
  const shortLink = existingShortLink || createShortLinkMutation.data;

  const { logArticleView } = useArticleReadTracking({
    articleId: article?.id || "",
    enabled: !!article && !!user,
  });

  // Ensure RTL direction is applied for Arabic content
  useEffect(() => {
    const previousDir = document.documentElement.dir;
    const previousLang = document.documentElement.lang;
    
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
    
    // Cleanup: restore previous values when unmounting
    return () => {
      document.documentElement.dir = previousDir || "ltr";
      document.documentElement.lang = previousLang || "en";
    };
  }, []);

  useEffect(() => {
    if (article && user) {
      logArticleView();
    }
  }, [article?.id, user?.id]);

  // Update document.title for SEO (GA4 auto-tracks page views)
  useEffect(() => {
    if (article?.title) {
      document.title = `${article.title} | سبق`;
    }
    return () => {
      document.title = 'سبق - صحيفة إلكترونية سعودية';
    };
  }, [article?.title]);

  // Track article view via POST request on every page load
  // Empty dependency array ensures this runs once per component mount (including refreshes)
  useEffect(() => {
    if (!article?.id) return;
    
    // POST view count - runs on every page load/refresh
    fetch(`/api/articles/${article.id}/view`, { method: 'POST' })
      .then(r => r.json())
      .then(data => console.log('[View] Tracked:', data))
      .catch(err => console.error('[View] Error:', err));
  }, [article?.id]);

  // Load Twitter widgets script and render embedded tweets with theme support
  useEffect(() => {
    if (!article?.content) return;

    // Function to apply theme to all tweet blockquotes
    const applyThemeToTweets = () => {
      const isDark = document.documentElement.classList.contains('dark');
      const theme = isDark ? 'dark' : 'light';
      
      const tweetBlocks = document.querySelectorAll('blockquote.twitter-tweet');
      tweetBlocks.forEach((block) => {
        block.setAttribute('data-theme', theme);
      });
    };

    // Apply theme before loading widgets
    applyThemeToTweets();

    // Check if script is already loaded
    const existingScript = document.querySelector('script[src="https://platform.twitter.com/widgets.js"]');
    
    if (existingScript && window.twttr?.widgets) {
      // Script already loaded, just render tweets
      console.log('[ArticleDetail] Twitter widgets already loaded, rendering tweets');
      window.twttr.widgets.load();
    } else if (!existingScript) {
      // Load script for the first time
      const script = document.createElement('script');
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      
      script.onload = () => {
        console.log('[ArticleDetail] Twitter widgets script loaded successfully');
        applyThemeToTweets();
        if (window.twttr?.widgets) {
          window.twttr.widgets.load();
        }
      };

      script.onerror = () => {
        console.error('[ArticleDetail] Failed to load Twitter widgets script');
      };

      document.body.appendChild(script);
    }

    // Listen for theme changes and reload tweets
    let previousTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
    
    const observer = new MutationObserver(() => {
      const currentTheme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      
      // Only reload if theme actually changed
      if (currentTheme !== previousTheme) {
        previousTheme = currentTheme;
        console.log('[ArticleDetail] Theme changed to', currentTheme);
        applyThemeToTweets();
        if (window.twttr?.widgets) {
          window.twttr.widgets.load();
        }
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    return () => {
      observer.disconnect();
    };
  }, [article?.content]);

  // Add Schema.org JSON-LD for search engines and LLMs
  useEffect(() => {
    if (!article) return;

    const structuredData = {
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "mainEntityOfPage": {
        "@type": "WebPage",
        "@id": window.location.href
      },
      "headline": article.title,
      "description": article.excerpt || article.aiSummary || "",
      "image": article.imageUrl ? [article.imageUrl] : [],
      "datePublished": article.publishedAt,
      "dateModified": article.updatedAt,
      "author": {
        "@type": "Person",
        "name": resolvedAuthor?.firstName && resolvedAuthor?.lastName
          ? `${resolvedAuthor.firstName} ${resolvedAuthor.lastName}`
          : resolvedAuthor?.email || "سبق",
        "url": article.staff?.slug ? `${window.location.origin}/reporter/${article.staff.slug}` : undefined
      },
      "publisher": {
        "@type": "Organization",
        "name": "صحيفة سبق",
        "logo": {
          "@type": "ImageObject",
          "url": `${window.location.origin}/logo.png`
        }
      },
      "articleSection": article.category?.nameAr || "عام",
      "keywords": article.seo?.keywords?.join(", ") || "",
      "isAccessibleForFree": true,
      "inLanguage": "ar"
    };

    // Add script tag to head
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    script.id = 'article-structured-data';
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const existingScript = document.getElementById('article-structured-data');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [article?.id]);

  // Add ImageObject JSON-LD for image SEO
  useEffect(() => {
    if (!article?.imageUrl) return;

    // Get hero image asset data (displayOrder === 0)
    const heroAsset = mediaAssets?.find((asset: any) => asset.displayOrder === 0);
    
    // Convert relative URL to absolute URL
    const absoluteImageUrl = article.imageUrl.startsWith('http') 
      ? article.imageUrl 
      : `${window.location.origin}${article.imageUrl}`;

    const imageObject: any = {
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "contentUrl": absoluteImageUrl,
      "url": absoluteImageUrl,
      "caption": heroAsset?.captionPlain || article.title,
      "description": heroAsset?.altText || article.title,
    };

    // Add keywords if available
    if (heroAsset?.keywordTags && heroAsset.keywordTags.length > 0) {
      imageObject["keywords"] = heroAsset.keywordTags.join(", ");
    } else if (article.seo?.keywords && article.seo.keywords.length > 0) {
      imageObject["keywords"] = article.seo.keywords.join(", ");
    }

    // Add author/source if available
    if (heroAsset?.sourceName) {
      imageObject["author"] = {
        "@type": "Organization",
        "name": heroAsset.sourceName,
      };
      if (heroAsset.sourceUrl) {
        imageObject["author"]["url"] = heroAsset.sourceUrl;
      }
    }

    // Add copyright notice if available
    if (heroAsset?.rightsStatement) {
      imageObject["copyrightNotice"] = heroAsset.rightsStatement;
    }

    // Add script tag to head
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(imageObject);
    script.id = 'image-structured-data';
    document.head.appendChild(script);

    // Cleanup on unmount
    return () => {
      const existingScript = document.getElementById('image-structured-data');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, [article?.id, article?.imageUrl, mediaAssets]);

  // Add Open Graph and Twitter Cards meta tags
  useEffect(() => {
    if (!article) return;

    const seoTitle = article.seo?.metaTitle || article.title;
    const seoDescription = article.seo?.metaDescription || article.excerpt || article.aiSummary || "";
    
    // Convert relative imageUrl to absolute URL
    let seoImage = article.imageUrl || `${window.location.origin}/og-image.png`;
    if (article.imageUrl && !article.imageUrl.startsWith('http')) {
      seoImage = `${window.location.origin}${article.imageUrl}`;
    }
    
    const seoUrl = window.location.href;

    // Get hero image asset data for alt text
    const heroAsset = mediaAssets?.find((asset: any) => asset.displayOrder === 0);
    const imageAlt = heroAsset?.altText || article.title;

    // Store original values to restore on cleanup
    const originalValues = new Map<HTMLMetaElement, string>();
    const createdTags: HTMLMetaElement[] = [];

    // Create or update meta tags, tracking changes
    const updateMetaTag = (property: string, content: string, isName = false) => {
      const attr = isName ? 'name' : 'property';
      let tag = document.querySelector(`meta[${attr}="${property}"]`) as HTMLMetaElement;
      
      if (!tag) {
        // New tag - track it for removal on cleanup
        tag = document.createElement('meta');
        tag.setAttribute(attr, property);
        document.head.appendChild(tag);
        createdTags.push(tag);
      } else {
        // Existing tag - store original value for restoration
        originalValues.set(tag, tag.content);
      }
      
      tag.content = content;
      return tag;
    };

    // Open Graph Tags
    updateMetaTag('og:type', 'article');
    updateMetaTag('og:title', seoTitle);
    updateMetaTag('og:description', seoDescription);
    updateMetaTag('og:image', seoImage);
    updateMetaTag('og:url', seoUrl);
    updateMetaTag('og:site_name', 'صحيفة سبق الإلكترونية');
    updateMetaTag('og:locale', 'ar_SA');

    // Open Graph Image Tags
    if (article.imageUrl) {
      updateMetaTag('og:image:alt', imageAlt);
      updateMetaTag('og:image:type', 'image/jpeg');
      updateMetaTag('og:image:width', '1200');
      updateMetaTag('og:image:height', '630');
    }

    if (article.publishedAt) {
      updateMetaTag('article:published_time', new Date(article.publishedAt).toISOString());
    }
    if (article.updatedAt) {
      updateMetaTag('article:modified_time', new Date(article.updatedAt).toISOString());
    }
    if (article.category?.nameAr) {
      updateMetaTag('article:section', article.category.nameAr);
    }

    // Twitter Cards
    updateMetaTag('twitter:card', 'summary_large_image', true);
    updateMetaTag('twitter:title', seoTitle, true);
    updateMetaTag('twitter:description', seoDescription, true);
    updateMetaTag('twitter:image', seoImage, true);
    
    // Twitter Card Image Tags
    if (article.imageUrl) {
      updateMetaTag('twitter:image:alt', imageAlt, true);
    }

    // SEO Meta Tags
    updateMetaTag('description', seoDescription, true);

    if (article.seo?.keywords && article.seo.keywords.length > 0) {
      updateMetaTag('keywords', article.seo.keywords.join(', '), true);
    }

    // Cleanup on unmount - restore original values or remove created tags
    return () => {
      // Remove newly created tags
      createdTags.forEach(tag => {
        if (tag.parentNode) {
          tag.parentNode.removeChild(tag);
        }
      });
      
      // Restore original values for existing tags
      originalValues.forEach((originalContent, tag) => {
        if (tag.parentNode) {
          tag.content = originalContent;
        }
      });
    };
  }, [article?.id, article?.seo, article?.imageUrl, mediaAssets]);

  const reactMutation = useMutation({
    mutationFn: async () => {
      if (!article) return;
      return await apiRequest(`/api/articles/${article.id}/react`, {
        method: "POST",
      });
    },
    onSuccess: () => {
      if (article) {
        logBehavior("reaction_add", { articleId: article.id });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/articles", slug] });
    },
    onError: (error: Error) => {
      console.log("React mutation error:", error.message);
      if (isUnauthorizedError(error)) {
        toast({
          title: "تسجيل دخول مطلوب",
          description: "يجب تسجيل الدخول للتفاعل مع المقالات",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message || "فشل في التفاعل",
          variant: "destructive",
        });
      }
    },
  });

  const bookmarkMutation = useMutation({
    mutationFn: async () => {
      if (!article) return;
      return await apiRequest(`/api/articles/${article.id}/bookmark`, {
        method: "POST",
      });
    },
    onSuccess: (result: any) => {
      if (article) {
        logBehavior(
          result?.isBookmarked ? "bookmark_add" : "bookmark_remove",
          { articleId: article.id }
        );
      }
      queryClient.invalidateQueries({ queryKey: ["/api/articles", slug] });
      toast({
        title: "تم الحفظ",
        description: "تم تحديث المقالات المحفوظة",
      });
    },
    onError: (error: Error) => {
      console.log("Bookmark mutation error:", error.message);
      if (isUnauthorizedError(error)) {
        toast({
          title: "تسجيل دخول مطلوب",
          description: "يجب تسجيل الدخول لحفظ المقالات",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message || "فشل في الحفظ",
          variant: "destructive",
        });
      }
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (data: { content: string; parentId?: string }) => {
      return await apiRequest(`/api/articles/${slug}/comments`, {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      if (article) {
        logBehavior("comment_create", { articleId: article.id });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/articles", slug, "comments"] });
      toast({
        title: "شكراً لمشاركتك",
        description: "يتم تحليل تعليقك الآن بواسطة الذكاء الاصطناعي للتأكد من التزامه بمعايير المجتمع. سيُنشر تلقائياً إذا كان آمناً.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "تسجيل دخول مطلوب",
          description: "يجب تسجيل الدخول لإضافة تعليق",
          variant: "destructive",
        });
      } else {
        toast({
          title: "خطأ",
          description: error.message || "فشل في إضافة التعليق",
          variant: "destructive",
        });
      }
    },
  });

  const handleReact = useCallback(() => {
    reactMutation.mutate();
  }, [reactMutation]);

  const handleBookmark = useCallback(() => {
    bookmarkMutation.mutate();
  }, [bookmarkMutation]);

  const handleComment = useCallback((content: string, parentId?: string) => {
    commentMutation.mutate({ content, parentId });
  }, [commentMutation]);

  const handlePlayAudio = useCallback(async () => {
    if (!article?.aiSummary && !article?.excerpt) {
      toast({
        title: "لا يوجد محتوى",
        description: "الموجز الذكي غير متوفر لهذا المقال",
        variant: "destructive",
      });
      return;
    }

    // If currently playing, stop playback
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0; // Reset to beginning
      setIsPlaying(false);
      return;
    }

    // If audio is already loaded but paused, resume playback
    if (audioRef.current && audioRef.current.src) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Error resuming audio:', error);
        toast({
          title: "خطأ",
          description: "فشل تشغيل الموجز الصوتي",
          variant: "destructive",
        });
      }
      return;
    }

    // Load and play new audio
    try {
      setIsLoadingAudio(true);
      
      // Add cache busting parameter to prevent browser from caching errors
      const timestamp = article?.updatedAt ? new Date(article.updatedAt).toISOString() : new Date().toISOString();
      const audioUrl = `/api/articles/${slug}/summary-audio?v=${encodeURIComponent(timestamp)}`;
      
      // Create audio element
      audioRef.current = new Audio(audioUrl);
      
      // Add event listeners
      audioRef.current.addEventListener('ended', () => {
        setIsPlaying(false);
      });
      
      audioRef.current.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        toast({
          title: "خطأ",
          description: "فشل تشغيل الموجز الصوتي",
          variant: "destructive",
        });
        setIsPlaying(false);
        setIsLoadingAudio(false);
      });
      
      // Wait for audio to be ready, then play
      audioRef.current.addEventListener('canplaythrough', async () => {
        if (audioRef.current) {
          try {
            await audioRef.current.play();
            setIsPlaying(true);
            setIsLoadingAudio(false);
          } catch (playError) {
            console.error('Error playing audio:', playError);
            toast({
              title: "خطأ",
              description: "فشل تشغيل الموجز الصوتي",
              variant: "destructive",
            });
            setIsLoadingAudio(false);
          }
        }
      }, { once: true }); // Only fire once
      
      // Start loading the audio
      audioRef.current.load();
    } catch (error) {
      console.error('Error loading audio:', error);
      toast({
        title: "خطأ",
        description: "فشل تحميل الموجز الصوتي",
        variant: "destructive",
      });
      setIsLoadingAudio(false);
    }
  }, [article?.aiSummary, article?.excerpt, article?.updatedAt, slug, toast]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [slug]);

  const timeAgo = article?.publishedAt
    ? formatArticleTimestamp(article.publishedAt, { format: 'relative', locale: 'ar' })
    : null;

  const getInitials = useCallback((firstName?: string | null, lastName?: string | null, email?: string) => {
    if (firstName && lastName) {
      return `${firstName[0]}${lastName[0]}`.toUpperCase();
    }
    if (firstName) return firstName[0].toUpperCase();
    if (email) return email[0].toUpperCase();
    return 'م';
  }, []);

  const readingTime = (() => {
    if (!article?.content) return 1;
    const wordsPerMinute = 200;
    const words = article.content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute) || 1;
  })();

  const recentCommenters = useMemo(() => 
    comments
      .reduce((acc: any[], comment) => {
        if (!acc.find(u => u.id === comment.user.id)) {
          acc.push({
            id: comment.user.id,
            firstName: comment.user.firstName,
            lastName: comment.user.lastName,
            profileImageUrl: comment.user.profileImageUrl
          });
        }
        return acc;
      }, [])
      .slice(0, 3),
    [comments]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background/95 relative z-10">
        <Header user={user} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="max-w-4xl mx-auto">
            <Skeleton className="h-8 w-3/4 mb-4" />
            <Skeleton className="h-4 w-1/2 mb-8" />
            <Skeleton className="w-full aspect-[16/9] mb-8" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (articleError && !article) {
    const errorMessage = articleError instanceof Error ? articleError.message : "";
    const isNotFoundError =
      errorMessage.includes("404") ||
      errorMessage.includes("Article not found") ||
      errorMessage.includes("المقال غير موجود");

    return (
      <div className="min-h-screen bg-background/95 relative z-10">
        <Header user={user} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">
              {isNotFoundError ? "المقال غير موجود" : "تعذر تحميل المقال"}
            </h1>
            <p className="text-muted-foreground mb-8">
              {isNotFoundError
                ? "عذراً، لم نتمكن من العثور على المقال المطلوب"
                : "حدث خطأ أثناء تحميل المقال. يرجى المحاولة مرة أخرى."}
            </p>
            <Button onClick={() => window.location.reload()}>
              إعادة المحاولة
            </Button>
          </div>
        </main>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-background/95 relative z-10">
        <Header user={user} />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">المقال غير موجود</h1>
            <p className="text-muted-foreground mb-8">
              عذراً، لم نتمكن من العثور على المقال المطلوب
            </p>
            <Button asChild>
              <Link href="/">
                <a>العودة للرئيسية</a>
              </Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Check if this is an infographic article and render custom component
  if (article.articleType === 'infographic') {
    // Data-driven infographic (بياني) - uses new visual data storytelling system
    if (article.infographicType === 'data' && article.infographicData) {
      return (
        <div className="min-h-screen bg-background/95 relative z-10" dir="rtl">
          <Header user={user} />
          
          {/* Data Infographic with visual blocks */}
          <DataInfographicPage 
            article={article}
            onReact={handleReact}
            onBookmark={handleBookmark}
            hasReacted={article.hasReacted}
            isBookmarked={article.isBookmarked}
            shortLink={shortLink}
          />
          
          {/* Article Poll */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
            <ArticlePoll articleId={article.id} />
          </div>

          {/* Comments Section */}
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
            <Separator className="mb-8" />
            <CommentSection
              articleId={article.id}
              comments={comments}
              currentUser={user}
              onSubmitComment={handleComment}
            />
          </div>
        </div>
      );
    }
    
    // Image-based infographic (صوري) - uses traditional visual infographic viewer
    return (
      <div className="min-h-screen bg-background/95 relative z-10" dir="rtl">
        <Header user={user} />
        
        {/* Full-width Infographic Detail with integrated carousel */}
        <InfographicDetail 
          article={article}
          onReact={handleReact}
          onBookmark={handleBookmark}
          hasReacted={article.hasReacted}
          isBookmarked={article.isBookmarked}
          shortLink={shortLink}
        />
        
        {/* Article Poll */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <ArticlePoll articleId={article.id} />
        </div>

        {/* Comments Section */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
          <Separator className="mb-8" />
          <CommentSection
            articleId={article.id}
            comments={comments}
            currentUser={user}
            onSubmitComment={handleComment}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 relative z-10" dir="rtl">
      <Header user={user} />

      {/* DMS Leaderboard Ad - Desktop only */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-4 max-w-7xl">
        <DmsLeaderboardAd />
      </div>

      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 max-w-7xl">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <article className="lg:col-span-2 space-y-6">
            {/* Article Header Card - TailAdmin Style */}
            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {article.category && (
                  <Badge 
                    variant="secondary" 
                    className="gap-1 text-black"
                    style={{ borderRight: `3px solid ${article.category.color || 'hsl(var(--primary))'}`, backgroundColor: '#e5e5e6' }}
                    data-testid="badge-article-category"
                  >
                    {article.category.icon} {article.category.nameAr}
                  </Badge>
                )}
                {article.newsType === 'breaking' && (
                  <Badge className="bg-red-600 hover:bg-red-700 text-white border-red-600 gap-1" data-testid="badge-article-urgent">
                    <Zap className="h-3 w-3" />
                    عاجل
                  </Badge>
                )}
                {article.status === 'archived' && (user?.role === 'system_admin' || user?.role === 'admin' || user?.role === 'editor') && (
                  <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700 gap-1" data-testid="badge-article-archived">
                    <Archive className="h-3 w-3" />
                    مؤرشف
                  </Badge>
                )}
                {article.aiGenerated && (
                  <Badge variant="secondary" className="gap-1" data-testid="badge-article-ai">
                    <Sparkles className="h-3 w-3" />
                    محتوى مُنشأ بالذكاء الاصطناعي
                  </Badge>
                )}
              </div>

              {/* Subtitle above main title */}
              {article.subtitle && (
                <p className="text-sm sm:text-base text-muted-foreground font-medium" data-testid="text-article-subtitle">
                  {article.subtitle}
                </p>
              )}

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-snug" data-testid="text-article-title">
                {article.title}
              </h1>

              {/* Author Byline - Clean Inline Version */}
              {resolvedAuthor && (
                <div className="flex items-center gap-3 flex-wrap">
                  <Avatar className="h-10 w-10 border border-primary/20 shrink-0">
                    <AvatarImage 
                      src={resolvedAuthor?.profileImageUrl || ""} 
                      alt={`${resolvedAuthor?.firstName || ""} ${resolvedAuthor?.lastName || ""}`.trim() || resolvedAuthor?.email || ""}
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                      {getInitials(resolvedAuthor?.firstName, resolvedAuthor?.lastName, resolvedAuthor?.email)}
                    </AvatarFallback>
                  </Avatar>
                  
                  {/* Author Name & Title */}
                  <div className="min-w-0">
                    {article.staff ? (
                      <Link 
                        href={`/reporter/${article.staff.slug}`} 
                        className="text-sm font-bold hover:text-primary transition-colors flex items-center gap-1" 
                        data-testid="link-reporter-profile"
                      >
                        <span data-testid="text-author-name">
                          {resolvedAuthor?.firstName && resolvedAuthor?.lastName
                            ? `${resolvedAuthor.firstName} ${resolvedAuthor.lastName}`
                            : resolvedAuthor?.email}
                        </span>
                        {article.staff.isVerified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                        )}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold" data-testid="text-author-name">
                        {resolvedAuthor?.firstName && resolvedAuthor?.lastName
                          ? `${resolvedAuthor.firstName} ${resolvedAuthor.lastName}`
                          : resolvedAuthor?.email}
                      </span>
                    )}
                    {(article.staff as any)?.title && (
                      <span className="text-xs text-muted-foreground block">
                        {(article.staff as any).title}
                      </span>
                    )}
                    {/* Publisher Attribution */}
                    {(article as any).publisher?.agencyName && (
                      <span className="text-sm text-blue-600 dark:text-blue-400 block font-medium" data-testid="text-publisher-name">
                        أُرسل بواسطة: {(article as any).publisher.agencyName}
                      </span>
                    )}
                  </div>

                  {/* Separator */}
                  <span className="text-muted-foreground/40 hidden sm:inline">|</span>
                  
                  {/* Metadata - Plain Text */}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                    {timeAgo && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 opacity-70" />
                        {timeAgo}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3 opacity-70" />
                      {readingTime} د قراءة
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Featured Image or Video - Clean TailAdmin Style */}
            {(article as any).isVideoTemplate && (article as any).videoUrl ? (
              <VideoPlayer
                videoUrl={(article as any).videoUrl}
                thumbnailUrl={(article as any).videoThumbnailUrl || article.imageUrl}
                title={article.title}
                className="rounded-lg"
              />
            ) : article.imageUrl && (() => {
              // Find caption data for hero image (if exists)
              const heroImageAsset = mediaAssets?.find(
                (asset: any) => asset.displayOrder === 0
              );
              
              return (
                <ImageWithCaption
                  imageUrl={article.imageUrl}
                  altText={heroImageAsset?.altText || article.title}
                  captionHtml={heroImageAsset?.captionHtml}
                  captionPlain={heroImageAsset?.captionPlain || heroImageAsset?.altText || article.title}
                  sourceName={heroImageAsset?.sourceName}
                  sourceUrl={heroImageAsset?.sourceUrl}
                  isAiGenerated={(article as any).isAiGeneratedImage || false}
                  aiModel={(article as any).aiImageModel}
                  relatedArticleSlugs={heroImageAsset?.relatedArticleSlugs}
                  keywordTags={heroImageAsset?.keywordTags}
                  priority={true}
                  className=""
                  objectPosition={getObjectPosition(article)}
                />
              );
            })()}

            {/* Smart Summary - Compact Lite Version */}
            {(article.aiSummary || article.excerpt) && (
              <Collapsible open={isSummaryExpanded} onOpenChange={setIsSummaryExpanded}>
                <div className="bg-muted/30 border rounded-lg p-3 sm:p-4">
                  <div className="flex items-start gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="h-3 w-3 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h3 className="text-sm font-bold">الموجز الذكي</h3>
                        <div className="flex items-center gap-1">
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-2 gap-1 text-xs"
                              data-testid="button-toggle-summary"
                            >
                              {isSummaryExpanded ? "إخفاء" : "المزيد"}
                              <ChevronDown 
                                className={`h-3 w-3 transition-transform duration-200 ${isSummaryExpanded ? 'rotate-180' : ''}`}
                              />
                            </Button>
                          </CollapsibleTrigger>
                          <Button
                            variant={isPlaying ? "default" : "ghost"}
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={handlePlayAudio}
                            disabled={isLoadingAudio}
                            data-testid="button-listen-summary"
                          >
                            {isLoadingAudio ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : isPlaying ? (
                              <VolumeX className="h-3 w-3" />
                            ) : (
                              <Volume2 className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p 
                        className={`text-xs sm:text-sm text-muted-foreground leading-relaxed ${!isSummaryExpanded ? 'line-clamp-3' : ''}`}
                        data-testid="text-smart-summary"
                      >
                        {article.aiSummary || article.excerpt}
                      </p>
                    </div>
                  </div>
                </div>
              </Collapsible>
            )}

            {/* DMS MPU Ad - Mobile only, between Smart Summary and Smart Insights */}
            {/* Lazy loaded for performance - loads when 200px from viewport */}
            {/* Ad hidden when no real ad available via DmsMpuAd component */}
            <DmsMpuAd id="MPU" lazyLoad={true} />

            {/* Smart AI Insights - تحليل ذكي للخبر (visible only for authenticated users) */}
            {article.status === "published" && user && (
              <SmartInsights articleId={article.id} articleTitle={article.title} />
            )}

            {/* Article Content or Paywall */}
            <div className="bg-card border rounded-lg p-6">
              {isLoadingPurchaseStatus ? (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">جاري التحقق من حالة الشراء...</p>
                </div>
              ) : article.isPaid && !purchaseStatus?.hasPurchased ? (
                <Paywall 
                  article={{
                    id: article.id,
                    title: article.title,
                    content: article.content,
                    priceHalalas: article.priceHalalas || 0,
                    previewLength: article.previewLength ?? undefined,
                    imageUrl: article.imageUrl,
                    slug: article.slug
                  }}
                  onPurchaseComplete={() => {
                    queryClient.invalidateQueries({ queryKey: ['/api/payments/check-purchase', article.id] });
                  }}
                />
              ) : (
                <div 
                  className="prose prose-lg dark:prose-invert max-w-none leading-loose text-justify"
                  dangerouslySetInnerHTML={{ 
                    __html: DOMPurify.sanitize(article.content, {
                      ADD_TAGS: ['iframe', 'blockquote', 'img'],
                      ADD_ATTR: ['allow', 'allowfullscreen', 'frameborder', 'scrolling', 'src', 'data-lang', 'data-theme', 'data-video-embed', 'data-url', 'data-embed-url', 'class', 'alt', 'loading', 'width', 'height'],
                      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
                    })
                  }}
                  data-testid="content-article-body"
                />
              )}
            </div>

            {/* Weekly Photos Section */}
            {article.articleType === 'weekly_photos' && (article as any).weeklyPhotosData?.photos && (
              <div className="bg-card border rounded-lg p-6">
                <WeeklyPhotosDisplay 
                  photos={(article as any).weeklyPhotosData.photos}
                  title="صور الأسبوع"
                />
              </div>
            )}

            {/* Additional Images - from mediaAssets table OR albumImages field */}
            {(() => {
              // First check mediaAssets from article_media_assets table
              // Note: API returns { ...assetFields, mediaFile: { ...mediaFileFields } }
              const mediaAdditionalImages = mediaAssets
                ?.filter((asset: any) => asset.displayOrder !== 0)
                .sort((a: any, b: any) => a.displayOrder - b.displayOrder) || [];
              
              // Then check albumImages from article field (legacy/editor uploads)
              const albumImages = (article as any).albumImages || [];
              
              // If neither has images, don't render
              if (mediaAdditionalImages.length === 0 && albumImages.length === 0) return null;
              
              return (
                <div className="bg-card border rounded-lg p-6 space-y-8">
                  <h3 className="text-lg font-bold mb-4">الصور المرفقة</h3>
                  <div className="space-y-8">
                    {/* Display mediaAssets first */}
                    {mediaAdditionalImages.map((asset: any, index: number) => (
                      <ImageWithCaption
                        key={asset.id || `media-${index}`}
                        imageUrl={asset.mediaFile?.url || asset.url}
                        altText={asset.altText || asset.mediaFile?.altText || `صورة ${index + 1}`}
                        captionHtml={asset.captionHtml}
                        captionPlain={asset.captionPlain}
                        sourceName={asset.sourceName}
                        sourceUrl={asset.sourceUrl}
                        relatedArticleSlugs={asset.relatedArticleSlugs}
                        keywordTags={asset.keywordTags}
                        className="w-full"
                      />
                    ))}
                    {/* Display albumImages (from article field) */}
                    {albumImages.map((url: string, index: number) => (
                      <ImageWithCaption
                        key={`album-${index}`}
                        imageUrl={url}
                        altText={`صورة ${mediaAdditionalImages.length + index + 1}`}
                        className="w-full"
                      />
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* Keywords - from SEO field OR article_tags table (after attached images) */}
            {((article.seo?.keywords && article.seo.keywords.length > 0) || articleTags.length > 0) && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">الكلمات المفتاحية</h3>
                <div className="flex flex-wrap gap-2">
                  {/* Display article tags first (from article_tags table - WhatsApp/Email) */}
                  {articleTags.map((tag, index) => (
                    <Badge 
                      key={`tag-${tag.id}`}
                      variant="secondary"
                      className="cursor-pointer hover-elevate active-elevate-2 transition-all duration-300 hover:scale-105"
                      onClick={() => setLocation(`/keyword/${encodeURIComponent(tag.nameAr)}`)}
                      data-testid={`badge-tag-${index}`}
                    >
                      {tag.nameAr}
                    </Badge>
                  ))}
                  {/* Display SEO keywords if no article tags (from SEO field - editor) */}
                  {articleTags.length === 0 && article.seo?.keywords?.map((keyword, index) => (
                    <Badge 
                      key={`seo-${index}`}
                      variant="secondary"
                      className="cursor-pointer hover-elevate active-elevate-2 transition-all duration-300 hover:scale-105"
                      onClick={() => setLocation(`/keyword/${encodeURIComponent(keyword)}`)}
                      data-testid={`badge-keyword-${index}`}
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Engagement & Share Section - Combined */}
            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  {isLoadingShortLink ? (
                    <Loader2 className="h-5 w-5 animate-spin text-green-500" />
                  ) : (
                    <Share2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <h3 className="text-lg font-bold">شارك المقال</h3>
              </div>
              
              {/* Engagement Actions */}
              <div className="flex gap-2">
                <Button
                  variant={article.hasReacted ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={handleReact}
                  data-testid="button-article-react"
                >
                  <Heart className={`h-4 w-4 ${article.hasReacted ? 'fill-current' : ''}`} />
                  <span>إعجاب ({article.reactionsCount || 0})</span>
                </Button>

                <Button
                  variant={article.isBookmarked ? "default" : "outline"}
                  size="sm"
                  className="gap-2"
                  onClick={handleBookmark}
                  data-testid="button-article-bookmark"
                >
                  <Bookmark className={`h-4 w-4 ${article.isBookmarked ? 'fill-current' : ''}`} />
                  <span>حفظ</span>
                </Button>
              </div>

              {/* Social Share */}
              {isLoadingShortLink ? (
                <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري إنشاء رابط المشاركة...
                </div>
              ) : (
                <SocialShareBar
                  title={article.title}
                  url={shortLink?.shortCode ? `https://sabq.org/s/${shortLink.shortCode}` : `https://sabq.org/article/${slug}`}
                  description={article.excerpt || ""}
                  articleId={article.id}
                />
              )}
            </div>

            {/* Story Timeline */}
            {article.storyId && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">تطور القصة</h2>
                    <FollowStoryButton 
                      storyId={article.storyId} 
                      storyTitle={article.storyTitle || article.title}
                    />
                  </div>
                  <StoryTimeline storyId={article.storyId} />
                </div>
                <Separator />
              </>
            )}

            {/* Native Ads - Sponsored Content */}
            <NativeAdsSection
              articleId={article.id}
              categorySlug={article.category?.slug}
              keywords={articleTags?.map(tag => tag.nameAr) || []}
              limit={4}
            />

            {/* Article Poll */}
            <div className="mb-8">
              <ArticlePoll articleId={article.id} />
            </div>

            {/* Comments */}
            <CommentSection
              articleId={article.id}
              comments={comments}
              currentUser={user}
              onSubmitComment={handleComment}
            />
          </article>

          {/* Sidebar */}
          <aside className="space-y-6">
            {/* AI Article Analytics */}
            <Suspense fallback={<Skeleton className="h-48 w-full" />}>
              <AiArticleStats slug={slug} />
            </Suspense>

            {/* Advertisement Slot - Article Sidebar */}
            <AdSlot slotId="sidebar" className="my-6" />

            {/* AI-Powered Smart Recommendations */}
            <AIRecommendationsBlock articleSlug={slug} />

            {/* Related Opinion Articles */}
            {article?.category && (
              <RelatedOpinionsSection
                categoryId={article.category.id}
                categoryName={article.category.nameAr}
                categoryColor={article.category.color || undefined}
                excludeArticleId={article.id}
                limit={5}
              />
            )}

            {relatedArticles.length > 0 && (
              <RecommendationsWidget
                articles={relatedArticles}
                title="أخبار مشابهة"
                reason="قد تعجبك أيضاً"
              />
            )}
          </aside>
        </div>
      </main>

      <Footer />
    </div>
  );
}
