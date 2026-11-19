"use client";

import { cn } from "cn";
import { type ComponentProps, useCallback, useState } from "react";

/**
 * An <img> that fades in once loaded instead of popping in over its
 * placeholder. Also catches images that finished loading (e.g. from cache)
 * before React attached onLoad, so none stay invisible.
 */
export function FadeImg({
  className,
  onLoad,
  alt,
  ...props
}: ComponentProps<"img">) {
  const [loaded, setLoaded] = useState(false);
  const ref = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    // eslint-disable-next-line @next/next/no-img-element -- authenticated proxy images
    <img
      ref={ref}
      alt={alt}
      onLoad={(e) => {
        setLoaded(true);
        onLoad?.(e);
      }}
      className={cn(
        "transition-opacity duration-300 ease-out",
        loaded ? "opacity-100" : "opacity-0",
        className,
      )}
      {...props}
    />
  );
}
