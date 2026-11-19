"use client";

import { MapIcon } from "lucide-react";
import { cn } from "cn";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { FadeImg } from "./fade-img";

/** Image from one of our proxy routes; falls back to a placeholder on error. */
export function MapImage({
  src,
  alt,
  className,
  fallback = "Map unavailable. Enable the Maps Static API for your Google key.",
}: {
  src: string;
  alt: string;
  className?: string;
  /** Shown when the image can't load. */
  fallback?: string;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cn(
        "relative aspect-[16/9] overflow-hidden bg-muted ring-1 ring-border print:border print:border-border print:ring-0",
        className,
      )}
    >
      {failed ? (
        <div className="absolute inset-0 grid place-items-center text-center text-sm text-foreground/55">
          <span className="flex flex-col items-center gap-2 px-6">
            <MapIcon aria-hidden className="size-5" />
            {fallback}
          </span>
        </div>
      ) : (
        <>
          {/* Shimmer until the photo arrives, then it fades in over it. */}
          {!loaded && (
            <Skeleton className="absolute inset-0 print:hidden" aria-hidden />
          )}
          <FadeImg
            src={src}
            alt={alt}
            loading="eager"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className="absolute inset-0 size-full object-cover print:opacity-100"
          />
        </>
      )}
    </div>
  );
}
