import { useState, useEffect, useRef, useMemo } from "react";
import { ImageOff } from "lucide-react";

export type ImageSize = 'thumbnail' | 'small' | 'medium' | 'large' | 'original';

interface OptimizedImageProps {
  src: string;
  alt: string;
  /** Classes applied to the image element (sizing, object-fit, transitions, etc.) */
  className?: string;
  /** Classes applied only to the wrapper div (for placeholder positioning) */
  wrapperClassName?: string;
  objectPosition?: string;
  priority?: boolean;
  aspectRatio?: string;
  fallbackGradient?: string;
  webpSrc?: string;
  blurDataUrl?: string;
  threshold?: number;
  sizes?: string;
  srcSet?: string;
  fetchPriority?: "high" | "low" | "auto";
  onLoad?: () => void;
  onError?: () => void;
  width?: number;
  height?: number;
  quality?: number;
  preferSize?: ImageSize;
}

const IMAGE_WIDTHS: Record<ImageSize, number> = {
  thumbnail: 150,
  small: 400,
  medium: 800,
  large: 1200,
  original: 0
};

// Generate CSS gradient placeholder based on dominant color or fallback
// This is lightweight and doesn't require fetching any additional resources
function generateGradientPlaceholder(src: string): string {
  // Create a subtle gradient placeholder based on src hash for consistency
  if (!src) return 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted-foreground)/0.1) 100%)';
  
  // Simple hash for consistent color per image
  let hash = 0;
  for (let i = 0; i < src.length; i++) {
    hash = ((hash << 5) - hash) + src.charCodeAt(i);
    hash |= 0;
  }
  
  // Generate subtle gradient based on hash
  const hue = Math.abs(hash) % 360;
  const saturation = 5 + (Math.abs(hash >> 8) % 10); // Very low saturation
  const lightness = 85 + (Math.abs(hash >> 16) % 10); // High lightness
  
  return `linear-gradient(135deg, hsl(${hue} ${saturation}% ${lightness}%) 0%, hsl(${hue} ${saturation}% ${lightness - 5}%) 100%)`;
}

// Allowed paths for Cloudflare Image transformation
// Only static media files should be transformed, not API endpoints or dynamic URLs
const CLOUDFLARE_ALLOWED_PATHS = [
  '/public-objects/',
  '/uploads/',
  '/media/',
  '/images/',
  '/assets/',
];

// Paths that should NEVER be transformed (API, proxies, dynamic endpoints)
const CLOUDFLARE_BLOCKED_PATHS = [
  '/api/',
  '/cdn-cgi/',
  '/_next/',
];

// Cloudflare Image CDN - transforms images at edge for faster delivery
// Format: /cdn-cgi/image/width=X,quality=Y,format=auto/path/to/image
function buildCloudflareUrl(src: string, options?: { 
  width?: number; 
  height?: number; 
  quality?: number;
}): string {
  if (!src) return src;
  
  // Skip if already a Cloudflare CDN URL
  if (src.includes('/cdn-cgi/image/')) return src;
  
  // Handle Cloudflare Images URLs (imagedelivery.net) - these are already optimized
  // Format: https://imagedelivery.net/[account-hash]/[image-id]/[variant]
  // Note: Only 'public' variant is configured, always use it
  if (src.includes('imagedelivery.net')) {
    // Ensure we're using the public variant (the only one configured)
    return src.replace(/\/[^\/]+$/, '/public');
  }
  
  // Skip data URLs and blobs
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  
  // Extract path for validation
  let imagePath = src;
  if (src.startsWith('http')) {
    try {
      const url = new URL(src);
      // Skip external URLs (only optimize sabq.org images)
      if (!url.hostname.includes('sabq.org')) return src;
      imagePath = url.pathname + url.search;
    } catch {
      return src;
    }
  }
  
  // Skip blocked paths (API, proxies, etc.)
  if (CLOUDFLARE_BLOCKED_PATHS.some(blocked => imagePath.includes(blocked))) {
    return src;
  }
  
  // Only transform allowed paths (static media files)
  const isAllowedPath = CLOUDFLARE_ALLOWED_PATHS.some(allowed => imagePath.includes(allowed));
  if (!isAllowedPath) {
    return src;
  }
  
  // Build Cloudflare transformation parameters
  const params: string[] = [];
  if (options?.width) params.push(`width=${options.width}`);
  if (options?.height) params.push(`height=${options.height}`);
  params.push(`quality=${options?.quality || 80}`);
  params.push('format=auto'); // Auto-select WebP/AVIF based on browser
  
  // Only use fit=cover when both dimensions are specified (for explicit cropping)
  if (options?.width && options?.height) {
    params.push('fit=cover');
  } else {
    params.push('fit=scale-down'); // Preserve aspect ratio, don't crop
  }
  
  const cfParams = params.join(',');
  
  // Return Cloudflare CDN URL
  return `/cdn-cgi/image/${cfParams}${imagePath}`;
}

