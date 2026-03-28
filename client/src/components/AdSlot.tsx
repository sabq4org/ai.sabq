import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";

interface AdSlotProps {
  slotId: string;
  className?: string;
}

interface AdData {
  creative: {
    id: string;
    name: string;
    type: "image" | "video" | "html";
    content: string;
    size: string;
    destinationUrl: string;
  };
  campaign: {
    id: string;
    name: string;
  };
  impressionId?: string;
}

function getDeviceType(): "desktop" | "mobile" | "tablet" {
  if (typeof window === "undefined") return "desktop";
  
  const width = window.innerWidth;
  
  if (width < 768) {
    return "mobile";
  } else if (width < 1024) {
    return "tablet";
  } else {
    return "desktop";
  }
}

export function AdSlot({ slotId, className = "" }: AdSlotProps) {
  const deviceType = useMemo(() => getDeviceType(), []);

  const { data: ad, isLoading, error } = useQuery<AdData>({
    queryKey: ["/api/ads/slot", slotId, deviceType],
    queryFn: async () => {
      const response = await fetch(`/api/ads/slot/${slotId}?deviceType=${deviceType}`, {
        credentials: "include",
      });
      
      if (response.status === 204) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error("Failed to fetch ad");
      }
      
      return response.json();
    },
    enabled: !!slotId,
    refetchInterval: 60000,
    retry: false,
  });

  useEffect(() => {
    if (ad?.impressionId) {
      fetch(`/api/ads/track/impression/${ad.impressionId}`, {
        method: "POST",
        credentials: "include",
      }).catch(console.error);
    }
  }, [ad?.impressionId]);

  const handleClick = () => {
    if (ad?.impressionId) {
      fetch(`/api/ads/track/click/${ad.impressionId}`, {
        method: "POST",
        credentials: "include",
      }).catch(console.error);
    }

    if (ad?.creative?.destinationUrl) {
      window.open(ad.creative.destinationUrl, "_blank", "noopener,noreferrer");
    }
  };

  // Don't show anything while loading or if no ad
  if (isLoading || error || !ad) {
    return null;
  }

  const { creative } = ad;
  const parsedSize = creative.size?.split('x')?.map(Number) ?? [728, 90];
  const width = isNaN(parsedSize[0]) ? 728 : parsedSize[0];
  const height = isNaN(parsedSize[1]) ? 90 : parsedSize[1];

  return (
    <div 
      className={`ad-slot ${className}`} 
      data-testid={`ad-slot-${slotId}`}
      data-campaign-id={ad.campaign.id}
      data-creative-id={creative.id}
    >
      {creative.type === "image" && (
        <a
          href={creative.destinationUrl}
          onClick={(e) => {
            e.preventDefault();
            handleClick();
          }}
          className="block cursor-pointer mx-auto rounded-md overflow-hidden border border-border/50 bg-card/30 backdrop-blur-sm shadow-sm hover:shadow-md transition-shadow"
          style={{ maxWidth: `${width}px` }}
          data-testid={`ad-link-${creative.id}`}
          rel="noopener noreferrer sponsored"
          target="_blank"
        >
          <img
            src={creative.content}
            alt={creative.name}
            width={width}
            height={height}
            className="w-full h-auto"
            loading="lazy"
            data-testid={`ad-image-${creative.id}`}
          />
        </a>
      )}

      {creative.type === "video" && (
        <div 
          onClick={handleClick} 
          className="cursor-pointer mx-auto" 
          style={{ maxWidth: `${width}px` }}
          data-testid={`ad-video-${creative.id}`}
        >
          <video
            src={creative.content}
            width={width}
            height={height}
            className="w-full h-auto"
            autoPlay
            muted
            loop
            playsInline
          />
        </div>
      )}

      {creative.type === "html" && (
        <div
          onClick={handleClick}
          className="cursor-pointer mx-auto"
          style={{ maxWidth: `${width}px` }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(creative.content || '') }}
          data-testid={`ad-html-${creative.id}`}
        />
      )}
    </div>
  );
}
