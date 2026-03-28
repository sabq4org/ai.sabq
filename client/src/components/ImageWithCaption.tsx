import { Camera, ExternalLink, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import DOMPurify from "isomorphic-dompurify";
import { useState } from "react";

interface ImageWithCaptionProps {
  imageUrl: string;
  altText: string;
  captionHtml?: string;
  captionPlain?: string;
  sourceName?: string;
  sourceUrl?: string;
  relatedArticleSlugs?: string[];
  keywordTags?: string[];
  className?: string;
  isAiGenerated?: boolean;
  aiModel?: string;
  priority?: boolean; // For above-fold images
  objectPosition?: string; // CSS object-position for focal point (e.g., "30% 70%")
}

export function ImageWithCaption({
  imageUrl,
  altText,
  captionHtml,
  captionPlain,
  sourceName,
  sourceUrl,
  relatedArticleSlugs,
  keywordTags,
  className = "",
  isAiGenerated = false,
  aiModel,
  priority = false,
  objectPosition,
}: ImageWithCaptionProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const sanitizedCaption = captionHtml ? DOMPurify.sanitize(captionHtml) : null;
  
  // Skip rendering if no valid URL
  if (!imageUrl) return null;
  
  return (
    <figure className={`my-6 ${className}`} data-testid="figure-image-with-caption">
      {/* Image with AI Badge Overlay - Natural aspect ratio (no fixed ratio) */}
      <div className="relative bg-muted/30 rounded-md overflow-hidden">
        {error ? (
          <div className="w-full aspect-video flex items-center justify-center text-muted-foreground text-sm">
            تعذر تحميل الصورة
          </div>
        ) : (
          <img
            src={imageUrl}
            alt={altText}
            loading={priority ? "eager" : "lazy"}
            decoding={priority ? "sync" : "async"}
            {...(priority ? { fetchpriority: "high" } : {})}
            onLoad={() => setLoaded(true)}
            onError={() => setError(true)}
            className={`w-full h-auto transition-opacity duration-300 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            style={objectPosition ? { objectPosition } : undefined}
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 80vw, 720px"
            data-testid="img-article-image"
          />
        )}
        
        {/* AI-Generated Badge Overlay */}
        {isAiGenerated && (
          <div className="absolute top-3 left-3">
            <Badge 
              variant="secondary" 
              className="bg-primary/90 text-primary-foreground backdrop-blur-sm border border-primary-foreground/20 gap-1.5 shadow-lg"
              data-testid="badge-ai-generated"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span className="font-medium">مولدة بالذكاء الاصطناعي</span>
              {aiModel && (
                <span className="text-xs opacity-90">({aiModel})</span>
              )}
            </Badge>
          </div>
        )}
      </div>
      
      {/* Caption */}
      {(sanitizedCaption || captionPlain) && (
        <figcaption className="mt-3 p-3 bg-muted/50 rounded-md" data-testid="figcaption-text">
          {sanitizedCaption ? (
            <div
              className="text-sm text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: sanitizedCaption }}
            />
          ) : (
            <p className="text-sm text-muted-foreground">{captionPlain}</p>
          )}
          
          {/* Source Attribution */}
          {sourceName && (
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Camera className="h-3 w-3" />
              <span>المصدر:</span>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-primary hover:underline inline-flex items-center gap-1"
                  data-testid="link-image-source"
                >
                  {sourceName}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span>{sourceName}</span>
              )}
            </div>
          )}
          
          {/* Related Articles */}
          {relatedArticleSlugs && relatedArticleSlugs.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2">أخبار مشابهة:</p>
              <div className="flex flex-wrap gap-2">
                {relatedArticleSlugs.map((slug, index) => (
                  <Link key={slug} href={`/articles/${slug}`}>
                    <a>
                      <Badge variant="outline" className="hover-elevate cursor-pointer" data-testid={`link-related-article-${index}`}>
                        {slug}
                      </Badge>
                    </a>
                  </Link>
                ))}
              </div>
            </div>
          )}
          
          {/* Keywords */}
          {keywordTags && keywordTags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {keywordTags.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          )}
        </figcaption>
      )}
    </figure>
  );
}
