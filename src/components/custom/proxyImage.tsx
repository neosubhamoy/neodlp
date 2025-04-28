import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { invoke } from "@tauri-apps/api/core";
import { Image } from "lucide-react";

interface ProxyImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ProxyImage({ src, alt, className }: ProxyImageProps) {
  const [proxiedSrc, setProxiedSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsProxy, setNeedsProxy] = useState(false);
  const [proxiedImageFailed, setProxiedImageFailed] = useState(false);

  // Try direct loading first, fall back to proxy if needed
  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setNeedsProxy(false);
    setProxiedSrc(null);
    setProxiedImageFailed(false);
    
    if (!src) {
      setError("No image source provided");
      setIsLoading(false);
      return;
    }
    
    return () => {
      // Cleanup
    };
  }, [src]);

  // Load via proxy if direct loading failed
  useEffect(() => {
    let isMounted = true;

    async function loadImageViaProxy() {
      if (!needsProxy || !src) return;
      
      try {
        setIsLoading(true);
        const localPath = await invoke<string>("fetch_image", { url: src });
        
        if (isMounted) {
          setProxiedSrc(localPath);
          setIsLoading(false);
        }
      } catch (err) {
        // console.error("Error fetching image:", err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Failed to load image");
          setIsLoading(false);
        }
      }
    }

    if (needsProxy) {
      loadImageViaProxy();
    }

    return () => {
      isMounted = false;
    };
  }, [src, needsProxy]);

  // Direct loading render
  if (!needsProxy && !error) {
    return (
      <>
        <img 
          src={src} 
          alt={alt} 
          className={className}
          style={{ display: isLoading ? 'none' : 'block' }}
          onLoad={() => setIsLoading(false)}
          onError={() => {
            // console.log("Direct image loading failed, falling back to proxy");
            setNeedsProxy(true);
          }} 
        />
        {isLoading && <Skeleton className={`w-full h-full ${className}`} />}
      </>
    );
  }

  // Proxy loading or error states
  if (isLoading) {
    return <Skeleton className={`w-full h-full ${className}`} />;
  }

  if (error || !proxiedSrc || proxiedImageFailed) {
    return (
      <div className={`flex items-center justify-center h-full bg-muted ${className}`}>
        <Image className="w-7" />
      </div>
    );
  }

  // Successful proxy image
  return (
    <img 
      src={proxiedSrc} 
      alt={alt} 
      className={className} 
      onError={() => {
        // console.log("Proxied image failed to render properly");
        setProxiedImageFailed(true);
      }}
    />
  );
}