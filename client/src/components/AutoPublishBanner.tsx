import { useState, useEffect, useRef, type MouseEvent } from "react";
import { X, CheckCircle2, FileText, Clock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

interface AutoPublishNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  deeplink: string | null;
  metadata: {
    articleId?: string;
    articleSlug?: string;
    articleTitle?: string;
    language?: string;
    publishedAt?: string;
    imageUrl?: string | null;
    reporter?: {
      userId: string;
      name: string;
    };
  } | null;
  createdAt: string;
}

export function AutoPublishBanner() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [notification, setNotification] = useState<AutoPublishNotification | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Clear auto-hide timeout
  const clearAutoHideTimeout = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Auto-hide notification after 5 seconds
  const scheduleAutoHide = () => {
    clearAutoHideTimeout();
    timeoutRef.current = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => setNotification(null), 300); // Wait for animation
    }, 5000);
  };

  // Manual close with event propagation stop
  const handleClose = (e?: MouseEvent<HTMLButtonElement>) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    clearAutoHideTimeout();
    setIsVisible(false);
    setTimeout(() => setNotification(null), 300);
  };

  // Handle banner click to navigate
  const handleBannerClick = () => {
    if (notification?.deeplink) {
      handleClose(); // Close banner first
      setLocation(notification.deeplink); // Navigate using SPA
    }
  };

  // SSE connection for auto-publish notifications only
  useEffect(() => {
    if (!user) return;

    // Only show for admin and system_admin users
    if (user.role !== 'admin' && user.role !== 'system_admin') return;

    let currentEventSource: EventSource | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let isCleanedUp = false;

    const setupEventSource = () => {
      if (isCleanedUp) return;

      console.log("📡 [AutoPublish] Connecting to notification stream...");

      currentEventSource = new EventSource("/api/notifications/stream", {
        withCredentials: true,
      });

      currentEventSource.onopen = () => {
        console.log("📡 [AutoPublish] SSE connection established");
      };

      currentEventSource.onmessage = (event) => {
        try {
          const incomingNotification = JSON.parse(event.data);
          console.log("📩 [AutoPublish] Notification received:", incomingNotification);

          // Only process article_published notifications
          if (incomingNotification.type === "article_published") {
            console.log("📢 [AutoPublish] Auto-publish notification - showing banner");
            setNotification(incomingNotification);
            setIsVisible(true);
            scheduleAutoHide();
          }
        } catch (error) {
          console.error("[AutoPublish] Error parsing SSE message:", error);
        }
      };

      currentEventSource.onerror = (error) => {
        console.error("📡 [AutoPublish] SSE connection error:", error);
        
        if (currentEventSource) {
          currentEventSource.close();
        }
        
        if (!isCleanedUp) {
          console.log("📡 [AutoPublish] Scheduling reconnection in 5 seconds...");
          retryTimeout = setTimeout(() => {
            setupEventSource();
          }, 5000);
        }
      };

      eventSourceRef.current = currentEventSource;
    };

    setupEventSource();

    return () => {
      console.log("📡 [AutoPublish] Cleaning up SSE connection");
      isCleanedUp = true;
      clearAutoHideTimeout();
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      if (currentEventSource) {
        currentEventSource.close();
      }
      
      eventSourceRef.current = null;
    };
  }, [user]);

  // Don't render if no notification
  if (!notification) return null;

  const languageLabel = notification.metadata?.language === "en" 
    ? "English" 
    : notification.metadata?.language === "ur" 
    ? "اردو"
    : "العربية";

  const content = (
    <div
      className={`
        fixed top-16 left-1/2 -translate-x-1/2 z-50
        w-full max-w-2xl mx-auto px-4
        transition-all duration-300 ease-out
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
      dir="rtl"
      data-testid="banner-autopublish"
    >
      <div className="bg-green-50/95 dark:bg-green-950/95 backdrop-blur-sm border border-green-200/50 dark:border-green-900/50 rounded-lg shadow-lg overflow-hidden">
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="flex-shrink-0 p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-sm text-green-900 dark:text-green-100">
                  {notification.title}
                </h3>
                <span className="text-xs px-2 py-0.5 bg-green-200/50 dark:bg-green-800/50 text-green-700 dark:text-green-300 rounded-full border border-green-300/50 dark:border-green-700/50">
                  {languageLabel}
                </span>
              </div>

              <p className="text-sm text-green-800 dark:text-green-200 mb-2 line-clamp-2">
                {notification.body}
              </p>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-3 text-xs text-green-700 dark:text-green-300">
                {notification.metadata?.reporter && (
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span>{notification.metadata.reporter.name}</span>
                  </div>
                )}
                {notification.metadata?.publishedAt && (
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {formatDistanceToNow(new Date(notification.metadata.publishedAt), {
                        addSuffix: true,
                        locale: arSA,
                      })}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  <span>نُشر تلقائياً عبر البريد</span>
                </div>
              </div>
            </div>

            {/* Image */}
            {notification.metadata?.imageUrl && (
              <div className="flex-shrink-0">
                <img
                  src={notification.metadata.imageUrl}
                  alt=""
                  className="w-16 h-16 object-cover rounded-md ring-1 ring-green-200 dark:ring-green-800"
                />
              </div>
            )}

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="flex-shrink-0 h-6 w-6 text-green-700 dark:text-green-300 hover:bg-green-200/50 dark:hover:bg-green-800/50"
              onClick={(e) => handleClose(e)}
              data-testid="button-close-banner"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-green-200/30 dark:bg-green-800/30 overflow-hidden">
          <div 
            className="h-full bg-green-500 dark:bg-green-400"
            style={{
              animation: isVisible ? 'progress 5s linear' : 'none',
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  );

  // If there's a deeplink, make the banner clickable
  if (notification.deeplink) {
    return (
      <div onClick={handleBannerClick} className="cursor-pointer">
        {content}
      </div>
    );
  }

  return content;
}
