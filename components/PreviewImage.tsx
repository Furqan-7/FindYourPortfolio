"use client";

import { useCallback, useState } from "react";
import { initials, remoteScreenshot } from "@/lib/format";

/**
 * Screenshot with graceful degradation:
 * bundled WebP → remote screenshot service → monogram fallback.
 */
export function PreviewImage({
  name,
  url,
  preview,
  priority = false,
  className = "",
  children,
}: {
  name: string;
  url: string;
  preview: string | null;
  priority?: boolean;
  className?: string;
  /** Rendered on top of the screenshot (e.g. the live iframe layer). */
  children?: React.ReactNode;
}) {
  const sources = preview ? [preview, remoteScreenshot(url)] : [remoteScreenshot(url)];
  const [index, setIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = sources[index];
  const exhausted = index >= sources.length;

  const handleLoad = useCallback((img: HTMLImageElement) => {
    // Some screenshot services answer with a tiny placeholder image.
    if (img.naturalWidth < 50) setIndex((i) => i + 1);
    else setLoaded(true);
  }, []);

  // Server-rendered images can finish loading before React hydrates and
  // attaches onLoad, so also check completion when the node mounts.
  const ref = useCallback(
    (img: HTMLImageElement | null) => {
      if (img?.complete) {
        if (img.naturalWidth > 0) handleLoad(img);
        else if (img.currentSrc) setIndex((i) => i + 1);
      }
    },
    [handleLoad],
  );

  return (
    <div className={`preview-img-wrap${loaded || exhausted ? "" : " skeleton"} ${className}`}>
      <div className="preview-fallback" aria-hidden="true">
        {initials(name)}
      </div>
      {src && (
        <img
          key={src}
          ref={ref}
          src={src}
          alt={`Screenshot of ${name}'s portfolio`}
          width={640}
          height={400}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          referrerPolicy="no-referrer"
          className={loaded ? "loaded" : ""}
          onLoad={(e) => handleLoad(e.currentTarget)}
          onError={() => {
            setLoaded(false);
            setIndex((i) => i + 1);
          }}
        />
      )}
      {children}
    </div>
  );
}
