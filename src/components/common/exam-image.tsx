import { useState, useEffect } from "react";
import { ZoomIn, RefreshCw, ExternalLink, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExamImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  maxHeightClass?: string;
  onZoom?: (src: string) => void;
  showZoomButton?: boolean;
}

/**
 * Normalizes common image hosting links into direct viewable image URLs.
 */
export function normalizeImageUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  let cleanUrl = url.trim();

  // Google Drive viewer links -> direct thumbnail link
  if (cleanUrl.includes("drive.google.com/file/d/")) {
    const match = cleanUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }
  if (cleanUrl.includes("drive.google.com/open?id=")) {
    const match = cleanUrl.match(/id=([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  // Dropbox shared links
  if (cleanUrl.includes("dropbox.com/s/") && !cleanUrl.includes("raw=1")) {
    cleanUrl = cleanUrl.replace("?dl=0", "").replace("&dl=0", "");
    return cleanUrl.includes("?") ? `${cleanUrl}&raw=1` : `${cleanUrl}?raw=1`;
  }

  return cleanUrl;
}

export function ExamImage({
  src,
  alt,
  className,
  containerClassName,
  maxHeightClass = "max-h-[280px] sm:max-h-[360px] md:max-h-[420px]",
  onZoom,
  showZoomButton = true,
}: ExamImageProps) {
  const normalizedSrc = normalizeImageUrl(src);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Reset states when src changes
  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [normalizedSrc, retryCount]);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    setError(false);
    setLoading(true);
    setRetryCount((prev) => prev + 1);
  };

  const getSourceWithCacheBuster = () => {
    if (retryCount === 0) return normalizedSrc;
    const separator = normalizedSrc.includes("?") ? "&" : "?";
    return `${normalizedSrc}${separator}_t=${Date.now()}`;
  };

  if (!normalizedSrc) return null;

  return (
    <div
      className={cn(
        "relative group rounded-2xl border bg-muted/15 p-2 overflow-hidden flex flex-col items-center justify-center transition-all",
        containerClassName
      )}
    >
      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-card/80 backdrop-blur-xs gap-2 min-h-[140px]">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs font-medium text-muted-foreground animate-pulse">
            Loading image…
          </span>
        </div>
      )}

      {/* Error Fallback */}
      {error ? (
        <div className="flex flex-col items-center justify-center p-6 text-center space-y-3 min-h-[160px] w-full bg-card/60 rounded-xl">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
            <ImageOff className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Image failed to load</p>
            <p className="text-[11px] text-muted-foreground max-w-xs mt-0.5">
              The question image could not be loaded from the host server.
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRetry}
              className="h-8 rounded-lg text-xs gap-1 font-semibold"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Retry
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              asChild
              className="h-8 rounded-lg text-xs gap-1 font-semibold"
            >
              <a href={normalizedSrc} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> Open Direct
              </a>
            </Button>
          </div>
        </div>
      ) : (
        /* Actual Image Element */
        <img
          key={`${normalizedSrc}-${retryCount}`}
          src={getSourceWithCacheBuster()}
          alt={alt}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError(true);
          }}
          className={cn(
            "w-auto max-w-full object-contain rounded-xl transition-all duration-200 select-none",
            maxHeightClass,
            loading ? "opacity-0 invisible" : "opacity-100 visible",
            onZoom ? "cursor-zoom-in hover:brightness-95" : "",
            className
          )}
          onClick={() => onZoom && onZoom(normalizedSrc)}
        />
      )}

      {/* Zoom Button on top right */}
      {!error && !loading && showZoomButton && onZoom && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onZoom(normalizedSrc);
          }}
          className="absolute top-3 right-3 grid h-8 w-8 place-items-center rounded-lg bg-black/75 text-white shadow-md hover:bg-black transition-all hover:scale-105 active:scale-95"
          title="Zoom image"
        >
          <ZoomIn className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
