"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { HouseIcon } from "lucide-react";
import { getVersion, setWorkerUrl } from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
import { useEffect, useState } from "react";
import Map, { Marker, NavigationControl } from "react-map-gl/maplibre";
import { cn } from "cn";
import { Skeleton } from "@/components/ui/skeleton";
import {
  collapseAttribution,
  loadMapStyle,
} from "@/components/globals/report/map-style";
import { useMapTheme } from "@/components/globals/report/use-map-theme";

// Same-origin copy of MapLibre's worker (see places-map.tsx).
setWorkerUrl(`/vendor/maplibre-gl-worker-${getVersion()}.mjs`);

export type LatLng = { lat: number; lng: number };

/**
 * A map to drop the property pin on: click anywhere to place it, drag it to
 * fine-tune. Opens zoomed to `center` (a nearby match or the agent's area).
 */
export function PinMap({
  center,
  zoom,
  pin,
  onPinChange,
  className,
}: {
  center: LatLng;
  zoom: number;
  pin: LatLng | null;
  onPinChange: (pin: LatLng) => void;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  // Light or dark map palette, following the app theme.
  const mapTheme = useMapTheme();
  const [mapStyle, setMapStyle] = useState<StyleSpecification | string | null>(
    null,
  );
  useEffect(() => {
    let live = true;
    loadMapStyle(mapTheme).then((style) => live && setMapStyle(style));
    return () => {
      live = false;
    };
  }, [mapTheme]);

  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      <Skeleton
        aria-hidden
        className={cn(
          "absolute inset-0 transition-opacity duration-300",
          loaded && "opacity-0",
        )}
      />
      {mapStyle && (
        <Map
          mapStyle={mapStyle}
          initialViewState={{
            longitude: center.lng,
            latitude: center.lat,
            zoom,
          }}
          cursor="crosshair"
          // Map credits as a folded "i" button, closed until tapped.
          attributionControl={{ compact: true }}
          onLoad={(e) => {
            collapseAttribution(e.target);
            setLoaded(true);
          }}
          onClick={(e) => onPinChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })}
          style={{
            width: "100%",
            height: "100%",
            opacity: loaded ? 1 : 0,
            transition: "opacity 300ms ease-out",
          }}
        >
          <NavigationControl position="top-right" showCompass={false} />
          {pin && (
            <Marker
              longitude={pin.lng}
              latitude={pin.lat}
              anchor="bottom"
              draggable
              onDragEnd={(e) =>
                onPinChange({ lat: e.lngLat.lat, lng: e.lngLat.lng })
              }
            >
              <span
                title="The property (drag to adjust)"
                className="grid size-10 cursor-grab animate-in place-items-center border-2 border-white bg-primary text-primary-foreground shadow-lg duration-150 zoom-in-75 active:cursor-grabbing"
              >
                <HouseIcon aria-hidden className="size-5" />
              </span>
            </Marker>
          )}
        </Map>
      )}
    </div>
  );
}
