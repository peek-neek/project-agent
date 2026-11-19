"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export type { MapPin } from "./places-map";

/**
 * The interactive map, loaded on the client only (MapLibre needs WebGL).
 * Pass `className` to size it; the skeleton matches the default height.
 */
export const InteractiveMap = dynamic(
  () => import("./places-map").then((m) => m.PlacesMap),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[28rem] w-full lg:h-[34rem]" />,
  },
);
