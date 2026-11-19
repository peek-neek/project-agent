"use client";

import { cn } from "cn";
import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export type { MapPin } from "./places-map";

/** MapLibre needs WebGL, so the map only loads on the client. */
const PlacesMap = dynamic(
  () => import("./places-map").then((m) => m.PlacesMap),
  { ssr: false, loading: () => <Skeleton className="size-full" /> },
);

/** Default map height; pass `className` to change it. */
const DEFAULT_HEIGHT = "h-[28rem] lg:h-[34rem]";

/**
 * The interactive map. The box is sized here, outside the lazily loaded
 * map, so its placeholder is always exactly the map's size (no jump).
 */
export function InteractiveMap({
  className,
  ...props
}: ComponentProps<typeof PlacesMap>) {
  return (
    <div className={cn("relative w-full", DEFAULT_HEIGHT, className)}>
      <PlacesMap {...props} className="h-full lg:h-full" />
    </div>
  );
}