// Legacy: Build optimized image URL with query parameters for server-side optimization
function buildOptimizedUrl(src: string, options?: { 
  width?: number; 
  height?: number; 
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
}): string {
  if (!src) return src;
  
  // Only optimize images from public-objects (our storage)
  if (!src.includes('/public-objects/')) return src;
  
  // Already has optimization params
  if (src.includes('?w=') || src.includes('&w=')) return src;
  
  const params: string[] = [];
  if (options?.width) params.push(`w=${options.width}`);
  if (options?.height) params.push(`h=${options.height}`);
  if (options?.quality) params.push(`q=${options.quality}`);
  if (options?.format) params.push(`f=${options.format}`);
  
  if (params.length === 0) return src;
  
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}${params.join('&')}`;
}

// Generate srcSet for responsive images using Cloudflare CDN
function generateResponsiveSrcSet(src: string, quality: number = 80): string {
  if (!src) return '';
  
  // Handle Cloudflare Images URLs (imagedelivery.net)
  // Only use 'public' variant as other variants are not configured
  if (src.includes('imagedelivery.net')) {
    // Ensure we're using the public variant
    const baseUrl = src.replace(/\/[^\/]+$/, '');
    const publicUrl = `${baseUrl}/public`;
    return `${publicUrl} 320w, ${publicUrl} 640w, ${publicUrl} 960w, ${publicUrl} 1920w`;
  }
  
  // Skip external URLs
  if (src.startsWith('http') && !src.includes('sabq.org')) return '';
  
  // Skip data URLs and blobs
  if (src.startsWith('data:') || src.startsWith('blob:')) return '';
  
  // Generate responsive widths using Cloudflare CDN
  const widths = [320, 640, 960, 1280];
  return widths
    .map(w => `${buildCloudflareUrl(src, { width: w, quality })} ${w}w`)
    .join(', ');
}

// Convert image URL using Cloudflare CDN with smart sizing
function getOptimizedUrl(src: string, options?: {
  width?: number;
  height?: number;
  quality?: number;
  preferSize?: ImageSize;
}): string {
  if (!src) return '';
  
  // Default sizes based on preferSize
  const sizeMap: Record<ImageSize, number> = {
    thumbnail: 150,
    small: 320,
    medium: 640,
    large: 960,
    original: 0
  };
  
  const width = options?.width || (options?.preferSize ? sizeMap[options.preferSize] : 640);
  const quality = options?.quality || 80;
  
  // Use Cloudflare CDN for optimization
  if (width > 0) {
    return buildCloudflareUrl(src, { width, height: options?.height, quality });
  }
  
  return src;
}

export function OptimizedImage({
  src,
  alt,
  className = "",
  wrapperClassName = "",
  objectPosition = "center 20%",
  priority = false,
  aspectRatio,
  fallbackGradient = "from-primary/10 to-accent/10",
  webpSrc,
  blurDataUrl,
  threshold = 0.1,
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw",
  srcSet,
  fetchPriority = "auto",
  onLoad,
  onError,
  width,
  height,
  quality,
  preferSize,
}: OptimizedImageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(priority);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-generate optimized URL with WebP conversion
  const optimizedSrc = useMemo(() => {
    if (webpSrc) return webpSrc;
    return getOptimizedUrl(src, { width, height, quality, preferSize });
  }, [src, webpSrc, width, height, quality, preferSize]);
  
  // Auto-generate responsive srcSet if not provided
  const autoSrcSet = useMemo(() => {
    if (srcSet) return srcSet;
    return generateResponsiveSrcSet(src);
  }, [src, srcSet]);
  
  // Use provided blurDataUrl (base64) or generate lightweight CSS gradient
  const gradientPlaceholder = useMemo(() => generateGradientPlaceholder(src), [src]);
  const hasBlurDataUrl = !!blurDataUrl;

  useEffect(() => {
    if (priority) {
      setIsInView(true);
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    // Check if IntersectionObserver is available
    if (!('IntersectionObserver' in window)) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= threshold) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "300px", // Increased for earlier loading
        threshold: [0, threshold, 0.5, 1],
      }
    );

    observer.observe(container);

    return () => {
      observer.disconnect();
    };
  }, [priority, threshold]);

  // Note: Preload removed - browser handles srcset selection automatically
  // Adding preload with fixed size causes duplicate downloads on different viewports

  const handleLoad = () => {
    setIsLoaded(true);
    onLoad?.();
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
    onError?.();
  };

  if (hasError) {
    return (
      <div
        className={`relative flex items-center justify-center bg-gradient-to-br ${fallbackGradient} ${className} ${wrapperClassName}`}
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        <ImageOff className="h-8 w-8 text-muted-foreground/30" aria-hidden="true" />
      </div>
    );
  }

  const imageStyles = {
    objectPosition,
  };

  // Build the final className for the img element, including opacity transition
  const imgClassName = `${className} transition-opacity duration-300 ${
    isLoaded ? "opacity-100" : "opacity-0"
  }`;

  return (
    <div 
      ref={containerRef} 
      className={`relative ${wrapperClassName}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {/* Simple gradient placeholder - Safari-safe, no transforms or animations */}
      {!isLoaded && (
        <div 
          className="absolute inset-0 w-full h-full"
          style={{
            background: hasBlurDataUrl 
              ? `url(${blurDataUrl})` 
              : gradientPlaceholder,
            backgroundSize: 'cover',
            backgroundPosition: objectPosition,
            filter: hasBlurDataUrl ? 'blur(10px)' : 'none',
          }}
          aria-hidden="true"
        />
      )}
      
      {/* Main image with progressive loading */}
      {isInView && (
        autoSrcSet ? (
          <picture className="contents">
            <source 
              srcSet={autoSrcSet} 
              type="image/webp"
              sizes={sizes}
            />
            <img
              src={optimizedSrc || src}
              alt={alt}
              className={imgClassName}
              style={imageStyles}
              loading={priority ? "eager" : "lazy"}
              {...{ fetchpriority: priority ? "high" : fetchPriority }}
              onLoad={handleLoad}
              onError={handleError}
              decoding={priority ? "sync" : "async"}
              sizes={sizes}
            />
          </picture>
        ) : (
          <img
            src={optimizedSrc || src}
            alt={alt}
            className={imgClassName}
            style={imageStyles}
            loading={priority ? "eager" : "lazy"}
            {...{ fetchpriority: priority ? "high" : fetchPriority }}
            onLoad={handleLoad}
            onError={handleError}
            decoding={priority ? "sync" : "async"}
            sizes={sizes}
          />
        )
      )}
    </div>
  );
}

// Export a simpler version for quick use
export function QuickImage({ 
  src, 
  alt, 
  className = "" 
}: { 
  src: string; 
  alt: string; 
  className?: string;
}) {
  return (
    <OptimizedImage
      src={src}
      alt={alt}
      className={className}
      aspectRatio="16/9"
    />
  );
}
